import type { Analysis, CareerTrack, Job, Profile } from './types';
import { QATAR_CITIES, cityOf, distanceKm } from './qatar';

const STOP = new Set(['and', 'or', 'the', 'of', 'in', 'for', 'a', 'an', 'to', 'with', 'at', 'senior', 'junior', 'sr', 'jr', 'lead', 'head', 'i', 'ii', 'iii', '-', '&', 'في', 'و', 'من']);

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9؀-ۿ+#.]+/g, ' ').split(' ').filter((t) => t.length > 1 && !STOP.has(t));
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

/** Search keywords: with tracks, titles are taken round-robin so every track is searched. */
export function buildQueries(profile: Profile, max = 8): string[] {
  const tracks = (profile.tracks ?? []).filter((t) => t.targetTitles.length || t.keywords?.length);
  let q: string[];
  if (tracks.length) {
    q = [];
    // Titles first, then keywords, taking one from each track in turn so every field is covered.
    const lists = tracks.map((t) => [...t.targetTitles, ...(t.keywords ?? [])]);
    for (let i = 0; q.length < max * 2 && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i]) q.push(l[i]);
  } else {
    const titles = profile.targetTitles.map((t) => t.trim()).filter(Boolean);
    q = titles.length ? titles : profile.headline ? [profile.headline] : profile.skills.slice(0, 2);
  }
  return [...new Set(q.map((s) => s.trim().toLowerCase()).filter(Boolean))].slice(0, tracks.length ? max : 4);
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
  // Unrelated titles only pass on a strong skills overlap, so other fields do not leak into the feed.
  if (bestTitle < 0.34 && matched.length < 3) return { score: 0, reasons, gaps, blocked: 'irrelevant' };
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
  // Auto: the AI's calibrated score already weighs blockers, so a "good" fit (65+) is enough;
  // the keyword score is coarser and gets a slightly lower bar.
  return by === 'ai' ? 65 : 55;
}

/** True when a match should be prepared without asking. */
export function isStrongMatch(prefs: Profile['prefs'], score: number, analysis?: Analysis): boolean {
  if (prefs.minScoreAuto !== false && analysis?.by === 'ai') return analysis.verdict === 'excellent' || analysis.verdict === 'good' || score >= 65;
  return score >= prepareThreshold(prefs, analysis?.by ?? 'local');
}
