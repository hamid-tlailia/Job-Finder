import type { Job, JobSource } from '../types';
import { clean, htmlToText } from '../html';
import { enrich, normalizeType, normalizeWorkplace, nowIso } from './util';

interface WorkableJob {
  id: string;
  title: string;
  description?: string;
  requirementsSection?: string;
  benefitsSection?: string;
  employmentType?: string;
  url: string;
  language?: string;
  locations?: string[];
  location?: { city?: string; countryName?: string };
  created?: string;
  company?: { title?: string; image?: string };
  workplace?: string;
}

export const workable: JobSource = {
  id: 'workable',
  label: 'Workable',
  async search(ctx) {
    const out: Job[] = [];
    for (const q of ctx.queries) {
      const txt = await ctx.fetchText(`https://jobs.workable.com/api/v1/jobs?location=Qatar&query=${encodeURIComponent(q)}`);
      const data = JSON.parse(txt) as { jobs?: WorkableJob[] };
      for (const j of data.jobs ?? []) {
        const loc = [j.location?.city, j.location?.countryName].filter(Boolean).join(', ') || 'Qatar';
        const desc = [j.description, j.requirementsSection && `<h3>Requirements</h3>${j.requirementsSection}`, j.benefitsSection && `<h3>Benefits</h3>${j.benefitsSection}`].filter(Boolean).join('\n');
        out.push(
          enrich({
            id: `workable:${j.id}`,
            source: 'workable',
            sourceLabel: 'Workable',
            title: clean(j.title),
            company: clean(j.company?.title),
            logo: j.company?.image,
            location: loc,
            url: j.url,
            applyUrl: j.url,
            description: htmlToText(desc),
            postedAt: j.created,
            employmentType: normalizeType(j.employmentType),
            workplace: normalizeWorkplace(j.workplace),
            language: j.language === 'ar' ? 'ar' : undefined,
            fetchedAt: nowIso(),
          }),
        );
      }
    }
    return out;
  },
};
