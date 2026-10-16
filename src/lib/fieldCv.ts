import type { CvTemplate, Job, Lang, TailoredCv } from '../core/types';
import { baseCv, contactLine, personalLine } from '../core/template';
import { trackProfile } from '../core/match';
import { generateFieldCv } from '../ai/claude';
import { useStore, hasAi, aiCfg } from '../store/useStore';
import { buildCvPdf } from './pdf';
import { loadFonts } from './fonts';
import { sharePdf } from './apply';

/** Builds and shares a general CV for one career track (or the whole profile), in the chosen language and design. */
export async function downloadFieldCv(trackId: string | undefined, lang: Lang, template: CvTemplate): Promise<void> {
  const { profile, settings } = useStore.getState();
  const track = profile.tracks?.find((t) => t.id === trackId);
  const view = trackProfile(profile, track);
  let cv: TailoredCv;
  if (hasAi(settings)) {
    const r = await generateFieldCv(aiCfg(settings), { ...view, targetTitles: track?.targetTitles.length ? track.targetTitles : profile.targetTitles }, lang);
    cv = { ...r, language: lang, name: profile.fullName, contact: contactLine(profile, lang), personal: personalLine(profile, lang) };
  } else {
    const pseudoJob = { title: view.headline, description: view.targetTitles.join(' ') } as Job;
    cv = baseCv(view, pseudoJob, lang);
  }
  const doc = buildCvPdf(cv, await loadFonts(), template);
  const safe = (x: string) => x.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '').slice(0, 40);
  const name = `${safe(profile.fullName) || 'CV'}_${safe(track?.name || (lang === 'ar' ? 'سيرة' : 'CV'))}_${lang.toUpperCase()}.pdf`;
  await sharePdf(name, doc.output('datauristring').split(',')[1], doc.output('blob'));
}
