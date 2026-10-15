import type { Job, SourceContext } from '../core/types';
import { SOURCES } from '../core/sources';
import { onlyQatar, settle } from '../core/sources/util';
import { buildQueries, dedupeKey, localAnalysis, localScore } from '../core/match';
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

/** Prepares (or re-prepares) the tailored application for one job. */
export async function prepare(jobId: string): Promise<void> {
  const st = useStore.getState();
  const { profile, settings } = st;
  let job = st.jobs[jobId];
  if (!job) return;
  st.upsertMatch(jobId, { status: 'preparing', error: undefined });
  try {
    job = await withDetail(job, ctx());
    st.upsertJob(job);
    let analysis = st.matches[jobId]?.analysis;
    if (settings.apiKey) {
      const cfg = { apiKey: settings.apiKey, model: settings.model };
      if (!analysis || analysis.by !== 'ai') {
        const r = await analyzeJob(cfg, profile, job, settings.uiLang);
        analysis = r.analysis;
        job = { ...job, ...r.job };
        st.upsertJob(job);
      }
      const pkg = await generatePackage(cfg, profile, job, analysis);
      st.upsertMatch(jobId, { analysis, pkg, status: 'ready' });
    } else {
      const ls = localScore(job, profile);
      st.upsertMatch(jobId, { analysis: analysis ?? localAnalysis(job, profile, ls), pkg: templatePackage(profile, job), status: 'ready' });
    }
  } catch (e) {
    st.upsertMatch(jobId, { status: 'new', error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/** Fetches every enabled source, scores new jobs and auto-prepares the best ones. */
export async function runSearch(): Promise<{ found: number; fresh: number; ready: number }> {
  const store = useStore.getState();
  if (store.run.running) return { found: 0, fresh: 0, ready: 0 };
  const { settings, profile } = store;
  const c = ctx();
  const remoteOk = profile.prefs.workplaces.includes('remote');
  const sources = SOURCES.filter((s) => settings.sources[s.id] !== false && (!s.remoteOnly || remoteOk) && (!s.needsKey || (s.needsKey === 'jooble' ? settings.joobleKey : settings.serpapiKey)));
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
  const fresh: Job[] = [];
  const st = useStore.getState();
  for (const j of onlyQatar(all)) {
    const key = dedupeKey(j);
    if (st.jobs[j.id] || st.seenKeys[key]) continue;
    st.markSeen(key, j.id);
    fresh.push(j);
  }

  store.setRun({ step: 'score', done: 0, total: fresh.length });
  const scored = fresh
    .map((j) => ({ j, ls: localScore(j, profile) }))
    .filter((x) => !x.ls.blocked)
    .sort((a, b) => b.ls.score - a.ls.score);
  for (const { j, ls } of scored) {
    st.upsertJob(j);
    st.upsertMatch(j.id, { localScore: ls.score, analysis: localAnalysis(j, profile, ls) });
  }

  // Deep analysis on the strongest candidates only, to keep AI cost and time bounded.
  const threshold = Math.max(35, profile.prefs.minScore - 25);
  const candidates = scored.filter((x) => x.ls.score >= threshold).slice(0, settings.apiKey ? settings.maxAiPerRun : 15);
  store.setRun({ step: 'analyze', done: 0, total: candidates.length });
  let ready = 0;
  if (settings.autoPrepare) {
    await settle(candidates, settings.apiKey ? 3 : 4, async ({ j }) => {
      try {
        let job = await withDetail(j, c);
        useStore.getState().upsertJob(job);
        let score = localScore(job, profile).score;
        if (settings.apiKey) {
          const r = await analyzeJob({ apiKey: settings.apiKey, model: settings.model }, profile, job, settings.uiLang);
          job = { ...job, ...r.job };
          useStore.getState().upsertJob(job);
          useStore.getState().upsertMatch(j.id, { analysis: r.analysis });
          score = r.analysis.score;
        } else {
          useStore.getState().upsertMatch(j.id, { localScore: score, analysis: localAnalysis(job, profile, localScore(job, profile)) });
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

  useStore.getState().prune();
  useStore.getState().setLastRun(new Date().toISOString());
  useStore.getState().setRun({ running: false, step: '', errors });
  if (ready > 0 && settings.notifications) await notifyReady(ready);
  void syncBackground();
  return { found: all.length, fresh: fresh.length, ready };
}
