import type { Job, SourceContext } from '../core/types';
import { SOURCES } from '../core/sources';
import { listable, settle } from '../core/sources/util';
import { bestTrack, buildQueries, deepQueries, dedupeKey, isStrongMatch, localAnalysis, prepareThreshold, trackProfile } from '../core/match';
import type { Analysis, Profile } from '../core/types';
import { templatePackage } from '../core/template';
import { analyzeJob, generatePackage, inLang } from '../ai/claude';
import { aiCfg, hasAi, useStore } from '../store/useStore';
import { fetchText } from './http';
import { applicationLang, ensureMasterCv } from './masterCv';
import { notifyReady } from './notify';
import { drainBackground, syncBackground } from './background';

function ctx(): SourceContext {
  const { profile, settings } = useStore.getState();
  return { queries: buildQueries(profile), deep: deepQueries(profile), profile, keys: { jooble: settings.joobleKey, serpapi: settings.serpapiKey }, fetchText };
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

const relanguaged = new Set<string>();

/** Rewrites an AI analysis written in another language than the app (e.g. after switching Arabic/English). */
export async function refreshAnalysisLang(jobId: string): Promise<void> {
  const st = useStore.getState();
  const m = st.matches[jobId], job = st.jobs[jobId];
  const { settings } = st;
  if (!m?.analysis || m.analysis.by !== 'ai' || !job || !hasAi(settings) || relanguaged.has(jobId)) return;
  if (inLang(`${m.analysis.summary} ${m.analysis.reasons.join(' ')}`, settings.uiLang)) return;
  relanguaged.add(jobId);
  const r = await analyzeJob(aiCfg(settings, true), profileFor(jobId, job), job, settings.uiLang);
  useStore.getState().upsertMatch(jobId, { analysis: { ...r.analysis, score: m.analysis.score, verdict: m.analysis.verdict } });
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
    if (hasAi(settings)) {
      const cfg = aiCfg(settings);
      if (!analysis || analysis.by !== 'ai') {
        const r = await analyzeJob(aiCfg(settings, true), profile, job, settings.uiLang);
        analysis = r.analysis;
        job = { ...job, ...r.job };
        st.upsertJob(job);
      }
      // The track's CV is reused for every job of the track; only the job's keywords are added to it.
      const trackId = useStore.getState().matches[jobId]?.trackId;
      const lang = applicationLang(useStore.getState().profile, job, analysis?.language);
      const master = await ensureMasterCv(trackId, lang);
      const pkg = await generatePackage(cfg, profile, job, analysis, settings.cvTemplate, master, lang, trackId);
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
async function processJobs(all: Job[], c: SourceContext, errors: string[]): Promise<{ fresh: number; ready: number; readyIds: string[] }> {
  const { settings, profile } = useStore.getState();
  const fresh: Job[] = [];
  const st = useStore.getState();
  const seenNow = new Set<string>(); // the same post often arrives from two sources in one run
  useStore.getState().setRun({ step: 'score', done: 0, total: all.length });
  const scored: { j: Job; ls: ReturnType<typeof bestTrack>['score']; trackId?: string }[] = [];
  for (const j of listable(all)) {
    const key = dedupeKey(j);
    if (st.jobs[j.id] || st.seenKeys[key] || seenNow.has(key) || seenNow.has(j.id)) continue;
    seenNow.add(key);
    seenNow.add(j.id);
    const b = bestTrack(j, profile);
    // Unrelated jobs are not remembered as seen: they are scored again next time, so a track added
    // later (e.g. "sales") still finds the posts an earlier search skipped.
    if (b.score.blocked) continue;
    st.markSeen(key, j.id);
    fresh.push(j);
    scored.push({ j, ls: b.score, trackId: b.trackId });
  }
  scored.sort((a, b) => b.ls.score - a.ls.score);
  for (const { j, ls, trackId } of scored) {
    st.upsertJob(j);
    st.upsertMatch(j.id, { localScore: ls.score, trackId, analysis: localAnalysis(j, profile, ls) });
  }

  // Deep analysis on the strongest candidates only, to keep AI cost and time bounded.
  const threshold = Math.max(35, prepareThreshold(profile.prefs, 'local') - 25);
  const candidates = scored.filter((x) => x.ls.score >= threshold).slice(0, hasAi(settings) ? settings.maxAiPerRun : 15);
  useStore.getState().setRun({ step: 'analyze', done: 0, total: candidates.length });
  let ready = 0;
  const readyIds: string[] = [];
  const strong: { id: string; score: number }[] = [];
  if (settings.autoPrepare) {
    await settle(candidates, hasAi(settings) ? 3 : 4, async ({ j }) => {
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
        let analysis = undefined as Analysis | undefined;
        if (hasAi(settings)) {
          const r = await analyzeJob(aiCfg(settings, true), viewed, job, settings.uiLang);
          job = { ...job, ...r.job };
          useStore.getState().upsertJob(job);
          useStore.getState().upsertMatch(j.id, { analysis: r.analysis });
          score = r.analysis.score;
          analysis = r.analysis;
          if (job.closed) {
            useStore.getState().upsertMatch(j.id, { status: 'dismissed' });
            return;
          }
        } else {
          useStore.getState().upsertMatch(j.id, { localScore: score, analysis: localAnalysis(job, viewed, best.score) });
        }
        if (isStrongMatch(profile.prefs, score, analysis)) strong.push({ id: j.id, score });
      } catch (e) {
        errors.push(`${j.title}: ${e instanceof Error ? e.message : e}`);
      } finally {
        const r = useStore.getState().run;
        useStore.getState().setRun({ done: r.done + 1 });
      }
    });
    // Writing an application is the expensive step, so only the best few are written per search;
    // the rest stay in the list with a "Prepare" button.
    const best = strong.sort((a, b) => b.score - a.score).slice(0, settings.maxPreparePerRun ?? 3);
    await settle(best, 3, async ({ id }) => {
      try {
        await prepare(id);
        ready++;
        readyIds.push(id);
      } catch (e) {
        errors.push(`${useStore.getState().jobs[id]?.title ?? id}: ${e instanceof Error ? e.message : e}`);
      }
    });
  }

  return { fresh: fresh.length, ready, readyIds };
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

/** Identifies what a search looks for, so a changed profile can refresh before the usual wait. */
export function searchKey(profile: Profile): string {
  return buildQueries(profile).join('|');
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
  store.setSettings({ lastSearchKey: searchKey(profile) });
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

  // Jobs from the background check were already announced by its own notification.
  const fromBackground = await drainBackground();
  all.push(...fromBackground);
  const announced = new Set(fromBackground.map((j) => j.id));
  const { fresh, ready, readyIds } = await processJobs(all, c, errors);

  useStore.getState().prune();
  useStore.getState().setLastRun(new Date().toISOString());
  useStore.getState().setRun({ running: false, step: '', errors });
  if (settings.notifications) await notifyReady(readyIds.filter((id) => !announced.has(id)));
  void syncBackground();
  return { found: all.length, fresh, ready };
}

/**
 * Prepares jobs that were analysed earlier but not prepared (e.g. the auto threshold changed),
 * bounded by the per-run AI budget.
 */
export async function prepareStrongPending(): Promise<number> {
  const { matches, jobs, profile, settings, run } = useStore.getState();
  if (run.running || !settings.autoPrepare) return 0;
  const todo = Object.values(matches)
    .filter((m) => m.status === 'new' && m.analysis && jobs[m.jobId] && listable([jobs[m.jobId]]).length > 0 && isStrongMatch(profile.prefs, m.analysis.score, m.analysis))
    .sort((a, b) => (b.analysis?.score ?? 0) - (a.analysis?.score ?? 0))
    .slice(0, settings.maxPreparePerRun ?? 3);
  let ready = 0;
  await settle(todo, 3, async (m) => {
    await prepare(m.jobId);
    ready++;
  });
  return ready;
}
