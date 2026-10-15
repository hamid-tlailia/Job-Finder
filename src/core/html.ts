const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Converts an HTML fragment to readable plain text, keeping paragraph and list structure. */
export function htmlToText(html: string): string {
  let s = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<li[^>]*>/gi, '\n• ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|ul|ol|li|tr)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s.replace(/[ \t ]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').replace(/^\s+|\s+$/g, '').replace(/\n /g, '\n');
}

export function clean(s: string | undefined | null): string {
  return decodeEntities((s ?? '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

/** Returns the inner HTML of every element matching `class` containing `cls` (non-nested, best effort). */
export function between(html: string, start: RegExp, end: string): string | undefined {
  const m = start.exec(html);
  if (!m) return undefined;
  const from = m.index + m[0].length;
  const to = html.indexOf(end, from);
  return to === -1 ? html.slice(from) : html.slice(from, to);
}

export function attr(chunk: string, name: string): string | undefined {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const m = re.exec(chunk);
  return m ? decodeEntities(m[1] ?? m[2] ?? '') : undefined;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?974[\s-]?)?(?:[3567]\d{3})[\s-]?\d{4}\b/g;

export function findEmail(text: string): string | undefined {
  const all = text.match(EMAIL_RE) ?? [];
  return all.find((e) => !/example|noreply|no-reply|sentry|wixpress/i.test(e));
}

export function findQatarPhone(text: string): string | undefined {
  const m = text.match(PHONE_RE);
  if (!m) return undefined;
  const digits = m[0].replace(/\D/g, '');
  return digits.startsWith('974') ? `+${digits}` : `+974${digits}`;
}

export function detectLang(text: string): 'ar' | 'en' {
  const ar = (text.match(/[؀-ۿ]/g) ?? []).length;
  const lat = (text.match(/[A-Za-z]/g) ?? []).length;
  return ar > lat * 0.6 ? 'ar' : 'en';
}

export function slug(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '');
}
