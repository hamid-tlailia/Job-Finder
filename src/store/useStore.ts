import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CvTemplate, Job, MatchRecord, MatchStatus, Profile } from '../core/types';
import type { ProfileSuggestion } from '../ai/claude';
import { emptyProfile } from './defaults';
import { inQatar, listable } from '../core/sources/util';
import { avoidedIndustry } from '../core/industries';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  uiLang: 'ar' | 'en';
  theme: ThemeMode;
  apiKey: string;
  /** Which AI writes and scores: Claude (Anthropic) or Gemini (Google). */
  aiProvider: 'claude' | 'gemini';
  geminiKey: string;
  geminiModel: string;
  geminiFastModel: string;
  model: string;
  joobleKey: string;
  serpapiKey: string;
  sources: Record<string, boolean>;
  autoPrepare: boolean;
  maxAiPerRun: number;
  /** Applications written automatically per search; the rest wait for a tap on "Prepare". */
  maxPreparePerRun: number;
  notifications: boolean;
  backgroundMinutes: number;
  cvTemplate: 'auto' | CvTemplate;
  /** Cheaper model for high-volume job analysis; the main model writes CVs and letters. */
  fastModel: string;
  lastGoogleRun?: string;
  /** Queries of the last search; a changed profile or track may search again without waiting. */
  lastSearchKey?: string;
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
  /** AI comparison of the uploaded CV with the profile, waiting for the user to accept or dismiss. */
  suggestions: ProfileSuggestion[];
  /** Profile as it was before the last AI polish, for undo. */
  profileBackup?: Profile;
  setProfileBackup: (p?: Profile) => void;
  reviewedAt?: string;
  reviewing: boolean;
  setSuggestions: (s: ProfileSuggestion[], reviewedAt?: string) => void;
  dropSuggestion: (id: string) => void;
  setReviewing: (v: boolean) => void;
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
  aiProvider: 'claude',
  geminiKey: '',
  geminiModel: 'gemini-3.8-flash',
  geminiFastModel: 'gemini-3.5-flash-lite',
  model: 'claude-sonnet-5-5',
  joobleKey: '',
  serpapiKey: '',
  sources: { linkedin: true, tanqeeb: true, workable: true, smartrecruiters: true, google: true, jooble: true, himalayas: true, remotive: true },
  autoPrepare: true,
  maxAiPerRun: 8,
  maxPreparePerRun: 3,
  notifications: true,
  backgroundMinutes: 60,
  cvTemplate: 'auto',
  fastModel: 'claude-haiku-5-5',
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
      suggestions: [],
      reviewing: false,
      setProfileBackup: (profileBackup) => set({ profileBackup }),
      setSuggestions: (suggestions, reviewedAt) => set((s) => ({ suggestions, reviewedAt: reviewedAt ?? s.reviewedAt })),
      dropSuggestion: (id) => set((s) => ({ suggestions: s.suggestions.filter((x) => x.id !== id) })),
      setReviewing: (reviewing) => set({ reviewing }),
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
            const ok = listable([j]).length > 0 && !avoidedIndustry(j, s.profile.prefs.avoidIndustries);
            if (keep.has(m.status) || (ok && m.status !== 'dismissed' && kept < 300)) {
              jobs[j.id] = j;
              matches[m.jobId] = m;
              kept++;
            }
          }
          return { jobs, matches };
        }),
      reset: () => set({ onboarded: false, profile: emptyProfile(), jobs: {}, matches: {}, seenKeys: {}, lastRun: undefined, suggestions: [], reviewedAt: undefined }),
    }),
    {
      name: 'job-finder',
      version: 3,
      // v2: earlier versions also remembered unrelated jobs as seen, which hid them from tracks added later.
      // v3: applications are written with Sonnet 5.5 by default (about half the cost of Opus); Opus stays selectable.
      migrate: (persisted, version) => {
        const p = persisted as Partial<State>;
        if (version < 2 && p) p.seenKeys = Object.fromEntries(Object.entries(p.seenKeys ?? {}).filter(([, id]) => p.jobs?.[id]));
        if (version < 3 && p?.settings?.model === 'claude-opus-5-5') p.settings = { ...p.settings, model: 'claude-sonnet-5-5' };
        return p as State;
      },
      storage: createJSONStorage(() => localStorage),
      partialize: ({ run: _run, reviewing: _reviewing, ...rest }) => rest,
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

/** True when the selected AI provider has a key. */
export const hasAi = (s: Settings): boolean => !!(s.aiProvider === 'gemini' ? s.geminiKey : s.apiKey);

/** Key and model for an AI call with the selected provider; `fast` picks the bulk-analysis model. */
export function aiCfg(s: Settings, fast = false): { apiKey: string; model: string } {
  if (s.aiProvider === 'gemini') return { apiKey: s.geminiKey, model: (fast ? s.geminiFastModel : s.geminiModel) || s.geminiModel };
  return { apiKey: s.apiKey, model: (fast ? s.fastModel : s.model) || s.model };
}

/** Fit score shown to the user; a job outside Qatar always scores 0. */
/** Stable empty array for selectors (a fresh [] each render makes zustand re-render forever). */
export const EMPTY: never[] = [];

export const scoreOf = (m: MatchRecord, job?: Job) => (job && !inQatar(job) ? 0 : m.analysis?.score ?? m.localScore);
