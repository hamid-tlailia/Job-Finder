import { jsPDF } from 'jspdf';
import type { Lang, TailoredCv } from '../core/types';

export interface PdfFonts {
  regular: string;
  bold: string;
}

type Rgb = [number, number, number];

// Restrained, print-safe palette: near-black text, one accent for headings and rules.
const INK: Rgb = [26, 32, 44];
const BODY: Rgb = [45, 52, 64];
const MUTED: Rgb = [100, 108, 120];
const ACCENT: Rgb = [122, 18, 50];
const RULE: Rgb = [205, 208, 214];

const L = {
  en: { summary: 'Professional Summary', skills: 'Core Competencies', experience: 'Professional Experience', education: 'Education', certifications: 'Certifications', languages: 'Languages', present: 'Present', page: 'Page', of: 'of', to: 'To', hiring: 'Hiring Manager', re: 'Re: Application for', qatar: 'Doha, Qatar' },
  ar: { summary: 'الملخص المهني', skills: 'الكفاءات الأساسية', experience: 'الخبرة المهنية', education: 'التعليم', certifications: 'الشهادات المهنية', languages: 'اللغات', present: 'حتى الآن', page: 'صفحة', of: 'من', to: 'إلى', hiring: 'مدير التوظيف', re: 'الموضوع: طلب التقدم لوظيفة', qatar: 'الدوحة، قطر' },
};

const AR = /[؀-ۿ]/;
const RTL_OPTS = { isInputVisual: false, isOutputVisual: true, isInputRtl: true, isOutputRtl: false };
const PT = 0.3528; // mm per point

class Page {
  doc: jsPDF;
  y = 0;
  readonly mx = 18;
  readonly top = 16;
  readonly bottom = 16;
  readonly W: number;
  readonly H: number;
  readonly rtl: boolean;

  constructor(fonts: PdfFonts, lang: Lang) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.doc.addFileToVFS('Plex-Regular.ttf', fonts.regular);
    this.doc.addFileToVFS('Plex-Bold.ttf', fonts.bold);
    this.doc.addFont('Plex-Regular.ttf', 'Plex', 'normal');
    this.doc.addFont('Plex-Bold.ttf', 'Plex', 'bold');
    this.W = this.doc.internal.pageSize.getWidth();
    this.H = this.doc.internal.pageSize.getHeight();
    this.rtl = lang === 'ar';
    this.y = this.top;
  }

  get inner(): number {
    return this.W - this.mx * 2;
  }
  /** x of the reading-start edge (left in LTR, right in RTL). */
  get start(): number {
    return this.rtl ? this.W - this.mx : this.mx;
  }
  /** x of the reading-end edge. */
  get end(): number {
    return this.rtl ? this.mx : this.W - this.mx;
  }
  /** Moves `d` mm along the reading direction from x. */
  fwd(x: number, d: number): number {
    return this.rtl ? x - d : x + d;
  }

  font(size: number, bold = false, color: Rgb = BODY): void {
    this.doc.setFont('Plex', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
  }

  lh(size: number, factor = 1.42): number {
    return size * PT * factor;
  }

  /** Draws one line; `at` is 'start' or 'end' edge semantics relative to reading direction. */
  put(text: string, x: number, y: number, at: 'start' | 'end' = 'start'): void {
    const alignRight = (this.rtl && at === 'start') || (!this.rtl && at === 'end');
    const opts: Record<string, unknown> = { align: alignRight ? 'right' : 'left' };
    if (AR.test(text)) Object.assign(opts, RTL_OPTS);
    this.doc.text(text, x, y, opts as never);
  }

  width(text: string): number {
    return this.doc.getTextWidth(text);
  }

  wrap(text: string, w: number): string[] {
    return this.doc.splitTextToSize(text, w) as string[];
  }

  room(h: number): void {
    if (this.y + h > this.H - this.bottom) {
      this.doc.addPage();
      this.y = this.top + 4;
    }
  }

  rule(color: Rgb = RULE, weight = 0.25): void {
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(weight);
    this.doc.line(this.mx, this.y, this.W - this.mx, this.y);
  }

  /** Paragraph wrapped to the column, starting `indent` mm in from the start edge. */
  para(text: string, size: number, opts: { bold?: boolean; color?: Rgb; indent?: number; width?: number; after?: number; factor?: number } = {}): void {
    const { bold = false, color = BODY, indent = 0, after = 0, factor = 1.42 } = opts;
    this.font(size, bold, color);
    const lines = this.wrap(text, (opts.width ?? this.inner) - indent);
    const lh = this.lh(size, factor);
    for (const line of lines) {
      this.room(lh);
      this.put(line, this.fwd(this.start, indent), this.y + size * PT * 0.8);
      this.y += lh;
    }
    this.y += after;
  }

  /** Items separated by a thin divider, wrapping as needed; each item keeps its own direction. */
  inline(items: string[], size: number, color: Rgb, sep = '|'): void {
    this.font(size, false, color);
    const gap = 2.4;
    const sepW = this.width(sep);
    const lh = this.lh(size, 1.5);
    let x = this.start;
    let used = 0;
    this.room(lh);
    for (const [i, item] of items.entries()) {
      const w = this.width(item);
      if (used > 0 && used + w > this.inner) {
        this.y += lh;
        this.room(lh);
        x = this.start;
        used = 0;
      }
      this.font(size, false, color);
      this.put(item, x, this.y + size * PT * 0.8);
      x = this.fwd(x, w);
      used += w;
      if (i < items.length - 1) {
        this.doc.setTextColor(...RULE);
        this.put(sep, this.fwd(x, gap), this.y + size * PT * 0.8);
        x = this.fwd(x, gap * 2 + sepW);
        used += gap * 2 + sepW;
      }
    }
    this.y += lh;
  }

  section(title: string): void {
    this.room(18);
    this.y += 4.2;
    this.font(10.5, true, ACCENT);
    const label = this.rtl ? title : title.toUpperCase();
    if (this.rtl) this.put(label, this.start, this.y + 10.5 * PT * 0.8);
    else this.doc.text(label, this.start, this.y + 10.5 * PT * 0.8, { charSpace: 0.45 });
    this.y += this.lh(10.5, 1.25);
    this.rule(ACCENT, 0.35);
    this.y += 2.6;
  }

  /** Bold left text with a muted right-aligned note (e.g. job title + dates) on one baseline. */
  row(main: string, note: string, size = 10.5): void {
    this.font(9, false, MUTED);
    const nw = note ? this.width(note) + 4 : 0;
    this.font(size, true, INK);
    const lines = this.wrap(main, this.inner - nw);
    const lh = this.lh(size, 1.35);
    this.room(lh * lines.length + 10);
    const base = this.y + size * PT * 0.8;
    lines.forEach((l, i) => this.put(l, this.start, base + i * lh));
    if (note) {
      this.font(9, false, MUTED);
      this.put(note, this.end, base, 'end');
    }
    this.y += lh * lines.length;
  }

  bullet(text: string, size = 9.8): void {
    const indent = 4.2;
    this.font(size, false, BODY);
    const lines = this.wrap(text, this.inner - indent);
    const lh = this.lh(size, 1.38);
    this.room(lh * Math.min(lines.length, 2));
    this.doc.setFillColor(...ACCENT);
    const cy = this.y + size * PT * 0.8 - size * PT * 0.3;
    this.doc.rect(this.fwd(this.start, 1.1) - 0.55, cy - 0.55, 1.1, 1.1, 'F');
    for (const l of lines) {
      this.room(lh);
      this.font(size, false, BODY);
      this.put(l, this.fwd(this.start, indent), this.y + size * PT * 0.8);
      this.y += lh;
    }
    this.y += 0.8;
  }

  /** Lays out short items in `cols` columns, filling across in reading order. */
  grid(items: string[], cols: number, size = 9.6): void {
    const colW = this.inner / cols;
    const lh = this.lh(size, 1.5);
    for (let i = 0; i < items.length; i += cols) {
      this.room(lh);
      items.slice(i, i + cols).forEach((it, c) => {
        const x = this.fwd(this.start, c * colW);
        this.doc.setFillColor(...ACCENT);
        this.doc.rect(this.fwd(x, 1.1) - 0.5, this.y + size * PT * 0.5 - 0.5, 1, 1, 'F');
        this.font(size, false, BODY);
        const fit = this.wrap(it, colW - 6)[0] ?? '';
        this.put(fit, this.fwd(x, 4), this.y + size * PT * 0.8);
      });
      this.y += lh;
    }
  }

  header(name: string, headline: string, contact: string[], personal: string[] = []): void {
    this.y = this.top;
    this.font(23, true, INK);
    this.put(name, this.start, this.y + 23 * PT * 0.8);
    this.y += this.lh(23, 1.2);
    if (headline) {
      this.font(12, false, ACCENT);
      this.put(headline, this.start, this.y + 12 * PT * 0.8);
      this.y += this.lh(12, 1.45);
    }
    this.y += 0.8;
    if (contact.length) this.inline(contact, 9, BODY);
    if (personal.length) this.inline(personal, 8.6, MUTED);
    this.y += 1.6;
    this.rule(INK, 0.5);
    this.y += 1;
  }

  /** Name + page numbers on every page (and a slim running header from page 2). */
  finish(name: string, lang: Lang): void {
    const t = L[lang];
    const n = this.doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      this.doc.setPage(i);
      this.font(7.8, false, MUTED);
      this.doc.setDrawColor(...RULE);
      this.doc.setLineWidth(0.2);
      this.doc.line(this.mx, this.H - 11, this.W - this.mx, this.H - 11);
      this.put(name, this.start, this.H - 7.5);
      if (n > 1) this.put(`${t.page} ${i} ${t.of} ${n}`, this.end, this.H - 7.5, 'end');
    }
  }
}

function period(start: string, end: string, lang: Lang): string {
  const e = end?.trim() || L[lang].present;
  return start?.trim() ? `${start.trim()} – ${e}` : e;
}

export function buildCvPdf(cv: TailoredCv, fonts: PdfFonts): jsPDF {
  const t = L[cv.language];
  const pg = new Page(fonts, cv.language);
  pg.header(cv.name, cv.headline, cv.contact, cv.personal);

  if (cv.summary.trim()) {
    pg.section(t.summary);
    pg.para(cv.summary.trim(), 10, { factor: 1.5 });
  }

  const groups = cv.skillGroups?.filter((g) => g.items.length) ?? [];
  if (groups.length) {
    pg.section(t.skills);
    const sep = cv.language === 'ar' ? '، ' : ', ';
    for (const g of groups) {
      // "Category: item, item" — the category in bold, items wrapped under the column.
      pg.font(9.8, true, INK);
      const label = `${g.name}:`;
      const lw = pg.width(label) + 2;
      pg.room(pg.lh(9.8));
      pg.put(label, pg.start, pg.y + 9.8 * PT * 0.8);
      pg.font(9.8, false, BODY);
      const lines = pg.wrap(g.items.join(sep), pg.inner - lw);
      lines.forEach((l, i) => {
        if (i > 0) pg.room(pg.lh(9.8, 1.4));
        pg.put(l, pg.fwd(pg.start, lw), pg.y + 9.8 * PT * 0.8);
        pg.y += pg.lh(9.8, 1.4);
      });
      pg.y += 0.6;
    }
  } else if (cv.skills.length) {
    pg.section(t.skills);
    pg.grid(cv.skills.filter(Boolean), 3);
  }

  const exp = cv.experience.filter((e) => e.title || e.company);
  if (exp.length) {
    pg.section(t.experience);
    exp.forEach((e, i) => {
      if (i > 0) pg.y += 2.6;
      pg.row(e.title || e.company, period(e.start, e.end, cv.language));
      const where = [e.company && e.title ? e.company : '', e.location].filter(Boolean).join(cv.language === 'ar' ? '، ' : ', ');
      if (where) pg.para(where, 9.6, { color: ACCENT, after: 0.8 });
      else pg.y += 0.8;
      for (const b of e.bullets.map((x) => x.replace(/^[\s•\-–·*]+/, '').trim()).filter(Boolean)) pg.bullet(b);
    });
  }

  const edu = cv.education.filter((e) => e.degree || e.school);
  if (edu.length) {
    pg.section(t.education);
    edu.forEach((e, i) => {
      if (i > 0) pg.y += 1.6;
      pg.row(e.degree || e.school, e.year, 10.2);
      if (e.degree && e.school) pg.para(e.school, 9.6, { color: MUTED });
    });
  }

  const certs = cv.certifications.filter(Boolean);
  if (certs.length) {
    pg.section(t.certifications);
    for (const c of certs) pg.bullet(c, 9.6);
  }

  const langs = cv.languages.filter(Boolean);
  if (langs.length) {
    pg.section(t.languages);
    pg.grid(langs, Math.min(3, langs.length));
  }

  pg.finish(cv.name, cv.language);
  return pg.doc;
}

export interface LetterMeta {
  company: string;
  jobTitle: string;
}

export function buildLetterPdf(cv: TailoredCv, body: string, meta: LetterMeta, fonts: PdfFonts): jsPDF {
  const lang = cv.language;
  const t = L[lang];
  const pg = new Page(fonts, lang);
  pg.header(cv.name, cv.headline, cv.contact);
  pg.y += 6;

  pg.font(9.8, false, MUTED);
  pg.put(new Date().toLocaleDateString(lang === 'ar' ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), pg.start, pg.y + 9.8 * PT * 0.8);
  pg.y += 9;

  pg.para(t.hiring, 10.2, { bold: true, color: INK });
  if (meta.company) pg.para(meta.company, 10.2, { color: BODY });
  pg.para(t.qatar, 10.2, { color: BODY, after: 6 });

  if (meta.jobTitle) pg.para(`${t.re} ${meta.jobTitle}`, 10.6, { bold: true, color: ACCENT, after: 5 });

  for (const para of body.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)) {
    // Keep short sign-off blocks ("Kind regards,\nName") on their own lines.
    for (const line of para.split('\n')) pg.para(line, 10.6, { factor: 1.55 });
    pg.y += 3.2;
  }

  pg.finish(cv.name, lang);
  return pg.doc;
}
