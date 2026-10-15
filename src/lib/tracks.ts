import { MAX_TRACKS, type CareerTrack } from '../core/types';
import { parseTrackCv, reviewProfile, suggestTracks, type TrackDraft } from '../ai/claude';
import { useStore } from '../store/useStore';
import { syncBackground } from './background';
import { readCvFile } from './cvImport';

const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const norm = (x: string) => x.trim().toLowerCase();
const merge = (a: string[], b: string[]) => [...a, ...b.filter((x) => x.trim() && !a.some((y) => norm(y) === norm(x)))];

function save(tracks: CareerTrack[]): void {
  useStore.getState().setProfile({ tracks });
  void syncBackground();
}

export function addTrack(draft: Partial<CareerTrack> = {}): CareerTrack | undefined {
  const tracks = useStore.getState().profile.tracks ?? [];
  if (tracks.length >= MAX_TRACKS) return undefined;
  const t: CareerTrack = { id: newId(), name: '', targetTitles: [], headline: '', summary: '', skills: [], cvText: '', ...draft };
  save([...tracks, t]);
  return t;
}

export function updateTrack(id: string, patch: Partial<CareerTrack>): void {
  save((useStore.getState().profile.tracks ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function removeTrack(id: string): void {
  save((useStore.getState().profile.tracks ?? []).filter((t) => t.id !== id));
}

/** Asks the AI to split the person's history into career tracks and adds the new ones. */
export async function autoTracks(): Promise<number> {
  const { profile, settings } = useStore.getState();
  const room = MAX_TRACKS - (profile.tracks ?? []).length;
  if (room <= 0) return 0;
  const drafts = await suggestTracks({ apiKey: settings.apiKey, model: settings.model }, profile, settings.uiLang, room);
  for (const d of drafts) addTrack({ ...d, cvText: '' });
  return drafts.length;
}

/**
 * Stores the CV for one track, fills the track's empty fields from it, and queues profile
 * suggestions for anything in that CV missing from the shared profile (e.g. a job only listed there).
 */
export async function importTrackCv(id: string, file: File): Promise<{ filled: boolean; suggestions: number }> {
  const cvText = await readCvFile(file);
  updateTrack(id, { cvText, cvName: file.name });
  const { settings, profile } = useStore.getState();
  if (!settings.apiKey) return { filled: false, suggestions: 0 };
  const cfg = { apiKey: settings.apiKey, model: settings.model };
  const track = (profile.tracks ?? []).find((t) => t.id === id);
  const d: TrackDraft = await parseTrackCv(cfg, cvText, settings.uiLang);
  if (track) {
    updateTrack(id, {
      name: track.name || d.name,
      headline: track.headline || d.headline,
      summary: track.summary || d.summary,
      targetTitles: merge(track.targetTitles, d.targetTitles),
      skills: merge(track.skills, d.skills),
    });
  }
  const st = useStore.getState();
  st.setReviewing(true);
  try {
    const found = await reviewProfile(cfg, st.profile, settings.uiLang, cvText);
    // Field-specific pitch belongs to the track; only shared facts go to the profile.
    const shared = found.filter((s) => !['headline', 'summary', 'targetTitles'].includes(s.field));
    const existing = useStore.getState().suggestions;
    st.setSuggestions([...existing, ...shared.filter((s) => !existing.some((e) => e.id === s.id))], new Date().toISOString());
    return { filled: true, suggestions: shared.length };
  } finally {
    st.setReviewing(false);
  }
}
