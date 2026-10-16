/* Freelance projects (gigs): sources, freshness and local scoring. Independent of the Qatar job pipeline. */
import { clean, decodeEntities, htmlToText } from './html';

export type GigSourceId = 'mostaql' | 'freelancer' | 'remoteok';

export interface Gig {
  id: string;
  source: GigSourceId;
  sourceLabel: string;
  title: string;
  description: string;
  url: string;
  /** Budget in USD (converted when the platform uses another currency). */
  budgetMin?: number;
  budgetMax?: number;
  budgetType?: 'fixed' | 'hourly' | 'salary';
  /** Delivery time the client asked for, in days (Mostaql). */
  durationDays?: number;
  bids?: number;
  postedAt?: string;
  skills: string[];
  client?: string;
  language: 'ar' | 'en';
  /** Description is only a snippet until the project page is read. */
  needsDetail?: boolean;
  fetchedAt: string;
}

export interface FreelanceProfile {
  name: string;
  headline: string;
  /** Full CV text, used by the AI to pick relevant past work for each proposal. */
  cvText: string;
  cvName?: string;
  /** Skills and search words; each one that appears in a project raises its score. */
  keywords: string[];
  /** Past projects or links worth citing in proposals (one per line). */
  portfolio: string;
  hourlyRateUsd: number;
  /** Projects whose maximum budget is below this (USD) are pushed down. */
  minBudgetUsd: number;
  sources: Record<GigSourceId, boolean>;
  /** Proposals written automatically per refresh. */
  autoDrafts: number;
  /** Profile bio for freelance platforms (Mostaql "النبذة التعريفية", Freelancer summary). */
  bio?: { ar?: string; en?: string };
}

export const DEFAULT_KEYWORDS = ['react native', 'expo', 'react', 'node.js', 'next.js', 'javascript', 'typescript', 'mobile app', 'pwa', 'full stack', 'api', 'firebase', 'mongodb', 'تطبيق جوال', 'تطبيق', 'موقع', 'برمجة', 'رياكت'];

export function emptyFreelanceProfile(): FreelanceProfile {
  return { name: '', headline: '', cvText: '', keywords: DEFAULT_KEYWORDS, portfolio: '', hourlyRateUsd: 20, minBudgetUsd: 25, sources: { mostaql: true, freelancer: true, remoteok: true }, autoDrafts: 3 };
}

export type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<string>;

/** Freelance projects go stale fast: the first hours bring most of the bids. */
export const GIG_MAX_AGE_H = 72;

export function gigFresh(g: Gig, hours = GIG_MAX_AGE_H): boolean {
  if (!g.postedAt) return false;
  const age = Date.now() - new Date(g.postedAt).getTime();
  return age > -3600e3 && age <= (g.source === 'remoteok' ? 7 * 24 : hours) * 3600e3;
}

const now = () => new Date().toISOString();

/* ── Mostaql (mostaql.com): Arabic freelance marketplace, programming category ───────────── */

function parseMostaqlList(html: string): Gig[] {
  const rows = html.split('<tr class="project-row">').slice(1);
  return rows.flatMap((r) => {
    const link = /<h2[^>]*>\s*<a href="(https:\/\/mostaql\.com\/project\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(r);
    if (!link) return [];
    const time = /<time datetime="([^"]+)"/.exec(r)?.[1];
    const bids = /(\d+)\s*(?:عروض|عرض)/.exec(r)?.[1];
    const brief = /class="details-url"[^>]*>([\s\S]*?)<\/a>/.exec(r)?.[1] ?? '';
    const client = /<bdi>([\s\S]*?)<\/bdi>/.exec(r)?.[1];
    return [
      {
        id: `mostaql:${link[2]}`,
        source: 'mostaql' as const,
        sourceLabel: 'مستقل',
        title: clean(decodeEntities(link[3])),
        description: clean(decodeEntities(brief)),
        url: link[1],
        bids: bids ? Number(bids) : 0,
        // Mostaql prints server time (Saudi, UTC+3) without a zone.
        postedAt: time ? new Date(`${time.replace(' ', 'T')}+03:00`).toISOString() : undefined,
        skills: [],
        client: client ? clean(client) : undefined,
        language: 'ar' as const,
        needsDetail: true,
        fetchedAt: now(),
      },
    ];
  });
}

async function mostaqlDetail(g: Gig, fetch: Fetch): Promise<Gig> {
  const html = await fetch(g.url);
  const meta = (label: string) => {
    const i = html.indexOf(`>${label}</div>`);
    if (i < 0) return '';
    const v = /class="meta-value"[^>]*>([\s\S]*?)<\/div>/.exec(html.slice(i, i + 800))?.[1] ?? '';
    return clean(htmlToText(v));
  };
  const budget = meta('الميزانية').match(/[\d,.]+/g)?.map((x) => Number(x.replace(/,/g, '')));
  const days = /(\d+)/.exec(meta('مدة التنفيذ'))?.[1];
  const i = html.indexOf('id="projectDetailsTab"');
  const body = i > 0 ? /carda__content[^>]*>([\s\S]*?)<\/div>/.exec(html.slice(i, i + 40000))?.[1] : undefined;
  const skillsBlock = /<ul class="skills[\s\S]*?<\/ul>/.exec(html)?.[0] ?? '';
  const skills = [...skillsBlock.matchAll(/<bdi>([\s\S]*?)<\/bdi>|<a[^>]*>([\s\S]*?)<\/a>/g)].map((m) => clean(htmlToText(m[1] ?? m[2] ?? ''))).filter(Boolean);
  const closed = /حالة المشروع[\s\S]{0,300}(مغلق|ملغي|مكتمل|قيد التنفيذ)/.test(html);
  return {
    ...g,
    description: body ? htmlToText(body).trim() : g.description,
    budgetMin: budget?.[0],
    budgetMax: budget?.[1] ?? budget?.[0],
    budgetType: budget?.length ? 'fixed' : undefined,
    durationDays: days ? Number(days) : undefined,
    skills: [...new Set(skills)].slice(0, 15),
    needsDetail: false,
    ...(closed ? { bids: 999 } : {}),
  };
}

/* ── Freelancer.com: public projects API, filtered to web and mobile development skills ─── */

const FREELANCER_JOBS = [1314, 3025, 759, 44, 500, 2376, 1031]; // React Native, Expo, React.js, Mobile App Dev, Node.js, Next.js, Web Development

interface FlProject {
  id: number;
  title: string;
  description?: string;
  preview_description?: string;
  seo_url: string;
  type: 'fixed' | 'hourly';
  budget?: { minimum?: number; maximum?: number };
  currency?: { code: string; exchange_rate: number };
  bid_stats?: { bid_count?: number };
  time_submitted: number;
  language?: string;
  jobs?: { name: string }[];
}

async function searchFreelancer(fetch: Fetch): Promise<Gig[]> {
  const q = new URLSearchParams({ limit: '60', full_description: 'true', job_details: 'true', sort_field: 'time_submitted' });
  for (const j of FREELANCER_JOBS) q.append('jobs[]', String(j));
  for (const l of ['en', 'ar']) q.append('languages[]', l);
  const data = JSON.parse(await fetch(`https://www.freelancer.com/api/projects/0.1/projects/active/?${q}`)) as { result?: { projects?: FlProject[] } };
  return (data.result?.projects ?? []).map((p) => {
    const rate = p.currency?.exchange_rate || 1;
    return {
      id: `freelancer:${p.id}`,
      source: 'freelancer' as const,
      sourceLabel: 'Freelancer',
      title: clean(p.title),
      description: (p.description ?? p.preview_description ?? '').trim(),
      url: `https://www.freelancer.com/projects/${p.seo_url}`,
      budgetMin: p.budget?.minimum ? Math.round(p.budget.minimum * rate) : undefined,
      budgetMax: p.budget?.maximum ? Math.round(p.budget.maximum * rate) : undefined,
      budgetType: p.type,
      bids: p.bid_stats?.bid_count ?? 0,
      postedAt: new Date(p.time_submitted * 1000).toISOString(),
      skills: (p.jobs ?? []).map((j) => j.name),
      language: p.language === 'ar' ? ('ar' as const) : ('en' as const),
      fetchedAt: now(),
    };
  });
}

/* ── Remote OK: remote developer roles (contract and full time). API terms: link back and name Remote OK. ─ */

interface RemoteOkJob {
  id?: string;
  position?: string;
  company?: string;
  description?: string;
  url?: string;
  date?: string;
  tags?: string[];
  salary_min?: number;
  salary_max?: number;
}

async function searchRemoteOk(fetch: Fetch): Promise<Gig[]> {
  const out: Gig[] = [];
  for (const tag of ['react-native', 'react']) {
    const list = JSON.parse(await fetch(`https://remoteok.com/api?tag=${tag}`)) as RemoteOkJob[];
    for (const j of list) {
      if (!j.id || !j.position) continue;
      out.push({
        id: `remoteok:${j.id}`,
        source: 'remoteok',
        sourceLabel: 'Remote OK',
        title: clean(j.position),
        description: htmlToText(decodeEntities(j.description ?? '')).trim(),
        url: j.url ?? `https://remoteok.com/remote-jobs/${j.id}`,
        budgetMin: j.salary_min || undefined,
        budgetMax: j.salary_max || undefined,
        budgetType: j.salary_min ? 'salary' : undefined,
        postedAt: j.date,
        skills: j.tags ?? [],
        client: j.company,
        language: 'en',
        fetchedAt: now(),
      });
    }
  }
  return out;
}

export const GIG_SOURCES: { id: GigSourceId; label: string; search: (f: Fetch) => Promise<Gig[]>; detail?: (g: Gig, f: Fetch) => Promise<Gig> }[] = [
  {
    id: 'mostaql',
    label: 'مستقل',
    async search(fetch) {
      const url = (p: number) => `https://mostaql.com/projects?category=development&sort=latest&page=${p}`;
      const first = parseMostaqlList(await fetch(url(1)));
      try {
        return [...first, ...parseMostaqlList(await fetch(url(2)))];
      } catch {
        return first;
      }
    },
    detail: mostaqlDetail,
  },
  { id: 'freelancer', label: 'Freelancer', search: searchFreelancer },
  { id: 'remoteok', label: 'Remote OK', search: searchRemoteOk },
];

/* ── Local scoring ─────────────────────────────────────────────────────────────────────── */

export interface GigScore {
  score: number;
  hits: string[];
  blocked?: 'scam' | 'irrelevant' | 'closed';
}

/** Typical bait: pay-to-start, typing jobs, moving the chat off the platform. */
const SCAM = /registration fee|pay (a )?(small )?fee|deposit (first|required)|copy[- ]?typing|typing work|data entry work from home|captcha|whats ?app me|telegram me|contact me on (telegram|whatsapp)|رسوم تسجيل|ادفع.*(أولا|اولا)|تواصل.*(واتس|تيليجرام).*(خارج|مباشرة)/i;
/** Fields far from web and mobile development; they only pass with a strong keyword overlap. */
const OFF_FIELD = /logo|graphic design|video edit|voice ?over|translation|translat|copywriting|article|seo\b|social media manag|data entry|tiktok|youtube|تصميم شعار|مونتاج|تعليق صوتي|ترجمة|كتابة محتوى|مقالات|تسويق|إدخال بيانات|تفريغ/i;

export function localGigScore(g: Gig, fp: FreelanceProfile): GigScore {
  const title = g.title.toLowerCase();
  const text = `${g.title}\n${g.description}\n${g.skills.join(' ')}`.toLowerCase();
  if (SCAM.test(text)) return { score: 0, hits: [], blocked: 'scam' };
  if ((g.bids ?? 0) >= 999) return { score: 0, hits: [], blocked: 'closed' };
  const words = (fp.keywords.length ? fp.keywords : DEFAULT_KEYWORDS).map((k) => k.trim().toLowerCase()).filter((k) => k.length > 1);
  // Short words (api, pwa) must stand alone; longer ones may sit inside other words.
  const has = (hay: string, k: string) => (k.length <= 4 ? new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(hay) : hay.includes(k));
  const inTitle = words.filter((k) => has(title, k));
  const hits = words.filter((k) => has(text, k));
  if (!hits.length || (OFF_FIELD.test(title) && inTitle.length === 0)) return { score: 0, hits, blocked: 'irrelevant' };

  let score = 25 + Math.min(36, inTitle.length * 12) + Math.min(24, hits.length * 4);
  if (/react native|expo|رياكت نيتف/.test(text)) score += 8;

  const max = g.budgetMax ?? g.budgetMin;
  if (max !== undefined && g.budgetType !== 'salary') {
    const floor = g.budgetType === 'hourly' ? Math.max(5, fp.hourlyRateUsd * 0.5) : fp.minBudgetUsd;
    if (max < floor) score -= 25;
    else if (max >= floor * 4) score += 6;
  }
  const bids = g.bids ?? 0;
  if (bids > 60) score -= 18;
  else if (bids > 30) score -= 10;
  else if (bids <= 8) score += 8;
  if (g.postedAt && Date.now() - new Date(g.postedAt).getTime() < 6 * 3600e3) score += 6;
  return { score: Math.max(0, Math.min(100, score)), hits: [...new Set(hits)].slice(0, 8) };
}

export async function gigWithDetail(g: Gig, fetch: Fetch): Promise<Gig> {
  if (!g.needsDetail) return g;
  const src = GIG_SOURCES.find((s) => s.id === g.source);
  if (!src?.detail) return g;
  try {
    return await src.detail(g, fetch);
  } catch {
    return g;
  }
}
