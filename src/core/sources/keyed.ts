import type { Job, JobSource } from '../types';
import { clean, htmlToText } from '../html';
import { enrich, normalizeType, nowIso, parsePosted } from './util';

/** Jooble aggregates thousands of boards (Bayt, GulfTalent, company sites...). Free API key: jooble.org/api/about */
export const jooble: JobSource = {
  id: 'jooble',
  label: 'Jooble',
  needsKey: 'jooble',
  async search(ctx) {
    if (!ctx.keys.jooble) return [];
    const out: Job[] = [];
    for (const q of ctx.queries) {
      const txt = await ctx.fetchText(`https://jooble.org/api/${ctx.keys.jooble}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: q, location: 'Qatar' }),
      });
      const data = JSON.parse(txt) as { jobs?: Record<string, string>[] };
      for (const j of data.jobs ?? []) {
        out.push(
          enrich({
            id: `jooble:${j.id}`,
            source: 'jooble',
            sourceLabel: `Jooble${j.source ? ' · ' + j.source : ''}`,
            title: clean(j.title),
            company: clean(j.company),
            location: j.location || 'Qatar',
            url: j.link,
            applyUrl: j.link,
            description: htmlToText(j.snippet ?? ''),
            postedAt: parsePosted(j.updated),
            employmentType: normalizeType(j.type),
            salary: j.salary || undefined,
            fetchedAt: nowIso(),
          }),
        );
      }
    }
    return out;
  },
};

/** Google for Jobs via SerpApi — the widest coverage (Bayt, GulfTalent, NaukriGulf, Indeed, LinkedIn, company sites). */
export const googleJobs: JobSource = {
  id: 'google',
  label: 'Google Jobs',
  needsKey: 'serpapi',
  async search(ctx) {
    if (!ctx.keys.serpapi) return [];
    const out: Job[] = [];
    for (const q of ctx.queries.slice(0, 2)) {
      const txt = await ctx.fetchText(`https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(q + ' Qatar')}&location=Qatar&gl=qa&hl=en&api_key=${ctx.keys.serpapi}`);
      const data = JSON.parse(txt) as { jobs_results?: Record<string, unknown>[] };
      for (const j of data.jobs_results ?? []) {
        const ext = (j.detected_extensions ?? {}) as Record<string, string>;
        const opts = (j.apply_options ?? []) as { title: string; link: string }[];
        out.push(
          enrich({
            id: `google:${(j.job_id as string).slice(0, 80)}`,
            source: 'google',
            sourceLabel: `Google Jobs${j.via ? ' · ' + String(j.via).replace(/^via /, '') : ''}`,
            title: clean(j.title as string),
            company: clean(j.company_name as string),
            logo: j.thumbnail as string | undefined,
            location: (j.location as string) || 'Qatar',
            url: opts[0]?.link ?? (j.share_link as string),
            applyUrl: opts[0]?.link,
            description: String(j.description ?? ''),
            postedAt: parsePosted(ext.posted_at),
            employmentType: normalizeType(ext.schedule_type),
            salary: ext.salary,
            fetchedAt: nowIso(),
          }),
        );
      }
    }
    return out;
  },
};
