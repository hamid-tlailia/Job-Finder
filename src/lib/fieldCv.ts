import type { CvTemplate, Lang, TailoredCv } from '../core/types';
import { contactLine, personalLine } from '../core/template';
import { useStore } from '../store/useStore';
import { buildCvPdf, pdfFile } from './pdf';
import { loadFonts } from './fonts';
import { cvFileName, sharePdf } from './apply';
import { ensureMasterCv, saveMasterCv } from './masterCv';

/**
 * Shares the CV of one career track (or the whole profile): the same saved CV that is sent with every
 * application of the track. `fresh` rewrites it first (after the profile or track changed).
 */
export async function downloadFieldCv(trackId: string | undefined, lang: Lang, template: CvTemplate, fresh = false): Promise<void> {
  if (fresh) saveMasterCv(trackId, lang, undefined);
  const master = await ensureMasterCv(trackId, lang);
  const { profile } = useStore.getState();
  const { createdAt: _c, ...body } = master;
  const cv: TailoredCv = { ...body, language: lang, name: profile.fullName, contact: contactLine(profile, lang), personal: personalLine(profile, lang) };
  const file = pdfFile(buildCvPdf(cv, await loadFonts(), template), profile.fullName, lang === 'ar' ? 'السيرة الذاتية' : 'Curriculum Vitae');
  await sharePdf(cvFileName(profile, trackId, lang), file.data, file.blob);
}
