import { jsPDF } from 'jspdf';
import type { Lang, TailoredCv } from '../core/types';

export interface PdfFonts {
  regular: string;
  bold: string;
}

const ACCENT: [number, number, number] = [138, 21, 56];
const GOLD: [number, number, number] = [176, 141, 87];
const INK: [number, number, number] = [28, 28, 34];
const MUTED: [number, number, number] = [102, 102, 112];

const L = {
  en: { summary: 'Profile', skills: 'Core Skills', experience: 'Experience', education: 'Education', certifications: 'Certifications', languages: 'Languages', present: 'Present' },
  ar: { summary: 'نبذة مهنية', skills: 'المهارات الأساسية', experience: 'الخبرات العملية', education: 'التعليم', certifications: 'الشهادات', languages: 'اللغات', present: 'حتى الآن' },
};

class Writer {
  doc: jsPDF;
  y = 18;
  readonly m = 16;
  readonly w: number;
  readonly h: number;
  readonly rtl: boolean;

  constructor(fonts: PdfFonts, lang: Lang) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.doc.addFileToVFS('Plex-Regular.ttf', fonts.regular);
    this.doc.addFileToVFS('Plex-Bold.ttf', fonts.bold);
    this.doc.addFont('Plex-Regular.ttf', 'Plex', 'normal');
    this.doc.addFont('Plex-Bold.ttf', 'Plex', 'bold');
    this.doc.setFont('Plex', 'normal');
    this.w = this.doc.internal.pageSize.getWidth();
    this.h = this.doc.internal.pageSize.getHeight();
    this.rtl = lang === 'ar';
    if (this.rtl) this.doc.setR2L(false);
  }

  get x0(): number {
    return this.rtl ? this.w - this.m : this.m;
  }

  ensure(space: number): void {
    if (this.y + space > this.h - 14) {
      this.doc.addPage();
      this.y = 18;
    }
  }

  text(s: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; gap?: number; maxWidth?: number } = {}): void {
    const { size = 10, bold = false, color = INK, indent = 0, gap = 1.2 } = opts;
    const d = this.doc;
    d.setFont('Plex', bold ? 'bold' : 'normal');
    d.setFontSize(size);
    d.setTextColor(...color);
    const width = (opts.maxWidth ?? this.w - this.m * 2) - indent;
    const lines = d.splitTextToSize(s, width) as string[];
    const lh = size * 0.3528 * 1.45;
    for (const line of lines) {
      this.ensure(lh);
      const x = this.rtl ? this.x0 - indent : this.x0 + indent;
      d.text(line, x, this.y, this.rtl ? { align: 'right', isInputVisual: false, isOutputVisual: true, isInputRtl: true, isOutputRtl: false } as never : undefined);
      this.y += lh;
    }
    this.y += gap;
  }

  /** Draws short items on one row; each item keeps its own direction so phone numbers are not mirrored. */
  row(items: string[], size: number, color: [number, number, number]): void {
    const d = this.doc;
    d.setFont('Plex', 'normal');
    d.setFontSize(size);
    d.setTextColor(...color);
    const sep = '   •   ';
    const sepW = d.getTextWidth(sep);
    let x = this.x0;
    for (const [i, item] of items.entries()) {
      const isAr = /[\u0600-\u06FF]/.test(item);
      const iw = d.getTextWidth(item);
      if (this.rtl) {
        if (x - iw < this.m) {
          this.y += size * 0.3528 * 1.45;
          x = this.x0;
        }
        d.text(item, x, this.y, (isAr ? { align: 'right', isInputVisual: false, isOutputVisual: true, isInputRtl: true, isOutputRtl: false } : { align: 'right' }) as never);
        x -= iw;
        if (i < items.length - 1) {
          d.text(sep, x, this.y, { align: 'right' });
          x -= sepW;
        }
      } else {
        if (x + iw > this.w - this.m) {
          this.y += size * 0.3528 * 1.45;
          x = this.x0;
        }
        d.text(item, x, this.y);
        x += iw;
        if (i < items.length - 1) {
          d.text(sep, x, this.y);
          x += sepW;
        }
      }
    }
    this.y += size * 0.3528 * 1.45;
  }

  section(title: string): void {
    this.ensure(14);
    this.y += 3;
    this.text(title.toUpperCase(), { size: 10.5, bold: true, color: ACCENT, gap: 0 });
    const d = this.doc;
    d.setDrawColor(...GOLD);
    d.setLineWidth(0.4);
    d.line(this.m, this.y - 1.2, this.w - this.m, this.y - 1.2);
    this.y += 2.5;
  }

  bullet(s: string): void {
    const d = this.doc;
    this.ensure(5);
    d.setFillColor(...GOLD);
    const bx = this.rtl ? this.x0 - 1.2 : this.x0 + 1.2;
    d.circle(bx, this.y - 1.1, 0.6, 'F');
    this.text(s, { size: 9.5, indent: 4.5, gap: 0.6 });
  }
}

export function buildCvPdf(cv: TailoredCv, fonts: PdfFonts): jsPDF {
  const t = L[cv.language];
  const w = new Writer(fonts, cv.language);
  const d = w.doc;

  d.setFillColor(...ACCENT);
  d.rect(0, 0, w.w, 3, 'F');
  w.y = 20;
  w.text(cv.name, { size: 22, bold: true, gap: 0 });
  w.text(cv.headline, { size: 12, color: ACCENT, gap: 0.5 });
  w.row(cv.contact, 8.8, MUTED);
  w.y += 2;

  if (cv.summary) {
    w.section(t.summary);
    w.text(cv.summary, { size: 9.8 });
  }
  if (cv.skills.length) {
    w.section(t.skills);
    w.text(cv.skills.join('   ·   '), { size: 9.5 });
  }
  if (cv.experience.length) {
    w.section(t.experience);
    for (const e of cv.experience) {
      w.ensure(16);
      w.text(`${e.title} — ${e.company}`, { size: 10.5, bold: true, gap: 0 });
      w.text([`${e.start} – ${e.end || t.present}`, e.location].filter(Boolean).join('  |  '), { size: 8.8, color: MUTED, gap: 1 });
      for (const b of e.bullets) w.bullet(b);
      w.y += 2;
    }
  }
  if (cv.education.length) {
    w.section(t.education);
    for (const e of cv.education) {
      w.text(e.degree, { size: 10, bold: true, gap: 0 });
      w.text([e.school, e.year].filter(Boolean).join('  |  '), { size: 9, color: MUTED, gap: 1.5 });
    }
  }
  if (cv.certifications.length) {
    w.section(t.certifications);
    for (const c of cv.certifications) w.bullet(c);
  }
  if (cv.languages.length) {
    w.section(t.languages);
    w.text(cv.languages.join('   ·   '), { size: 9.5 });
  }
  return d;
}

export function buildLetterPdf(name: string, contact: string[], body: string, lang: Lang, fonts: PdfFonts): jsPDF {
  const w = new Writer(fonts, lang);
  w.doc.setFillColor(...ACCENT);
  w.doc.rect(0, 0, w.w, 3, 'F');
  w.y = 20;
  w.text(name, { size: 18, bold: true, gap: 0 });
  w.row(contact, 8.8, MUTED);
  w.y += 4;
  w.text(new Date().toLocaleDateString(lang === 'ar' ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), { size: 9.5, color: MUTED, gap: 4 });
  for (const para of body.split(/\n{2,}/)) w.text(para.trim(), { size: 10.5, gap: 3 });
  return w.doc;
}
