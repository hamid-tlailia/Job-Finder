import type { Job, JobSource } from '../types';
import { htmlToText } from '../html';
import { enrich, normalizeType, nowIso } from './util';

/** Employers with Qatar openings on SmartRecruiters (public postings API, filtered by country). */
const COMPANIES = ['DeliveryHero'];

interface SrPosting {
  id: string;
  name: string;
  company?: { name?: string };
  location?: { city?: string; country?: string; remote?: boolean };
  releasedDate?: string;
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
}

export const smartrecruiters: JobSource = {
  id: 'smartrecruiters',
  label: 'SmartRecruiters',
  async search(ctx) {
    const out: Job[] = [];
    const words = ctx.queries.flatMap((q) => q.toLowerCase().split(/\s+/)).filter((w) => w.length > 2);
    for (const c of COMPANIES) {
      const txt = await ctx.fetchText(`https://api.smartrecruiters.com/v1/companies/${c}/postings?country=qa&limit=100`);
      const data = JSON.parse(txt) as { content?: SrPosting[] };
      for (const p of data.content ?? []) {
        if (words.length && !words.some((w) => p.name.toLowerCase().includes(w))) continue;
        out.push({
          id: `smartrecruiters:${c}:${p.id}`,
          source: 'smartrecruiters',
          sourceLabel: 'SmartRecruiters',
          title: p.name,
          company: p.company?.name ?? c,
          location: [p.location?.city, 'Qatar'].filter(Boolean).join(', '),
          url: `https://jobs.smartrecruiters.com/${c}/${p.id}`,
          applyUrl: `https://jobs.smartrecruiters.com/${c}/${p.id}`,
          description: '',
          postedAt: p.releasedDate,
          employmentType: normalizeType(p.typeOfEmployment?.label),
          experience: p.experienceLevel?.label,
          workplace: p.location?.remote ? 'remote' : undefined,
          needsDetail: true,
          fetchedAt: nowIso(),
        });
      }
    }
    return out;
  },
  async detail(job, ctx) {
    const [, company, id] = job.id.split(':');
    const txt = await ctx.fetchText(`https://api.smartrecruiters.com/v1/companies/${company}/postings/${id}`);
    const d = JSON.parse(txt) as { jobAd?: { sections?: Record<string, { title?: string; text?: string }> }; applyUrl?: string };
    const sections = Object.values(d.jobAd?.sections ?? {}).map((s) => `<h3>${s.title ?? ''}</h3>${s.text ?? ''}`).join('\n');
    return enrich({ ...job, description: htmlToText(sections), applyUrl: d.applyUrl ?? job.applyUrl, needsDetail: false });
  },
};
