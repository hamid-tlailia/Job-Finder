import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { emptyFreelanceProfile, gigFresh, type FreelanceProfile, type Gig } from '../core/gigs';
import type { GigAnalysis, GigProposal } from '../ai/claude';

export type GigStatus = 'new' | 'drafting' | 'ready' | 'applied' | 'dismissed';

export interface GigMatch {
  gigId: string;
  status: GigStatus;
  localScore: number;
  hits: string[];
  analysis?: GigAnalysis;
  proposal?: GigProposal;
  error?: string;
  seen?: boolean;
  appliedAt?: string;
}

interface GigRun {
  running: boolean;
  step: string;
  errors: string[];
}

interface GigState {
  fp: FreelanceProfile;
  gigs: Record<string, Gig>;
  matches: Record<string, GigMatch>;
  lastRun?: string;
  run: GigRun;
  setFp: (p: Partial<FreelanceProfile>) => void;
  upsertGig: (g: Gig) => void;
  upsertMatch: (id: string, m: Partial<GigMatch>) => void;
  setRun: (r: Partial<GigRun>) => void;
  setLastRun: (iso: string) => void;
  prune: () => void;
}

/** Freelance data lives in its own store so the Qatar job profile and history stay untouched. */
export const useGigs = create<GigState>()(
  persist(
    (set) => ({
      fp: emptyFreelanceProfile(),
      gigs: {},
      matches: {},
      run: { running: false, step: '', errors: [] },
      setFp: (p) => set((s) => ({ fp: { ...s.fp, ...p } })),
      upsertGig: (g) => set((s) => ({ gigs: { ...s.gigs, [g.id]: { ...s.gigs[g.id], ...g } } })),
      upsertMatch: (id, m) =>
        set((s) => {
          const prev: GigMatch = s.matches[id] ?? { gigId: id, status: 'new', localScore: 0, hits: [] };
          return { matches: { ...s.matches, [id]: { ...prev, ...m } } };
        }),
      setRun: (r) => set((s) => ({ run: { ...s.run, ...r } })),
      setLastRun: (lastRun) => set({ lastRun }),
      // Applied projects stay for the record; everything else leaves once it is older than a week.
      prune: () =>
        set((s) => {
          const gigs: Record<string, Gig> = {};
          const matches: Record<string, GigMatch> = {};
          for (const m of Object.values(s.matches)) {
            const g = s.gigs[m.gigId];
            if (!g) continue;
            if (m.status === 'applied' || gigFresh(g, 7 * 24)) {
              gigs[g.id] = g;
              matches[m.gigId] = m;
            }
          }
          return { gigs, matches };
        }),
    }),
    {
      name: 'job-finder-gigs',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ run: _run, ...rest }) => rest,
      merge: (persisted, current) => {
        const p = persisted as Partial<GigState>;
        return { ...current, ...p, fp: { ...current.fp, ...p.fp, sources: { ...current.fp.sources, ...p.fp?.sources } } };
      },
    },
  ),
);

export const gigScore = (m: GigMatch) => m.analysis?.score ?? m.localScore;
