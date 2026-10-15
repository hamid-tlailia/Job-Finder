import type { Job, SourceContext } from '../core/types';
import { SOURCES } from '../core/sources';
import { listable, settle } from '../core/sources/util';
import { bestTrack, buildQueries, dedupeKey, localAnalysis, trackProfile } from '../core/match';
import type { Profile } from '../core/types';
import { templatePackage } from '../core/template';
import { analyzeJob, generatePackage } from '../ai/claude';
import { useStore } from '../store/useStore';
import { fetchText } from './http';
import { notifyReady } from './notify';
import { drainBackground, syncBackground } from './background';

function ctx(): SourceContext {
  const { profile, settings } = useStore.getState();
  return { queries: buildQueries(profile), profile, keys: { jooble: settings.joobleKey, serpapi: settings.serpapiKey }, fetchText };
}

async function withDetail(job: Job, c: SourceContext): Promise<Job> {
  if (!job.needsDetail) return job;
  const src = SOURCES.find((s) => s.id === job.source);
  if (!src?.detail) return job;
  try {
    return { ...job, ...(await src.detail(job, c)), needsDetail: false };
  } catch {
    return job;
  }
}

/** The profile seen through the job's career track; assigns the best track when none is set yet. */
function profileFor(jobId: string, job: Job): Profile {
  const st = useStore.getState();
  const tracks = st.profile.tracks ?? [];
  let trackId = st.matches[jobId]?.trackId;
  if (!tracks.some((t) => t.id === trackId)) {
    trackId = bestTrack(job, st.profile).trackId;
    if (trackId) st.upsertMatch(jobId, { trackId });
  }
  return trackProfile(st.profile, tracks.find((t) => t.id === trackId));
}

/** Prepares (or re-prepares) the tailored application for one job. */
export async function prepare(jobId: string): Promise<void> {
  const st = useStore.getState();
  const { settings } = st;
  let job = st.jobs[jobId];
  if (!job) return;
  st.upsertMatch(jobId, { status: 'preparing', error: undefined });
  try {
    job = await withDetail(job, ctx());
    st.upsertJob(job);
    const profile = profileFor(jobId, job);
    let analysis = st.matches[jobId]?.analysis;
    if (settings.apiKey) {
      const cfg = { apiKey: settings.apiKey, model: settings.model };
      if (!analysis || analysis.by !== 'ai') {
        const r = await analyzeJob(cfg, profile, job, settings.uiLang);
        analysis = r.analysis;
        job = { ...job, ...r.job };
        st.upsertJob(job);
      }
      const pkg = await generatePackage(cfg, profile, job, analysis, settings.cvTemplate);
      st.upsertMatch(jobId, { analysis, pkg, status: 'ready' });
    } else {
      const ls = bestTrack(job, st.profile).score;
      st.upsertMatch(jobId, { analysis: analysis ?? localAnalysis(job, profile, ls), pkg: templatePackage(profile, job, settings.cvTemplate), status: 'ready' });
    }
  } catch (e) {
    st.upsertMatch(jobId, { status: 'new', error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/** Filters, de-duplicates, scores and (for strong matches) prepares a batch of fetched jobs. */
async function processJobs(all: Job[], c: SourceContext, errors: string[]): Promise<{ fresh: number; ready: number }> {
  const { settings, profile } = useStore.getState();
  const fresh: Job[] = [];
  const st = useStore.getState();
  const seenNow = new Set<string>(); // the same post often arrives from two sources in one run
  for (const j of listable(all)) {
    const key = dedupeKey(j);
    if (st.jobs[j.id] || st.seenKeys[key] || seenNow.has(key) || seenNow.has(j.id)) continue;
    seenNow.add(key);
    seenNow.add(j.id);
    st.markSeen(key, j.id);
    fresh.push(j);
  }

  useStore.getState().setRun({ step: 'score', done: 0, total: fresh.length });
  const scored = fresh
    .map((j) => {
      const b = bestTrack(j, profile);
      return { j, ls: b.score, trackId: b.trackId };
    })
    .filter((x) => !x.ls.blocked)
    .sort((a, b) => b.ls.score - a.ls.score);
  for (const { j, ls, trackId } of scored) {
    st.upsertJob(j);
    st.upsertMatch(j.id, { localScore: ls.score, trackId, analysis: localAnalysis(j, profile, ls) });
  }

  // Deep analysis on the strongest candidates only, to keep AI cost and time bounded.
  const threshold = Math.max(35, profile.prefs.minScore - 25);
  const candidates = scored.filter((x) => x.ls.score >= threshold).slice(0, settings.apiKey ? settings.maxAiPerRun : 15);
  useStore.getState().setRun({ step: 'analyze', done: 0, total: candidates.length });
  let ready = 0;
  if (settings.autoPrepare) {
    await settle(candidates, settings.apiKey ? 3 : 4, async ({ j }) => {
      try {
        let job = await withDetail(j, c);
        useStore.getState().upsertJob(job);
        if (job.closed) {
          useStore.getState().upsertMatch(j.id, { status: 'dismissed' });
          return;
        }
        const best = bestTrack(job, profile);
        useStore.getState().upsertMatch(j.id, { trackId: best.trackId });
        const viewed = trackProfile(profile, profile.tracks?.find((t) => t.id === best.trackId));
        let score = best.score.score;
        if (settings.apiKey) {
          const r = await analyzeJob({ apiKey: settings.apiKey, model: settings.model }, viewed, job, settings.uiLang);
          job = { ...job, ...r.job };
          useStore.getState().upsertJob(job);
          useStore.getState().upsertMatch(j.id, { analysis: r.analysis });
          score = r.analysis.score;
        } else {
          useStore.getState().upsertMatch(j.id, { localScore: score, analysis: localAnalysis(job, viewed, best.score) });
        }
        if (score >= profile.prefs.minScore) {
          await prepare(j.id);
          ready++;
        }
      } catch (e) {
        errors.push(`${j.title}: ${e instanceof Error ? e.message : e}`);
      } finally {
        const r = useStore.getState().run;
        useStore.getState().setRun({ done: r.done + 1 });
      }
    });
  }

  return { fresh: fresh.length, ready };
}

/**
 * Imports the jobs the background check found while the app was closed (it only notifies) and
 * prepares the strong ones right away, so they are waiting in Review when the user opens the app.
 */
export async function ingestBackground(): Promise<number> {
  if (useStore.getState().run.running) return 0;
  const pending = await drainBackground();
  if (!pending.length) return 0;
  const errors: string[] = [];
  useStore.getState().setRun({ running: true, step: 'score', done: 0, total: pending.length, errors: [] });
  try {
    const { ready } = await processJobs(pending, ctx(), errors);
    useStore.getState().prune();
    return ready;
  } finally {
    useStore.getState().setRun({ running: false, step: '', errors });
    void syncBackground();
  }
}

/** Fetches every enabled source, scores new jobs and auto-prepares the best ones. */
export async function runSearch(): Promise<{ found: number; fresh: number; ready: number }> {
  const store = useStore.getState();
  if (store.run.running) return { found: 0, fresh: 0, ready: 0 };
  const { settings, profile } = store;
  const c = ctx();
  const remoteOk = profile.prefs.workplaces.includes('remote');
  // SerpApi's free plan is 250 searches a month, so Google Jobs runs at most every 6 hours.
  const googleDue = !settings.lastGoogleRun || Date.now() - new Date(settings.lastGoogleRun).getTime() > 6 * 3600e3;
  const sources = SOURCES.filter(
    (s) =>
      settings.sources[s.id] !== false &&
      (!s.remoteOnly || remoteOk) &&
      (!s.needsKey || (s.needsKey === 'jooble' ? settings.joobleKey : settings.serpapiKey)) &&
      (s.id !== 'google' || googleDue),
  );
  if (sources.some((s) => s.id === 'google')) store.setSettings({ lastGoogleRun: new Date().toISOString() });
  store.setRun({ running: true, step: 'fetch', done: 0, total: sources.length, errors: [] });

  const all: Job[] = [];
  const errors: string[] = [];
  await settle(sources, 4, async (s) => {
    try {
      all.push(...(await s.search(c)));
    } catch (e) {
      errors.push(`${s.label}: ${e instanceof Error ? e.message : e}`);
    } finally {
      const r = useStore.getState().run;
      useStore.getState().setRun({ done: r.done + 1 });
    }
  });

  all.push(...(await drainBackground()));
  const { fresh, ready } = await processJobs(all, c, errors);

  useStore.getState().prune();
  useStore.getState().setLastRun(new Date().toISOString());
  useStore.getState().setRun({ running: false, step: '', errors });
  if (ready > 0 && settings.notifications) await notifyReady(ready);
  void syncBackground();
  return { found: all.length, fresh, ready };
}
