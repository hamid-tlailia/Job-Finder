import { polishProfile, type PolishResult } from '../ai/claude';
import { useStore } from '../store/useStore';
import { syncBackground } from './background';

export async function runPolish(): Promise<PolishResult> {
  const { profile, settings } = useStore.getState();
  return polishProfile({ apiKey: settings.apiKey, model: settings.model }, profile, settings.uiLang);
}

/** Applies a polish result, keeping the previous profile for one-step undo. */
export function applyPolish(r: PolishResult): void {
  const { profile, setProfile, setProfileBackup } = useStore.getState();
  setProfileBackup(profile);
  setProfile({
    headline: r.headline || profile.headline,
    summary: r.summary || profile.summary,
    targetTitles: r.targetTitles.length ? r.targetTitles : profile.targetTitles,
    skills: r.skills.length ? r.skills : profile.skills,
    experience: r.experience.length ? r.experience : profile.experience,
    education: r.education.length ? r.education : profile.education,
    certifications: r.certifications,
    languages: r.languages.length ? r.languages : profile.languages,
    tracks: (profile.tracks ?? []).map((t) => {
      const u = r.tracks.find((x) => x.id === t.id);
      return u ? { ...t, name: u.name || t.name, headline: u.headline || t.headline, summary: u.summary || t.summary, targetTitles: u.targetTitles.length ? u.targetTitles : t.targetTitles, skills: u.skills.length ? u.skills : t.skills, keywords: u.keywords } : t;
    }),
  });
  void syncBackground();
}

export function undoPolish(): void {
  const { profileBackup, setProfile, setProfileBackup } = useStore.getState();
  if (!profileBackup) return;
  setProfile(profileBackup);
  setProfileBackup(undefined);
  void syncBackground();
}
