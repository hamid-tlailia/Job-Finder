import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CvTemplate, Job, MatchRecord, MatchStatus, Profile } from '../core/types';
import { emptyProfile } from './defaults';
import { inQatar, listable } from '../core/sources/util';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  uiLang: 'ar' | 'en';
  theme: ThemeMode;
  apiKey: string;
  model: string;
  joobleKey: string;
  serpapiKey: string;
  sources: Record<string, boolean>;
  autoPrepare: boolean;
  maxAiPerRun: number;
  notifications: boolean;
  backgroundMinutes: number;
  cvTemplate: 'auto' | CvTemplate;
  lastGoogleRun?: string;
}

export interface RunState {
  running: boolean;
  step: string;
  done: number;
  total: number;
  errors: string[];
}

interface State {
  onboarded: boolean;
  profile: Profile;
  settings: Settings;
  jobs: Record<string, Job>;
  matches: Record<string, MatchRecord>;
  seenKeys: Record<string, string>;
  lastRun?: string;
  run: RunState;
  setProfile: (p: Partial<Profile>) => void;
  setPrefs: (p: Partial<Profile['prefs']>) => void;
  setSettings: (s: Partial<Settings>) => void;
  finishOnboarding: () => void;
  upsertJob: (j: Job) => void;
  upsertMatch: (id: string, m: Partial<MatchRecord>) => void;
  setStatus: (id: string, status: MatchStatus) => void;
  setRun: (r: Partial<RunState>) => void;
  markSeen: (key: string, id: string) => void;
  setLastRun: (iso: string) => void;
  prune: () => void;
  reset: () => void;
}

const defaultSettings: Settings = {
  uiLang: 'ar',
  theme: 'system',
  apiKey: '',
  model: 'claude-opus-5-5',
  joobleKey: '',
  serpapiKey: '',
  sources: { linkedin: true, tanqeeb: true, workable: true, smartrecruiters: true, google: true, jooble: true, himalayas: true, remotive: true },
  autoPrepare: true,
  maxAiPerRun: 8,
  notifications: true,
  backgroundMinutes: 60,
  cvTemplate: 'auto',
};

const newMatch = (id: string): MatchRecord => ({ jobId: id, localScore: 0, status: 'new', seen: false, updatedAt: '' });

const idleRun: RunState = { running: false, step: '', done: 0, total: 0, errors: [] };

export const useStore = create<State>()(
  persist(
    (set) => ({
      onboarded: false,
      profile: emptyProfile(),
      settings: defaultSettings,
      jobs: {},
      matches: {},
      seenKeys: {},
      run: idleRun,
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      setPrefs: (p) => set((s) => ({ profile: { ...s.profile, prefs: { ...s.profile.prefs, ...p } } })),
      setSettings: (x) => set((s) => ({ settings: { ...s.settings, ...x } })),
      finishOnboarding: () => set({ onboarded: true }),
      upsertJob: (j) => set((s) => ({ jobs: { ...s.jobs, [j.id]: { ...s.jobs[j.id], ...j } } })),
      upsertMatch: (id, m) =>
        set((s) => ({
          matches: {
            ...s.matches,
            [id]: { ...newMatch(id), ...s.matches[id], ...m, updatedAt: new Date().toISOString() },
          },
        })),
      setStatus: (id, status) =>
        set((s) => ({
          matches: {
            ...s.matches,
            [id]: { ...s.matches[id], status, appliedAt: status === 'applied' ? new Date().toISOString() : s.matches[id]?.appliedAt, updatedAt: new Date().toISOString() },
          },
        })),
      setRun: (r) => set((s) => ({ run: { ...s.run, ...r } })),
      markSeen: (key, id) => set((s) => ({ seenKeys: { ...s.seenKeys, [key]: id } })),
      setLastRun: (iso) => set({ lastRun: iso }),
      prune: () =>
        set((s) => {
          // Anything the user acted on stays; everything else must still meet the listing rules.
          const keep = new Set(['ready', 'applied', 'saved', 'interview', 'offer', 'rejected', 'preparing']);
          const ranked = Object.values(s.matches).sort((a, b) => (b.analysis?.score ?? b.localScore) - (a.analysis?.score ?? a.localScore));
          const jobs: Record<string, Job> = {};
          const matches: Record<string, MatchRecord> = {};
          let kept = 0;
          for (const m of ranked) {
            const j = s.jobs[m.jobId];
            if (!j) continue;
            const ok = listable([j]).length > 0;
            if (keep.has(m.status) || (ok && m.status !== 'dismissed' && kept < 300)) {
              jobs[j.id] = j;
              matches[m.jobId] = m;
              kept++;
            }
          }
          return { jobs, matches };
        }),
      reset: () => set({ onboarded: false, profile: emptyProfile(), jobs: {}, matches: {}, seenKeys: {}, lastRun: undefined }),
    }),
    {
      name: 'job-finder',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ run: _run, ...rest }) => rest,
      merge: (persisted, current) => {
        const p = persisted as Partial<State>;
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...p.settings, sources: { ...current.settings.sources, ...p.settings?.sources } },
          profile: { ...current.profile, ...p.profile, prefs: { ...current.profile.prefs, ...p.profile?.prefs } },
        };
      },
    },
  ),
);

/** Fit score shown to the user; a job outside Qatar always scores 0. */
export const scoreOf = (m: MatchRecord, job?: Job) => (job && !inQatar(job) ? 0 : m.analysis?.score ?? m.localScore);
