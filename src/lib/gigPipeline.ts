import { GIG_SOURCES, gigFresh, gigWithDetail, localGigScore, type Gig } from '../core/gigs';
import { analyzeGig, writeProposal } from '../ai/claude';
import { aiCfg, hasAi, useStore } from '../store/useStore';
import { useGigs } from '../store/useGigs';
import { fetchText } from './http';
import { settle } from '../core/sources/util';
import { notifyGigs } from './notify';

/** Projects analysed by the AI per refresh; only the strongest local matches are sent. */
const MAX_ANALYSED = 10;

/** Writes (or rewrites) the proposal for one project. */
export async function draftProposal(id: string): Promise<void> {
  const st = useGigs.getState();
  const { settings } = useStore.getState();
  let g = st.gigs[id];
  if (!g) return;
  if (!hasAi(settings)) throw new Error(settings.uiLang === 'ar' ? 'أضف مفتاح Claude أو Gemini في الإعدادات لكتابة العروض.' : 'Add a Claude or Gemini key in Settings to write proposals.');
  st.upsertMatch(id, { status: 'drafting', error: undefined });
  try {
    g = await gigWithDetail(g, fetchText);
    st.upsertGig(g);
    let analysis = st.matches[id]?.analysis;
    if (!analysis) {
      analysis = await analyzeGig(aiCfg(settings, true), st.fp, g, settings.uiLang);
      st.upsertMatch(id, { analysis });
    }
    const proposal = await writeProposal(aiCfg(settings), useGigs.getState().fp, g, analysis);
    useGigs.getState().upsertMatch(id, { proposal, status: 'ready' });
  } catch (e) {
    useGigs.getState().upsertMatch(id, { status: 'new', error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/** Fetches new projects, scores them, analyses the best with AI and drafts proposals for the top few. */
export async function runGigSearch(extra: Gig[] = []): Promise<{ found: number; fresh: number; ready: number }> {
  const st = useGigs.getState();
  if (st.run.running) return { found: 0, fresh: 0, ready: 0 };
  const { settings } = useStore.getState();
  const fp = st.fp;
  const errors: string[] = [];
  st.setRun({ running: true, step: 'fetch', errors: [] });
  try {
    const all: Gig[] = [...extra];
    await settle(
      GIG_SOURCES.filter((s) => fp.sources[s.id] !== false),
      3,
      async (s) => {
        try {
          all.push(...(await s.search(fetchText)));
        } catch (e) {
          errors.push(`${s.label}: ${e instanceof Error ? e.message : e}`);
        }
      },
    );

    const fresh: { g: Gig; score: number; hits: string[] }[] = [];
    const seen = new Set<string>();
    for (const g of all) {
      if (seen.has(g.id) || useGigs.getState().matches[g.id] || !gigFresh(g)) continue;
      seen.add(g.id);
      const s = localGigScore(g, fp);
      if (s.blocked) continue;
      useGigs.getState().upsertGig(g);
      useGigs.getState().upsertMatch(g.id, { localScore: s.score, hits: s.hits });
      fresh.push({ g, score: s.score, hits: s.hits });
    }
    fresh.sort((a, b) => b.score - a.score);

    const strong: { id: string; score: number }[] = [];
    if (hasAi(settings)) {
      useGigs.getState().setRun({ step: 'analyze' });
      await settle(fresh.filter((x) => x.score >= 45).slice(0, MAX_ANALYSED), 3, async ({ g }) => {
        try {
          const full = await gigWithDetail(g, fetchText);
          useGigs.getState().upsertGig(full);
          const a = await analyzeGig(aiCfg(settings, true), fp, full, settings.uiLang);
          useGigs.getState().upsertMatch(g.id, { analysis: a });
          if (a.scamRisk === 'high') useGigs.getState().upsertMatch(g.id, { status: 'dismissed' });
          else if (a.score >= 65) strong.push({ id: g.id, score: a.score });
        } catch (e) {
          errors.push(`${g.title}: ${e instanceof Error ? e.message : e}`);
        }
      });
    }

    // Proposals cost the most, so only the best few are written; the rest have a "Write proposal" button.
    useGigs.getState().setRun({ step: 'draft' });
    const best = strong.sort((a, b) => b.score - a.score).slice(0, fp.autoDrafts);
    const readyIds: string[] = [];
    await settle(best, 2, async ({ id }) => {
      try {
        await draftProposal(id);
        readyIds.push(id);
      } catch (e) {
        errors.push(`${useGigs.getState().gigs[id]?.title ?? id}: ${e instanceof Error ? e.message : e}`);
      }
    });

    useGigs.getState().prune();
    useGigs.getState().setLastRun(new Date().toISOString());
    if (settings.notifications && readyIds.length) await notifyGigs(readyIds);
    return { found: all.length, fresh: fresh.length, ready: readyIds.length };
  } finally {
    useGigs.getState().setRun({ running: false, step: '', errors });
  }
}
