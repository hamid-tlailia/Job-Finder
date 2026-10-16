import type { Profile } from '../core/types';
import { reviewProfile, type ProfileSuggestion } from '../ai/claude';
import { useStore, hasAi, aiCfg } from '../store/useStore';
import { syncBackground } from './background';
import { addTrack } from './tracks';

export type Section = ProfileSuggestion['section'];

/** Runs the AI comparison between the stored CV text and the profile. */
export async function runProfileReview(): Promise<number> {
  const { profile, settings, setSuggestions, setReviewing } = useStore.getState();
  if (!hasAi(settings) || profile.cvText.trim().length < 80) return 0;
  setReviewing(true);
  try {
    const list = await reviewProfile(aiCfg(settings), profile, settings.uiLang);
    setSuggestions(list, new Date().toISOString());
    return list.length;
  } finally {
    setReviewing(false);
  }
}

const norm = (x: string) => x.trim().toLowerCase();
const addUnique = (cur: string[], add: string[]) => [...cur, ...add.filter((a) => a.trim() && !cur.some((c) => norm(c) === norm(a)))];

function put<T>(list: T[], item: T, index: number | null): T[] {
  if (index !== null && index >= 0 && index < list.length) return list.map((x, i) => (i === index ? item : x));
  return [...list, item];
}

/** Applies one suggestion to the profile and removes it from the list. */
export function applySuggestion(s: ProfileSuggestion): void {
  const { profile: p, setProfile, dropSuggestion } = useStore.getState();
  const patch: Partial<Profile> = {};
  switch (s.field) {
    case 'targetTitles':
    case 'skills':
    case 'certifications':
      if (s.items?.length) patch[s.field] = addUnique(p[s.field], s.items);
      break;
    case 'yearsExperience':
      if (s.years !== null) patch.yearsExperience = Math.round(s.years);
      break;
    case 'experience':
      if (s.experience) patch.experience = put(p.experience, s.experience, s.replaceIndex);
      break;
    case 'education':
      if (s.education) patch.education = put(p.education, s.education, s.replaceIndex);
      break;
    case 'languages':
      if (s.language) patch.languages = put(p.languages, s.language, s.replaceIndex);
      break;
    default:
      if (s.text) patch[s.field] = s.text;
  }
  setProfile(patch);
  dropSuggestion(s.id);
  void syncBackground();
}

export function applyAll(section?: Section): void {
  for (const s of useStore.getState().suggestions.filter((x) => !section || x.section === section)) applySuggestion(s);
}

/** Short human preview of what accepting a suggestion would put in the profile. */
export function preview(s: ProfileSuggestion): string {
  if (s.text) return s.text;
  if (s.items?.length) return s.items.join('، ');
  if (s.years !== null) return String(s.years);
  if (s.experience) return [s.experience.title, s.experience.company, [s.experience.start, s.experience.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · ');
  if (s.education) return [s.education.degree, s.education.school, s.education.year].filter(Boolean).join(' · ');
  if (s.language) return `${s.language.name} — ${s.language.level}`;
  return '';
}

/** Profile gaps detectable without AI. */
export function localGaps(p: Profile): { section: Section; key: 'phone' | 'email' | 'titles' | 'skills' | 'experience' | 'education' | 'languages' | 'cv' }[] {
  const gaps: { section: Section; key: 'phone' | 'email' | 'titles' | 'skills' | 'experience' | 'education' | 'languages' | 'cv' }[] = [];
  if (!p.phone.trim()) gaps.push({ section: 'basics', key: 'phone' });
  if (!p.email.trim()) gaps.push({ section: 'basics', key: 'email' });
  if (!p.targetTitles.length) gaps.push({ section: 'goals', key: 'titles' });
  if (p.skills.length < 4) gaps.push({ section: 'goals', key: 'skills' });
  if (!p.experience.length) gaps.push({ section: 'experience', key: 'experience' });
  if (!p.education.length) gaps.push({ section: 'education', key: 'education' });
  if (!p.languages.length) gaps.push({ section: 'languages', key: 'languages' });
  if (p.cvText.trim().length < 80) gaps.push({ section: 'basics', key: 'cv' });
  return gaps;
}

/** Fields that describe one career field (pitch) rather than shared facts. */
export const PITCH_FIELDS = ['headline', 'summary', 'targetTitles'] as const;
export const isPitch = (s: ProfileSuggestion) => (PITCH_FIELDS as readonly string[]).includes(s.field);

/** Current profile value a suggestion would change, for side-by-side display. */
export function currentValue(s: ProfileSuggestion, p: Profile): string {
  switch (s.field) {
    case 'targetTitles':
    case 'skills':
    case 'certifications':
      return p[s.field].join('، ');
    case 'yearsExperience':
      return String(p.yearsExperience);
    case 'experience':
    case 'education':
    case 'languages':
      return '';
    default:
      return String(p[s.field] ?? '');
  }
}

/**
 * Turns the CV's field-specific pitch (title, summary, job titles, extra skills) into a new career
 * track instead of overwriting the shared profile. Returns the new track id.
 */
export function createTrackFromSuggestions(): string | undefined {
  const { suggestions, profile, dropSuggestion } = useStore.getState();
  const pitch = suggestions.filter(isPitch);
  const pick = (f: string) => pitch.find((s) => s.field === f);
  const headline = pick('headline')?.text ?? '';
  const skills = suggestions.find((s) => s.field === 'skills')?.items ?? [];
  const track = addTrack({
    name: headline.split(/[|&,–-]/)[0].trim().slice(0, 30),
    headline,
    summary: pick('summary')?.text ?? '',
    targetTitles: pick('targetTitles')?.items ?? (headline ? [headline] : []),
    skills,
    cvText: profile.cvText,
    cvName: 'CV',
  });
  if (!track) return undefined;
  for (const s of pitch) dropSuggestion(s.id);
  return track.id;
}
