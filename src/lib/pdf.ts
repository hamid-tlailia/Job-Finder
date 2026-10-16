import { jsPDF } from 'jspdf';
import type { CvTemplate, Lang, TailoredCv } from '../core/types';

export interface PdfFonts {
  regular: string;
  bold: string;
}

type Rgb = [number, number, number];

interface Palette {
  ink: Rgb;
  body: Rgb;
  muted: Rgb;
  accent: Rgb;
  marker: Rgb;
  rule: Rgb;
}

// Classic: near-black text with one maroon accent. Executive: navy and gold, the usual board-level pairing.
const CLASSIC: Palette = { ink: [26, 32, 44], body: [45, 52, 64], muted: [100, 108, 120], accent: [122, 18, 50], marker: [122, 18, 50], rule: [205, 208, 214] };
const EXEC: Palette = { ink: [20, 33, 61], body: [44, 52, 66], muted: [98, 108, 124], accent: [20, 33, 61], marker: [176, 141, 87], rule: [210, 214, 222] };
const NAVY: Rgb = [20, 33, 61];
const GOLD: Rgb = [196, 160, 98];
const TINT: Rgb = [246, 243, 236];

const L = {
  en: { summary: 'Professional Summary', execSummary: 'Executive Profile', highlights: 'Career Highlights', skills: 'Core Competencies', expertise: 'Areas of Expertise', experience: 'Professional Experience', education: 'Education', credentials: 'Education & Credentials', certifications: 'Certifications', languages: 'Languages', present: 'Present', page: 'Page', of: 'of', hiring: 'Hiring Manager', re: 'Re: Application for', qatar: 'Doha, Qatar' },
  ar: { summary: 'الملخص المهني', execSummary: 'الملف التنفيذي', highlights: 'أبرز الإنجازات', skills: 'الكفاءات الأساسية', expertise: 'مجالات الخبرة', experience: 'الخبرة المهنية', education: 'التعليم', credentials: 'التعليم والشهادات', certifications: 'الشهادات المهنية', languages: 'اللغات', present: 'حتى الآن', page: 'صفحة', of: 'من', hiring: 'مدير التوظيف', re: 'الموضوع: طلب التقدم لوظيفة', qatar: 'الدوحة، قطر' },
};

const AR = /[؀-ۿ]/;
const RTL_OPTS = { isInputVisual: false, isOutputVisual: true, isInputRtl: true, isOutputRtl: false };
const PT = 0.3528; // mm per point

class Page {
  doc: jsPDF;
  y = 0;
  /** Horizontal margin; temporarily widened to inset content inside a panel. */
  mx = 18;
  readonly top = 16;
  readonly bottom = 16;
  readonly W: number;
  readonly H: number;
  readonly rtl: boolean;
  readonly c: Palette;
  readonly exec: boolean;

  constructor(fonts: PdfFonts, lang: Lang, template: CvTemplate) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.doc.addFileToVFS('Plex-Regular.ttf', fonts.regular);
    this.doc.addFileToVFS('Plex-Bold.ttf', fonts.bold);
    this.doc.addFont('Plex-Regular.ttf', 'Plex', 'normal');
    this.doc.addFont('Plex-Bold.ttf', 'Plex', 'bold');
    this.W = this.doc.internal.pageSize.getWidth();
    this.H = this.doc.internal.pageSize.getHeight();
    this.rtl = lang === 'ar';
    this.exec = template === 'executive';
    this.c = this.exec ? EXEC : CLASSIC;
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

  font(size: number, bold = false, color: Rgb = this.c.body): void {
    this.doc.setFont('Plex', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
  }

  lh(size: number, factor = 1.42): number {
    return size * PT * factor;
  }

  base(size: number): number {
    return this.y + size * PT * 0.8;
  }

  /** Draws one line at the 'start' or 'end' edge semantics of the reading direction. */
  put(text: string, x: number, y: number, at: 'start' | 'end' = 'start', charSpace?: number): void {
    const alignRight = (this.rtl && at === 'start') || (!this.rtl && at === 'end');
    const opts: Record<string, unknown> = { align: alignRight ? 'right' : 'left' };
    if (AR.test(text)) Object.assign(opts, RTL_OPTS);
    else if (charSpace) opts.charSpace = charSpace;
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

  rule(color: Rgb = this.c.rule, weight = 0.25, from = this.mx, to = this.W - this.mx): void {
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(weight);
    this.doc.line(from, this.y, to, this.y);
  }

  para(text: string, size: number, opts: { bold?: boolean; color?: Rgb; indent?: number; width?: number; after?: number; factor?: number } = {}): void {
    const { bold = false, color = this.c.body, indent = 0, after = 0, factor = 1.42 } = opts;
    this.font(size, bold, color);
    const lines = this.wrap(text, (opts.width ?? this.inner) - indent);
    const lh = this.lh(size, factor);
    for (const line of lines) {
      this.room(lh);
      this.font(size, bold, color);
      this.put(line, this.fwd(this.start, indent), this.base(size));
      this.y += lh;
    }
    this.y += after;
  }

  /** Short items separated by a thin divider, wrapping as needed; each keeps its own direction. */
  inline(items: string[], size: number, color: Rgb, sepColor: Rgb = this.c.rule): void {
    const gap = 2.4;
    const sep = '|';
    this.font(size, false, color);
    const sepW = this.width(sep);
    const lh = this.lh(size, 1.5);
    let x = this.start;
    let used = 0;
    for (const [i, item] of items.entries()) {
      this.font(size, false, color);
      const w = this.width(item);
      if (used > 0 && used + w > this.inner) {
        this.y += lh;
        x = this.start;
        used = 0;
      }
      this.put(item, x, this.base(size));
      x = this.fwd(x, w);
      used += w;
      if (i < items.length - 1) {
        this.doc.setTextColor(...sepColor);
        this.put(sep, this.fwd(x, gap), this.base(size));
        x = this.fwd(x, gap * 2 + sepW);
        used += gap * 2 + sepW;
      }
    }
    this.y += lh;
  }

  section(title: string): void {
    this.room(18);
    this.y += 4.4;
    const label = this.rtl ? title : title.toUpperCase();
    if (this.exec) {
      // Gold marker bar before a navy heading, light rule to the far edge.
      this.font(10.5, true, NAVY);
      const bar = 7;
      this.doc.setFillColor(...GOLD);
      const bx = this.rtl ? this.start - bar : this.start;
      this.doc.rect(bx, this.y + 1.2, bar, 1.4, 'F');
      this.put(label, this.fwd(this.start, bar + 2.5), this.base(10.5), 'start', 0.5);
      this.y += this.lh(10.5, 1.3);
      this.rule(this.c.rule, 0.3);
      this.y += 2.8;
      return;
    }
    this.font(10.5, true, this.c.accent);
    this.put(label, this.start, this.base(10.5), 'start', 0.45);
    this.y += this.lh(10.5, 1.25);
    this.rule(this.c.accent, 0.35);
    this.y += 2.6;
  }

  /** Main text with a muted note on the far edge (e.g. job title + dates) on one baseline. */
  row(main: string, note: string, size = 10.5, color: Rgb = this.c.ink): void {
    this.font(9, false, this.c.muted);
    const nw = note ? this.width(note) + 4 : 0;
    this.font(size, true, color);
    const lines = this.wrap(main, this.inner - nw);
    const lh = this.lh(size, 1.35);
    this.room(lh * lines.length + 10);
    const b = this.base(size);
    lines.forEach((l, i) => this.put(l, this.start, b + i * lh));
    if (note) {
      this.font(9, false, this.c.muted);
      this.put(note, this.end, b, 'end');
    }
    this.y += lh * lines.length;
  }

  bullet(text: string, size = 9.8): void {
    const indent = 4.2;
    this.font(size, false, this.c.body);
    const lines = this.wrap(text, this.inner - indent);
    const lh = this.lh(size, 1.38);
    this.room(lh * Math.min(lines.length, 2));
    this.doc.setFillColor(...this.c.marker);
    const cy = this.base(size) - size * PT * 0.3;
    this.doc.rect(this.fwd(this.start, 1.1) - 0.55, cy - 0.55, 1.1, 1.1, 'F');
    for (const l of lines) {
      this.room(lh);
      this.font(size, false, this.c.body);
      this.put(l, this.fwd(this.start, indent), this.base(size));
      this.y += lh;
    }
    this.y += 0.8;
  }

  /** Short items in `cols` columns, filled across in reading order. */
  grid(items: string[], cols: number, size = 9.6): void {
    const colW = this.inner / cols;
    const lh = this.lh(size, 1.55);
    for (let i = 0; i < items.length; i += cols) {
      this.room(lh);
      items.slice(i, i + cols).forEach((it, c) => {
        const x = this.fwd(this.start, c * colW);
        this.doc.setFillColor(...this.c.marker);
        this.doc.rect(this.fwd(x, 1.1) - 0.5, this.y + size * PT * 0.5 - 0.5, 1, 1, 'F');
        this.font(size, false, this.c.body);
        this.put(this.wrap(it, colW - 6)[0] ?? '', this.fwd(x, 4), this.base(size));
      });
      this.y += lh;
    }
  }

  /** Classic header: name, title, contact and personal rows, then a heavy rule. */
  header(name: string, headline: string, contact: string[], personal: string[] = []): void {
    this.y = this.top;
    this.font(23, true, this.c.ink);
    this.put(name, this.start, this.base(23));
    this.y += this.lh(23, 1.2);
    if (headline) {
      this.font(12, false, this.c.accent);
      this.put(headline, this.start, this.base(12));
      this.y += this.lh(12, 1.45);
    }
    this.y += 0.8;
    if (contact.length) this.inline(contact, 9, this.c.body);
    if (personal.length) this.inline(personal, 8.6, this.c.muted);
    this.y += 1.6;
    this.rule(this.c.ink, 0.5);
    this.y += 1;
  }

  /** Executive header: full-width navy band with the name in white and the title in gold. */
  band(name: string, headline: string, contact: string[], personal: string[] = []): void {
    const d = this.doc;
    const measure = () => {
      let h = 12 + this.lh(24, 1.15) + (headline ? this.lh(12, 1.5) : 0) + 2;
      this.font(9, false);
      const rows = (items: string[], size: number) => {
        if (!items.length) return 0;
        this.font(size, false);
        const total = items.reduce((a, it) => a + this.width(it), 0) + (items.length - 1) * (this.width('|') + 4.8);
        return Math.ceil(total / this.inner) * this.lh(size, 1.5);
      };
      h += rows(contact, 9) + rows(personal, 8.6) + 8;
      return h;
    };
    const h = measure();
    d.setFillColor(...NAVY);
    d.rect(0, 0, this.W, h, 'F');
    d.setFillColor(...GOLD);
    d.rect(0, h, this.W, 1.2, 'F');
    this.y = 12;
    this.font(24, true, [255, 255, 255]);
    this.put(name, this.start, this.base(24), 'start', AR.test(name) ? undefined : 0.3);
    this.y += this.lh(24, 1.15);
    if (headline) {
      this.font(12, false, GOLD);
      this.put(headline, this.start, this.base(12));
      this.y += this.lh(12, 1.5);
    }
    this.y += 2;
    if (contact.length) this.inline(contact, 9, [226, 231, 238], [120, 134, 158]);
    if (personal.length) this.inline(personal, 8.6, [178, 189, 205], [120, 134, 158]);
    this.y = h + 3;
  }

  /** Name + page numbers on every page. */
  finish(name: string, lang: Lang): void {
    const t = L[lang];
    const n = this.doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      this.doc.setPage(i);
      this.font(7.8, false, this.c.muted);
      this.doc.setDrawColor(...(this.exec ? GOLD : this.c.rule));
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

const cleanBullets = (b: string[]) => b.map((x) => x.replace(/^[\s•\-–·*]+/, '').trim()).filter(Boolean);

function skillsBlock(pg: Page, cv: TailoredCv, title: string): void {
  const groups = cv.skillGroups?.filter((g) => g.items.length) ?? [];
  if (groups.length) {
    pg.section(title);
    const sep = cv.language === 'ar' ? '، ' : ', ';
    for (const g of groups) {
      // "Category: item, item" — bold category, items wrapped beside it.
      pg.font(9.8, true, pg.c.ink);
      const label = `${g.name}:`;
      const lw = pg.width(label) + 2;
      pg.room(pg.lh(9.8));
      pg.put(label, pg.start, pg.base(9.8));
      pg.font(9.8, false, pg.c.body);
      pg.wrap(g.items.join(sep), pg.inner - lw).forEach((l, i) => {
        if (i > 0) pg.room(pg.lh(9.8, 1.4));
        pg.font(9.8, false, pg.c.body);
        pg.put(l, pg.fwd(pg.start, lw), pg.base(9.8));
        pg.y += pg.lh(9.8, 1.4);
      });
      pg.y += 0.6;
    }
  } else if (cv.skills.length) {
    pg.section(title);
    pg.grid(cv.skills.filter(Boolean), 3);
  }
}

function buildClassic(cv: TailoredCv, pg: Page): void {
  const t = L[cv.language];
  pg.header(cv.name, cv.headline, cv.contact, cv.personal);

  if (cv.summary.trim()) {
    pg.section(t.summary);
    pg.para(cv.summary.trim(), 10, { factor: 1.5 });
  }
  skillsBlock(pg, cv, t.skills);

  const exp = cv.experience.filter((e) => e.title || e.company);
  if (exp.length) {
    pg.section(t.experience);
    exp.forEach((e, i) => {
      if (i > 0) pg.y += 2.6;
      pg.row(e.title || e.company, period(e.start, e.end, cv.language));
      const where = [e.company && e.title ? e.company : '', e.location].filter(Boolean).join(cv.language === 'ar' ? '، ' : ', ');
      if (where) pg.para(where, 9.6, { color: pg.c.accent, after: 0.8 });
      else pg.y += 0.8;
      for (const b of cleanBullets(e.bullets)) pg.bullet(b);
    });
  }

  const edu = cv.education.filter((e) => e.degree || e.school);
  if (edu.length) {
    pg.section(t.education);
    edu.forEach((e, i) => {
      if (i > 0) pg.y += 1.6;
      pg.row(e.degree || e.school, e.year, 10.2);
      if (e.degree && e.school) pg.para(e.school, 9.6, { color: pg.c.muted });
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
}

function buildExecutive(cv: TailoredCv, pg: Page): void {
  const t = L[cv.language];
  pg.band(cv.name, cv.headline, cv.contact, cv.personal);

  if (cv.summary.trim()) {
    pg.section(t.execSummary);
    pg.para(cv.summary.trim(), 10.2, { factor: 1.55 });
  }

  const highlights = (cv.highlights ?? []).filter(Boolean).slice(0, 4);
  if (highlights.length) {
    pg.section(t.highlights);
    // Tinted panel so the headline achievements are read first.
    const pad = 3.2;
    pg.font(9.8, false);
    const est = highlights.reduce((h, x) => h + pg.wrap(x, pg.inner - 4.2 - pad * 2).length * pg.lh(9.8, 1.38) + 0.8, 0) + pad * 2;
    pg.room(Math.min(est, 80));
    pg.doc.setFillColor(...TINT);
    pg.doc.rect(pg.mx, pg.y, pg.inner, est, 'F');
    pg.doc.setFillColor(...GOLD);
    pg.doc.rect(pg.rtl ? pg.W - pg.mx - 0.9 : pg.mx, pg.y, 0.9, est, 'F');
    pg.y += pad;
    const margin = pg.mx;
    pg.mx = margin + pad;
    for (const h of highlights) pg.bullet(h, 9.8);
    pg.mx = margin;
    pg.y += pad - 0.8;
  }

  const groups = cv.skillGroups?.filter((g) => g.items.length) ?? [];
  if (groups.length) skillsBlock(pg, cv, t.expertise);
  else if (cv.skills.length) {
    pg.section(t.expertise);
    pg.grid(cv.skills.filter(Boolean).slice(0, 15), 3);
  }

  const exp = cv.experience.filter((e) => e.title || e.company);
  if (exp.length) {
    pg.section(t.experience);
    exp.forEach((e, i) => {
      if (i > 0) pg.y += 3;
      // Company leads (executive convention), then the role in gold.
      const company = e.company || e.title;
      pg.row(pg.rtl ? company : company.toUpperCase(), period(e.start, e.end, cv.language), 10.4, NAVY);
      const title = e.company ? e.title.trim() : '';
      const loc = e.location?.trim() ?? '';
      if (title || loc) {
        pg.room(pg.lh(10));
        let x = pg.start;
        if (title) {
          pg.font(10, true, GOLD);
          pg.put(title, x, pg.base(10));
          x = pg.fwd(x, pg.width(title));
        }
        if (loc) {
          pg.font(9.2, false, pg.c.muted);
          pg.put(title ? `  ·  ${loc}` : loc, x, pg.base(10));
        }
        pg.y += pg.lh(10, 1.5);
      }
      for (const b of cleanBullets(e.bullets)) pg.bullet(b);
    });
  }

  const edu = cv.education.filter((e) => e.degree || e.school);
  const certs = cv.certifications.filter(Boolean);
  if (edu.length || certs.length) {
    pg.section(t.credentials);
    edu.forEach((e, i) => {
      if (i > 0) pg.y += 1.4;
      pg.row(e.degree || e.school, e.year, 10.2);
      if (e.degree && e.school) pg.para(e.school, 9.6, { color: pg.c.muted });
    });
    if (edu.length && certs.length) pg.y += 1.6;
    for (const c of certs) pg.bullet(c, 9.6);
  }

  const langs = cv.languages.filter(Boolean);
  if (langs.length) {
    pg.section(t.languages);
    pg.grid(langs, Math.min(3, langs.length));
  }
}

export function buildCvPdf(cv: TailoredCv, fonts: PdfFonts, template: CvTemplate = 'classic'): jsPDF {
  const pg = new Page(fonts, cv.language, template);
  if (template === 'executive') buildExecutive(cv, pg);
  else buildClassic(cv, pg);
  pg.finish(cv.name, cv.language);
  return pg.doc;
}

export interface LetterMeta {
  company: string;
  jobTitle: string;
}

export function buildLetterPdf(cv: TailoredCv, body: string, meta: LetterMeta, fonts: PdfFonts, template: CvTemplate = 'classic'): jsPDF {
  const pg = new Page(fonts, cv.language, template);
  writeLetter(pg, cv, body, meta, template);
  pg.finish(cv.name, cv.language);
  return pg.doc;
}

/** Cover letter followed by the CV in one file, for channels that take a single attachment (WhatsApp). */
export function buildApplicationPdf(cv: TailoredCv, body: string, meta: LetterMeta, fonts: PdfFonts, template: CvTemplate = 'classic'): jsPDF {
  const pg = new Page(fonts, cv.language, template);
  writeLetter(pg, cv, body, meta, template);
  pg.doc.addPage();
  pg.y = pg.top;
  if (template === 'executive') buildExecutive(cv, pg);
  else buildClassic(cv, pg);
  pg.finish(cv.name, cv.language);
  return pg.doc;
}

function writeLetter(pg: Page, cv: TailoredCv, body: string, meta: LetterMeta, template: CvTemplate): void {
  const lang = cv.language;
  const t = L[lang];
  if (template === 'executive') pg.band(cv.name, cv.headline, cv.contact);
  else pg.header(cv.name, cv.headline, cv.contact);
  pg.y += 6;

  pg.font(9.8, false, pg.c.muted);
  pg.put(new Date().toLocaleDateString(lang === 'ar' ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), pg.start, pg.base(9.8));
  pg.y += 9;

  pg.para(t.hiring, 10.2, { bold: true, color: pg.c.ink });
  if (meta.company) pg.para(meta.company, 10.2);
  pg.para(t.qatar, 10.2, { after: 6 });

  if (meta.jobTitle) pg.para(`${t.re} ${meta.jobTitle}`, 10.6, { bold: true, color: template === 'executive' ? NAVY : pg.c.accent, after: 5 });

  for (const para of body.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)) {
    // Keep short sign-off blocks ("Kind regards,\nName") on their own lines.
    for (const line of para.split('\n')) pg.para(line, 10.6, { factor: 1.55 });
    pg.y += 3.2;
  }
}
