import type { Job, Lang, MasterCv, Profile } from '../core/types';
import { baseCv, plainDashes } from '../core/template';
import { trackProfile } from '../core/match';
import { generateFieldCv } from '../ai/claude';
import { aiCfg, hasAi, useStore } from '../store/useStore';
import { updateTrack } from './tracks';

/**
 * The CV of a career track (or of the whole profile) in one language. It is written once and reused for
 * every job of the track, so the person always sends, and can later review, the same document.
 */
export async function ensureMasterCv(trackId: string | undefined, lang: Lang): Promise<MasterCv> {
  const { profile, settings } = useStore.getState();
  const track = profile.tracks?.find((t) => t.id === trackId);
  const saved = (track ? track.masterCv : profile.masterCv)?.[lang];
  if (saved) return saved;
  const view: Profile = trackProfile(profile, track);
  let cv: MasterCv;
  if (hasAi(settings)) {
    const r = await generateFieldCv(aiCfg(settings), { ...view, targetTitles: track?.targetTitles.length ? track.targetTitles : profile.targetTitles }, lang);
    cv = {
      ...r,
      headline: plainDashes(r.headline, true),
      summary: plainDashes(r.summary),
      highlights: r.highlights?.map((h) => plainDashes(h)),
      experience: r.experience.map((e) => ({ ...e, bullets: e.bullets.map((b) => plainDashes(b)) })),
      languages: r.languages.map((l) => l.replace(/\s+[—–]\s+/, ' (').replace(/\($/, '') + (/\s+[—–]\s+/.test(l) ? ')' : '')),
      createdAt: new Date().toISOString(),
    };
  } else {
    const { language: _l, name: _n, contact: _c, personal: _p, ...rest } = baseCv(view, { title: view.headline, description: view.targetTitles.join(' ') } as Job, lang);
    cv = { ...rest, createdAt: new Date().toISOString() };
  }
  saveMasterCv(trackId, lang, cv);
  return cv;
}

export function saveMasterCv(trackId: string | undefined, lang: Lang, cv: MasterCv | undefined): void {
  const { profile, setProfile } = useStore.getState();
  const track = profile.tracks?.find((t) => t.id === trackId);
  if (track) updateTrack(track.id, { masterCv: { ...track.masterCv, [lang]: cv } });
  else setProfile({ masterCv: { ...profile.masterCv, [lang]: cv } });
}

/** Smart fix: adds a skill the person has to the track (search and future CVs) and to its saved CVs. */
export function addSkillToTrack(trackId: string | undefined, skill: string): void {
  const { profile, setProfile } = useStore.getState();
  const track = profile.tracks?.find((t) => t.id === trackId);
  const add = (list: string[]) => (list.some((x) => x.toLowerCase() === skill.toLowerCase()) ? list : [skill, ...list]);
  const patchCv = (m?: Partial<Record<Lang, MasterCv>>) =>
    m && (Object.fromEntries(Object.entries(m).map(([l, cv]) => [l, cv && { ...cv, skills: add(cv.skills), skillGroups: cv.skillGroups?.map((g, i) => (i === 0 ? { ...g, items: add(g.items) } : g)) }])) as Partial<Record<Lang, MasterCv>>);
  if (track) updateTrack(track.id, { skills: add(track.skills.length ? track.skills : profile.skills), masterCv: patchCv(track.masterCv) });
  else setProfile({ skills: add(profile.skills), masterCv: patchCv(profile.masterCv) });
}

/** Language of the application: the person's choice, else what the employer expects. */
export function applicationLang(p: Profile, job: Job, analysisLang?: Lang): Lang {
  if (p.prefs.cvLanguage !== 'auto') return p.prefs.cvLanguage;
  return analysisLang ?? (job.language === 'ar' ? 'ar' : 'en');
}
