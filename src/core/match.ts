import type { Analysis, Job, Profile } from './types';
import { QATAR_CITIES, cityOf, distanceKm } from './qatar';

const STOP = new Set(['and', 'or', 'the', 'of', 'in', 'for', 'a', 'an', 'to', 'with', 'at', 'senior', 'junior', 'sr', 'jr', 'lead', 'head', 'i', 'ii', 'iii', '-', '&', 'في', 'و', 'من']);

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9؀-ۿ+#.]+/g, ' ').split(' ').filter((t) => t.length > 1 && !STOP.has(t));
}

export function dedupeKey(job: Job): string {
  return `${tokens(job.title).sort().join(' ')}|${tokens(job.company).join(' ')}`;
}

export function buildQueries(profile: Profile): string[] {
  const titles = profile.targetTitles.map((t) => t.trim()).filter(Boolean);
  const q = titles.length ? titles : profile.headline ? [profile.headline] : profile.skills.slice(0, 2);
  return [...new Set(q.map((s) => s.toLowerCase()))].slice(0, 4);
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

  let score = 20;

  const jt = new Set(tokens(job.title));
  let bestTitle = 0;
  for (const t of p.targetTitles.length ? p.targetTitles : [p.headline]) {
    const tt = tokens(t);
    if (!tt.length) continue;
    const hit = tt.filter((x) => jt.has(x) || [...jt].some((y) => y.startsWith(x) || x.startsWith(y))).length / tt.length;
    bestTitle = Math.max(bestTitle, hit);
  }
  score += Math.round(bestTitle * 40);
  if (bestTitle >= 0.7) reasons.push('title');

  const matched = p.skills.filter((s) => s.trim().length > 1 && text.includes(s.trim().toLowerCase()));
  if (bestTitle < 0.34 && matched.length < 2) return { score: 0, reasons, gaps, blocked: 'irrelevant' };
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
