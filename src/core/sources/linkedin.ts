import type { Job, JobSource } from '../types';
import { attr, between, clean, htmlToText } from '../html';
import { enrich, normalizeType, nowIso } from './util';

function parseCards(html: string): Job[] {
  const parts = html.split(/<li[\s>]/).slice(1);
  const jobs: Job[] = [];
  for (const p of parts) {
    const urn = /urn:li:jobPosting:(\d+)/.exec(p)?.[1];
    if (!urn) continue;
    const title = clean(between(p, /class="base-search-card__title"[^>]*>/, '</h3>'));
    const company = clean(between(p, /class="base-search-card__subtitle"[^>]*>/, '</h4>'));
    const location = clean(between(p, /class="job-search-card__location"[^>]*>/, '</span>'));
    const href = /class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/.exec(p)?.[1];
    const date = /<time[^>]*datetime="([^"]+)"/.exec(p)?.[1];
    const logo = attr(/<img[^>]*artdeco-entity-image[^>]*>/.exec(p)?.[0] ?? '', 'data-delayed-url');
    if (!title) continue;
    jobs.push({
      id: `linkedin:${urn}`,
      source: 'linkedin',
      sourceLabel: 'LinkedIn',
      title,
      company,
      logo,
      location: location || 'Qatar',
      url: href ? href.split('?')[0].replace(/&amp;/g, '&') : `https://www.linkedin.com/jobs/view/${urn}`,
      description: '',
      postedAt: date,
      needsDetail: true,
      fetchedAt: nowIso(),
    });
  }
  return jobs;
}

export const linkedin: JobSource = {
  id: 'linkedin',
  label: 'LinkedIn',
  async search(ctx) {
    const out: Job[] = [];
    for (const q of ctx.queries) {
      for (const start of [0, 25]) {
        const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(q)}&location=Qatar&f_TPR=r1209600&start=${start}`;
        const html = await ctx.fetchText(url);
        const cards = parseCards(html);
        out.push(...cards);
        if (cards.length < 10) break;
      }
    }
    return out;
  },
  async detail(job, ctx) {
    const id = job.id.split(':')[1];
    const html = await ctx.fetchText(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`);
    const desc = between(html, /class="show-more-less-html__markup[^"]*"[^>]*>/, '</div>') ?? '';
    const criteria = [...html.matchAll(/description__job-criteria-subheader[^>]*>([\s\S]*?)<\/h3>[\s\S]*?description__job-criteria-text[^>]*>([\s\S]*?)<\/span>/g)].map((m) => [clean(m[1]), clean(m[2])]);
    const type = criteria.find(([k]) => /employment type/i.test(k))?.[1];
    const level = criteria.find(([k]) => /seniority/i.test(k))?.[1];
    const applyUrl = /<code id="applyUrl"[^>]*><!--"([^"]+)"/.exec(html)?.[1];
    return enrich({ ...job, description: htmlToText(desc), employmentType: normalizeType(type), experience: level, applyUrl: applyUrl ? decodeURIComponent(applyUrl.replace(/.*url=/, '')) : undefined, needsDetail: false });
  },
};
