import type { Analysis, CareerTrack, Job, Profile } from './types';
import { QATAR_CITIES, cityOf, distanceKm } from './qatar';
import { avoidedIndustry } from './industries';

const STOP = new Set(['and', 'or', 'the', 'of', 'in', 'for', 'a', 'an', 'to', 'with', 'at', 'senior', 'junior', 'sr', 'jr', 'lead', 'head', 'i', 'ii', 'iii', '-', '&', 'في', 'و', 'من']);

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9؀-ۿ+#.]+/g, ' ').split(' ').filter((t) => t.length > 1 && !STOP.has(t));
}

/** Folds Arabic spelling variants (hamza forms, taa marbuta, the "ال" article) so "المبيعات" equals "مبيعات". */
function foldArabic(t: string): string {
  return t.replace(/[أإآ]/g, 'ا').replace(/ة$/, 'ه').replace(/ى$/, 'ي').replace(/^(وال|بال|لل|ال)(?=..)/, '');
}

/**
 * Role words in Arabic and English mapped to one concept, so an Arabic track title such as
 * "مندوب مبيعات" matches an English posting "Sales Representative" and synonyms match each other.
 */
const CONCEPTS: [string, string[]][] = [
  ['sales', ['sales', 'sale', 'selling', 'مبيعات', 'بيع', 'بائع', 'بايع', 'salesman', 'saleswoman', 'salesperson']],
  ['rep', ['representative', 'rep', 'مندوب', 'ممثل']],
  ['bizdev', ['business', 'development', 'bd']],
  ['reception', ['reception', 'receptionist', 'استقبال', 'front', 'desk', 'concierge', 'كونسيرج']],
  ['pharma', ['pharmacy', 'pharmacist', 'pharmaceutical', 'صيدلي', 'صيدليه', 'صيدلاني', 'صيدله', 'ادويه']],
  ['account', ['accountant', 'accounting', 'accounts', 'محاسب', 'محاسبه']],
  ['finance', ['finance', 'financial', 'ماليه', 'مالي']],
  ['manager', ['manager', 'management', 'مدير', 'اداره']],
  ['assistant', ['assistant', 'مساعد', 'مساعده']],
  ['driver', ['driver', 'chauffeur', 'سائق']],
  ['nurse', ['nurse', 'nursing', 'ممرض', 'ممرضه', 'تمريض']],
  ['engineer', ['engineer', 'engineering', 'مهندس', 'هندسه']],
  ['cashier', ['cashier', 'كاشير']],
  ['customer', ['customer', 'client', 'clients', 'عملاء', 'زبائن']],
  ['service', ['service', 'services', 'support', 'خدمه', 'دعم']],
  ['marketing', ['marketing', 'تسويق', 'تسويقي']],
  ['supervisor', ['supervisor', 'مشرف']],
  ['secretary', ['secretary', 'سكرتير', 'سكرتيره']],
  ['admin', ['admin', 'administrative', 'administration', 'administrator', 'اداري', 'اداريه']],
  ['hr', ['hr', 'human', 'resources', 'recruiter', 'recruitment', 'talent', 'موارد', 'بشريه', 'توظيف']],
  ['developer', ['developer', 'programmer', 'software', 'مطور', 'مبرمج', 'برمجه']],
  ['designer', ['designer', 'design', 'مصمم', 'تصميم']],
  ['teacher', ['teacher', 'tutor', 'instructor', 'معلم', 'مدرس', 'معلمه', 'مدرسه']],
  ['chef', ['chef', 'cook', 'طباخ', 'طاهي', 'شيف']],
  ['waiter', ['waiter', 'waitress', 'نادل']],
  ['security', ['security', 'guard', 'امن', 'حارس']],
  ['technician', ['technician', 'tech', 'فني']],
  ['coordinator', ['coordinator', 'منسق', 'منسقه']],
  ['analyst', ['analyst', 'محلل']],
  ['specialist', ['specialist', 'اخصائي', 'متخصص']],
  ['officer', ['officer', 'موظف', 'موظفه']],
  ['warehouse', ['warehouse', 'storekeeper', 'stock', 'inventory', 'مستودع', 'مخزن', 'مخازن']],
  ['logistics', ['logistics', 'لوجستي', 'لوجستيه', 'شحن']],
  ['procurement', ['procurement', 'purchasing', 'purchase', 'buyer', 'مشتريات']],
  ['retail', ['retail', 'shop', 'showroom', 'تجزئه', 'معرض']],
  ['agent', ['agent', 'وكيل']],
  ['electric', ['electrician', 'electrical', 'كهربائي', 'كهرباء']],
  ['mechanic', ['mechanic', 'mechanical', 'ميكانيكي']],
  ['legal', ['legal', 'lawyer', 'محامي', 'قانوني']],
  ['doctor', ['doctor', 'physician', 'طبيب']],
  ['translator', ['translator', 'interpreter', 'مترجم']],
  ['graphic', ['graphic', 'جرافيك']],
];
const CONCEPT = new Map<string, string>();
for (const [c, words] of CONCEPTS) for (const w of words) if (!CONCEPT.has(w)) CONCEPT.set(w, c);

/** Concepts that say nothing about the field on their own, so they never become a search on their own. */
const GENERIC = new Set(['manager', 'assistant', 'officer', 'specialist', 'supervisor', 'coordinator', 'rep', 'agent', 'executive', 'associate', 'consultant', 'staff', 'senior', 'junior', 'trainee', 'intern', 'service']);
/** Title tokens reduced to concepts (language-independent); unknown words stay as they are. */
function concepts(s: string): string[] {
  return [...new Set(tokens(s).map((t) => {
    const f = foldArabic(t);
    return CONCEPT.get(t) ?? CONCEPT.get(f) ?? CONCEPT.get(t.replace(/s$/, '')) ?? f;
  }))];
}

/** Share (0–1) of a target title's concepts found in the job title. */
export function titleHit(target: string, jobTitle: string): number {
  const tt = concepts(target);
  if (!tt.length) return 0;
  const jt = concepts(jobTitle);
  const hits = tt.filter((x) => jt.includes(x) || (x.length > 3 && jt.some((y) => y.length > 3 && (y.startsWith(x) || x.startsWith(y)))));
  // "Pharmacy Assistant" vs "Assistant Manager": sharing only a generic role word is not a match.
  if (tt.some((x) => !GENERIC.has(x)) && hits.every((x) => GENERIC.has(x))) return Math.min(0.2, hits.length / tt.length);
  return hits.length / tt.length;
}

export function dedupeKey(job: Job): string {
  return `${tokens(job.title).sort().join(' ')}|${tokens(job.company).join(' ')}`;
}

/** The profile as seen through one career track: its titles, pitch, skills and CV replace the general ones. */
export function trackProfile(p: Profile, track?: CareerTrack): Profile {
  if (!track) return p;
  return {
    ...p,
    headline: track.headline || p.headline,
    summary: track.summary || p.summary,
    // Keywords count as titles for matching, so synonyms and Arabic postings still score as relevant.
    targetTitles: [...(track.targetTitles.length ? track.targetTitles : p.targetTitles), ...(track.keywords ?? [])],
    skills: track.skills.length ? track.skills : p.skills,
    cvText: track.cvText || p.cvText,
  };
}

const QUERY_WORD: Record<string, string> = { sales: 'sales', reception: 'receptionist', pharma: 'pharmacy', account: 'accountant', finance: 'finance', driver: 'driver', nurse: 'nurse', engineer: 'engineer', cashier: 'cashier', marketing: 'marketing', secretary: 'secretary', admin: 'admin', hr: 'hr', developer: 'developer', designer: 'designer', teacher: 'teacher', chef: 'chef', waiter: 'waiter', security: 'security guard', technician: 'technician', analyst: 'analyst', warehouse: 'warehouse', logistics: 'logistics', procurement: 'procurement', retail: 'retail', electric: 'electrician', mechanic: 'mechanic', legal: 'legal', doctor: 'doctor', translator: 'translator', bizdev: 'business development', customer: 'customer service' };

/**
 * The broad field of a track ("sales", "pharmacy", "receptionist"): the field concept that its titles
 * share most. Searching it returns every posting of the field, which the specific titles miss.
 */
export function coreQuery(titles: string[]): string | undefined {
  const count = new Map<string, number>();
  for (const t of titles) for (const c of concepts(t)) if (QUERY_WORD[c] && !GENERIC.has(c)) count.set(c, (count.get(c) ?? 0) + 1);
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? QUERY_WORD[best[0]] : undefined;
}

/**
 * Search keywords. Each career track contributes its broad field first (searched deeply, see `deepQueries`),
 * then its titles and keywords, taken round-robin so every track gets the same share.
 */
export function buildQueries(profile: Profile, max = 12): string[] {
  const tracks = (profile.tracks ?? []).filter((t) => t.targetTitles.length || t.keywords?.length);
  let q: string[];
  if (tracks.length) {
    q = deepQueries(profile);
    const lists = tracks.map((t) => [...t.targetTitles, ...(t.keywords ?? [])]);
    for (let i = 0; q.length < max * 2 && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i]) q.push(l[i]);
  } else {
    const titles = profile.targetTitles.map((t) => t.trim()).filter(Boolean);
    q = [...deepQueries(profile), ...(titles.length ? titles : profile.headline ? [profile.headline] : profile.skills.slice(0, 2))];
  }
  return [...new Set(q.map((s) => s.trim().toLowerCase()).filter(Boolean))].slice(0, tracks.length ? max : 6);
}

/** The broad field query of each track (or of the profile), which sources page through deeply. */
export function deepQueries(profile: Profile): string[] {
  const tracks = (profile.tracks ?? []).filter((t) => t.targetTitles.length || t.keywords?.length);
  const groups = tracks.length ? tracks.map((t) => [...t.targetTitles, ...(t.keywords ?? [])]) : [profile.targetTitles.length ? profile.targetTitles : [profile.headline]];
  return [...new Set(groups.map(coreQuery).filter((x): x is string => !!x))];
}

/** Scores the job against every track and returns the best one (or the plain profile when there are no tracks). */
export function bestTrack(job: Job, p: Profile): { trackId?: string; score: LocalScore } {
  const tracks = p.tracks ?? [];
  if (!tracks.length) return { score: localScore(job, p) };
  let best: { trackId?: string; score: LocalScore } | undefined;
  for (const t of tracks) {
    const s = localScore(job, trackProfile(p, t));
    if (!best || (s.blocked ? -1 : s.score) > (best.score.blocked ? -1 : best.score.score)) best = { trackId: t.id, score: s };
  }
  return best!;
}

function requiredYears(text: string): number | undefined {
  const m = /(\d{1,2})\s*(?:\+|-\s*\d+)?\s*(?:years|yrs|سنوات|سنة)/i.exec(text);
  return m ? Number(m[1]) : undefined;
}

export interface LocalScore {
  score: number;
  reasons: string[];
  gaps: string[];
  blocked?: string;
}

export function localScore(job: Job, p: Profile): LocalScore {
  const text = `${job.title}\n${job.description}`.toLowerCase();
  const reasons: string[] = [];
  const gaps: string[] = [];
  const prefs = p.prefs;

  const banned = prefs.excludeKeywords.find((k) => k.trim() && text.includes(k.trim().toLowerCase()));
  if (banned) return { score: 0, reasons, gaps, blocked: `exclude:${banned}` };
  const industry = avoidedIndustry(job, prefs.avoidIndustries);
  if (industry) return { score: 0, reasons, gaps, blocked: `industry:${industry}` };

  let score = 20;

  let bestTitle = 0;
  for (const t of p.targetTitles.length ? p.targetTitles : [p.headline]) bestTitle = Math.max(bestTitle, titleHit(t, job.title));
  score += Math.round(bestTitle * 40);
  if (bestTitle >= 0.7) reasons.push('title');

  const matched = p.skills.filter((s) => s.trim().length > 1 && text.includes(s.trim().toLowerCase()));
  // Unrelated titles only pass on a strong skills overlap, so other fields do not leak into the feed.
  if (bestTitle < 0.3 && matched.length < 3) return { score: 0, reasons, gaps, blocked: 'irrelevant' };
  score += Math.min(30, matched.length * 5);
  if (matched.length) reasons.push(`skills:${matched.slice(0, 6).join(', ')}`);

  if (job.employmentType) {
    if (prefs.jobTypes.length && !prefs.jobTypes.includes(job.employmentType as never)) {
      score -= 25;
      gaps.push(`type:${job.employmentType}`);
    } else score += 5;
  }

  if (job.workplace && prefs.workplaces.length && !prefs.workplaces.includes(job.workplace)) {
    score -= 20;
    gaps.push(`workplace:${job.workplace}`);
  }

  const speaksArabic = p.languages.some((l) => /arab|عرب/i.test(l.name)) || prefs.jobLanguages.includes('ar');
  if (/(fluent|native|proficien\w*|excellent)[^.\n]{0,25}arabic|arabic (speaker|speaking)|يجيد العربية|إجادة اللغة العربية/i.test(text) && !speaksArabic) {
    score -= 15;
    gaps.push('arabic');
  }
  if (job.language && !prefs.jobLanguages.includes(job.language)) score -= 10;

  if (prefs.distance !== 'any' && job.workplace !== 'remote') {
    const home = QATAR_CITIES.find((c) => c.id === p.city);
    const jc = job.city ? QATAR_CITIES.find((c) => c.id === job.city) : cityOf(job.location);
    if (home && jc) {
      const d = distanceKm(home, jc);
      const limit = prefs.distance === 'same_city' ? 8 : prefs.maxKm;
      if (d > limit) {
        score -= 20;
        gaps.push(`distance:${Math.round(d)}`);
      } else {
        score += 5;
        reasons.push(`near:${Math.round(d)}`);
      }
    }
  }

  const req = requiredYears(text);
  if (req !== undefined && req > p.yearsExperience + 2) {
    score -= 10;
    gaps.push(`years:${req}`);
  } else if (req !== undefined && p.yearsExperience >= req) reasons.push(`years:${req}`);

  if (prefs.visaStatus === 'need_sponsorship' && /qatari (nationals? )?only|qatari only|residents of qatar only|local hire|transferable visa|with noc|valid qid/i.test(text)) {
    score -= 25;
    gaps.push('visa');
  }

  if (job.postedAt) {
    const days = (Date.now() - new Date(job.postedAt).getTime()) / 864e5;
    if (days <= 3) score += 5;
    if (days > 30) score -= 10;
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, gaps };
}

export function localAnalysis(job: Job, _p: Profile, ls: LocalScore): Analysis {
  const s = ls.score;
  return {
    score: s,
    verdict: s >= 80 ? 'excellent' : s >= 65 ? 'good' : s >= 45 ? 'fair' : 'weak',
    reasons: ls.reasons,
    gaps: ls.gaps,
    keyRequirements: [],
    summary: '',
    language: job.language ?? 'en',
    by: 'local',
  };
}

/** Score a job needs before an application is prepared automatically. */
export function prepareThreshold(prefs: Profile['prefs'], by: 'ai' | 'local'): number {
  if (prefs.minScoreAuto === false) return prefs.minScore;
  // Auto: the AI's calibrated score already weighs blockers, so 60+ (a decent fit) is enough;
  // the keyword score is coarser and gets a slightly lower bar.
  return by === 'ai' ? 60 : 55;
}

/** True when a match should be prepared without asking. */
export function isStrongMatch(prefs: Profile['prefs'], score: number, analysis?: Analysis): boolean {
  // A "good" verdict only counts with a score to match, so an inconsistent answer cannot prepare a weak job.
  if (prefs.minScoreAuto !== false && analysis?.by === 'ai') return score >= 60 || ((analysis.verdict === 'excellent' || analysis.verdict === 'good') && score >= 50);
  return score >= prepareThreshold(prefs, analysis?.by ?? 'local');
}
