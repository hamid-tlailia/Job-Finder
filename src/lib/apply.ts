import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { ApplicationPackage, Channel, Job, Profile } from '../core/types';
import { buildCvPdf, buildLetterPdf } from './pdf';
import { loadFonts } from './fonts';
import { isNative } from './http';
import { Composer } from './composer';

function fileBase(p: Profile, job: Job, kind: string): string {
  const safe = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '').slice(0, 40);
  return `${safe(p.fullName) || 'CV'}_${kind}_${safe(job.company || job.title)}.pdf`;
}

export async function buildPdfs(p: Profile, job: Job, pkg: ApplicationPackage) {
  const fonts = await loadFonts();
  const cv = buildCvPdf(pkg.cv, fonts, pkg.template ?? 'classic');
  const letter = buildLetterPdf(pkg.cv, pkg.coverLetter, { company: job.company, jobTitle: job.title }, fonts, pkg.template ?? 'classic');
  return {
    cv: { name: fileBase(p, job, pkg.language === 'ar' ? 'سيرة' : 'CV'), data: cv.output('datauristring').split(',')[1], blob: cv.output('blob') },
    letter: { name: fileBase(p, job, pkg.language === 'ar' ? 'خطاب' : 'Cover_Letter'), data: letter.output('datauristring').split(',')[1], blob: letter.output('blob') },
  };
}

async function writeCache(name: string, data: string): Promise<string> {
  const r = await Filesystem.writeFile({ path: `apps/${name}`, data, directory: Directory.Cache, recursive: true });
  return r.uri;
}

function download(name: string, blob: Blob): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function previewPdf(p: Profile, job: Job, pkg: ApplicationPackage, which: 'cv' | 'letter'): Promise<void> {
  const files = await buildPdfs(p, job, pkg);
  const f = files[which];
  if (isNative) {
    const uri = await writeCache(f.name, f.data);
    await Share.share({ title: f.name, files: [uri], dialogTitle: f.name });
  } else {
    window.open(URL.createObjectURL(f.blob), '_blank');
  }
}

/** Opens the right app with everything filled in; the user only presses Send. */
export async function sendApplication(p: Profile, job: Job, pkg: ApplicationPackage, channel: Channel, target: string): Promise<'opened' | 'copied'> {
  const files = await buildPdfs(p, job, pkg);
  if (channel === 'email') {
    if (isNative) {
      const atts = [await writeCache(files.cv.name, files.cv.data), await writeCache(files.letter.name, files.letter.data)];
      await Composer.email({ to: target, subject: pkg.emailSubject, body: pkg.emailBody, attachments: atts });
    } else {
      download(files.cv.name, files.cv.blob);
      download(files.letter.name, files.letter.blob);
      window.location.href = `mailto:${encodeURIComponent(target)}?subject=${encodeURIComponent(pkg.emailSubject)}&body=${encodeURIComponent(pkg.emailBody)}`;
    }
    return 'opened';
  }
  if (channel === 'whatsapp') {
    const phone = target.replace(/\D/g, '');
    if (isNative) {
      const att = await writeCache(files.cv.name, files.cv.data);
      const r = await Composer.whatsapp({ phone, text: pkg.whatsappMessage, attachments: [att] });
      if (!r.opened) await Browser.open({ url: `https://wa.me/${phone}?text=${encodeURIComponent(pkg.whatsappMessage)}` });
    } else {
      download(files.cv.name, files.cv.blob);
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(pkg.whatsappMessage)}`, '_blank');
    }
    return 'opened';
  }
  // Website: the cover letter goes to the clipboard and the CV is saved, ready to upload in the form.
  await Clipboard.write({ string: pkg.coverLetter });
  if (isNative) {
    try {
      await Filesystem.writeFile({ path: `Download/${files.cv.name}`, data: files.cv.data, directory: Directory.ExternalStorage, recursive: true });
    } catch {
      const uri = await writeCache(files.cv.name, files.cv.data);
      await Share.share({ title: files.cv.name, files: [uri] });
    }
    await Browser.open({ url: target, presentationStyle: 'fullscreen' });
  } else {
    download(files.cv.name, files.cv.blob);
    window.open(target, '_blank');
  }
  return 'copied';
}

export async function copy(text: string): Promise<void> {
  await Clipboard.write({ string: text });
}
