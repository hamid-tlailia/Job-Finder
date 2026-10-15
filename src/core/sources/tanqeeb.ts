import type { Job, JobSource } from '../types';
import { attr, decodeEntities, htmlToText } from '../html';
import { eachQuery, enrich, normalizeType, normalizeWorkplace, nowIso, parseJsonLdJob } from './util';

const BASE = 'https://qatar.tanqeeb.com';

function parse(html: string): Job[] {
  const re = /<[a-z]+\b[^>]+data-drawer-trigger="job-card"[\s\S]*?data-share-copy="[^"]*">/g;
  const starts = [...html.matchAll(re)];
  return starts.flatMap((m, i) => {
    const c = m[0];
    // The card body carries the full description, HTML-escaped, in a hidden element.
    const segment = html.slice(m.index ?? 0, starts[i + 1]?.index ?? html.length);
    const escaped = /job-card-description-source[^>]*>([\s\S]*?)<\/div>/.exec(segment)?.[1];
    const fullDesc = escaped ? htmlToText(decodeEntities(escaped)) : '';
    const id = attr(c, 'data-job-id');
    const title = attr(c, 'data-job-name');
    if (!id || !title || attr(c, 'data-job-closed') === '1') return [];
    const rel = attr(c, 'data-job-url') ?? '';
    const date = attr(c, 'data-job-date');
    const parsedDate = date ? new Date(date) : undefined;
    const logo = attr(c, 'data-job-logo');
    const job: Job = {
      id: `tanqeeb:${id}`,
      source: 'tanqeeb',
      sourceLabel: `Tanqeeb${attr(c, 'data-job-source') && attr(c, 'data-job-source') !== 'Tanqeeb.com' ? ' · ' + attr(c, 'data-job-source') : ''}`,
      title,
      company: attr(c, 'data-job-confidential') === '1' ? '' : attr(c, 'data-job-company') ?? '',
      logo: logo && !logo.includes('companyavatar') ? (logo.startsWith('//') ? `https:${logo}` : logo) : undefined,
      location: attr(c, 'data-job-location') ?? 'Qatar',
      url: rel.startsWith('http') ? rel : BASE + rel,
      applyUrl: BASE + (attr(c, 'data-job-apply-url') ?? rel),
      description: fullDesc || [attr(c, 'data-job-categories'), attr(c, 'data-job-industry'), attr(c, 'data-job-education'), attr(c, 'data-job-local-only'), attr(c, 'data-job-gender') && `Gender: ${attr(c, 'data-job-gender')}`].filter(Boolean).join(' · '),
      postedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : undefined,
      employmentType: normalizeType(attr(c, 'data-job-type')),
      workplace: normalizeWorkplace(attr(c, 'data-job-workplace')),
      salary: attr(c, 'data-job-salary') || undefined,
      contactEmail: attr(c, 'data-job-contact-email') || undefined,
      contactPhone: attr(c, 'data-job-contact-phone') || undefined,
      experience: attr(c, 'data-job-experience') || undefined,
      needsDetail: !fullDesc,
      fetchedAt: nowIso(),
    };
    return [fullDesc ? enrich(job) : job];
  });
}

export const tanqeeb: JobSource = {
  id: 'tanqeeb',
  label: 'Tanqeeb',
  async search(ctx) {
    return eachQuery(ctx.queries, async (q) => {
      const k = encodeURIComponent(q);
      const first = parse(await ctx.fetchText(`${BASE}/jobs/search?keywords=${k}`));
      if (first.length < 15) return first;
      try {
        return [...first, ...parse(await ctx.fetchText(`${BASE}/jobs/search/page/2?keywords=${k}`))];
      } catch {
        return first;
      }
    });
  },
  async detail(job, ctx) {
    const html = await ctx.fetchText(job.url);
    const ld = parseJsonLdJob(html);
    return enrich({ ...job, ...ld, description: ld?.description || job.description, employmentType: job.employmentType ?? ld?.employmentType, needsDetail: false });
  },
};
