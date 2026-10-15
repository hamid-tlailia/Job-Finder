import type { Job, JobSource } from '../types';
import { clean, htmlToText } from '../html';
import { enrich, normalizeType, nowIso } from './util';

const OPEN_TO_QATAR = /worldwide|anywhere|global|middle east|mena|gcc|emea|qatar|asia/i;

export const himalayas: JobSource = {
  id: 'himalayas',
  label: 'Himalayas (Remote)',
  remoteOnly: true,
  async search(ctx) {
    const out: Job[] = [];
    for (const q of ctx.queries) {
      const txt = await ctx.fetchText(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}`);
      const data = JSON.parse(txt) as { jobs?: Record<string, unknown>[] };
      for (const j of data.jobs ?? []) {
        const restr = (j.locationRestrictions as string[] | undefined) ?? [];
        if (restr.length && !restr.some((r) => OPEN_TO_QATAR.test(r))) continue;
        const pub = Number(j.pubDate);
        out.push(
          enrich({
            id: `himalayas:${j.guid}`,
            source: 'himalayas',
            sourceLabel: 'Himalayas',
            title: clean(j.title as string),
            company: clean(j.companyName as string),
            logo: j.companyLogo as string,
            location: restr.length ? `Remote · ${restr.join(', ')}` : 'Remote · Worldwide',
            url: j.applicationLink as string,
            applyUrl: j.applicationLink as string,
            description: htmlToText((j.description as string) ?? ''),
            postedAt: pub ? new Date(pub * 1000).toISOString() : undefined,
            employmentType: normalizeType(j.employmentType as string),
            workplace: 'remote',
            salary: j.minSalary ? `${j.minSalary}–${j.maxSalary ?? ''} ${j.currency ?? ''}/${j.salaryPeriod ?? 'yr'}` : undefined,
            fetchedAt: nowIso(),
          }),
        );
      }
    }
    return out;
  },
};

export const remotive: JobSource = {
  id: 'remotive',
  label: 'Remotive (Remote)',
  remoteOnly: true,
  async search(ctx) {
    const out: Job[] = [];
    for (const q of ctx.queries) {
      const txt = await ctx.fetchText(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=30`);
      const data = JSON.parse(txt) as { jobs?: Record<string, string>[] };
      for (const j of data.jobs ?? []) {
        if (!OPEN_TO_QATAR.test(j.candidate_required_location ?? '')) continue;
        out.push(
          enrich({
            id: `remotive:${j.id}`,
            source: 'remotive',
            sourceLabel: 'Remotive',
            title: clean(j.title),
            company: clean(j.company_name),
            logo: j.company_logo,
            location: `Remote · ${j.candidate_required_location}`,
            url: j.url,
            applyUrl: j.url,
            description: htmlToText(j.description ?? ''),
            postedAt: j.publication_date,
            employmentType: normalizeType(j.job_type),
            workplace: 'remote',
            salary: j.salary || undefined,
            fetchedAt: nowIso(),
          }),
        );
      }
    }
    return out;
  },
};
