import type { JobSource } from '../types';
import { linkedin } from './linkedin';
import { workable } from './workable';
import { tanqeeb } from './tanqeeb';
import { smartrecruiters } from './smartrecruiters';
import { himalayas, remotive } from './remote';
import { googleJobs, jooble } from './keyed';

export const SOURCES: JobSource[] = [linkedin, tanqeeb, workable, smartrecruiters, googleJobs, jooble, himalayas, remotive];

export function sourceById(id: string): JobSource | undefined {
  return SOURCES.find((s) => s.id === id);
}

/** Boards that block automated reads; the app opens them with the search pre-filled. */
export const EXPLORE_LINKS: { id: string; label: string; url: (q: string) => string }[] = [
  { id: 'bayt', label: 'Bayt', url: (q) => `https://www.bayt.com/en/qatar/jobs/${encodeURIComponent(q.trim().toLowerCase().replace(/\s+/g, '-'))}-jobs/` },
  { id: 'gulftalent', label: 'GulfTalent', url: (q) => `https://www.gulftalent.com/qatar/jobs/title/${encodeURIComponent(q.trim().toLowerCase().replace(/\s+/g, '-'))}` },
  { id: 'naukrigulf', label: 'NaukriGulf', url: (q) => `https://www.naukrigulf.com/${encodeURIComponent(q.trim().toLowerCase().replace(/\s+/g, '-'))}-jobs-in-qatar` },
  { id: 'indeed', label: 'Indeed Qatar', url: (q) => `https://qa.indeed.com/jobs?q=${encodeURIComponent(q)}` },
  { id: 'linkedin', label: 'LinkedIn', url: (q) => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=Qatar` },
  { id: 'qatarliving', label: 'Qatar Living', url: () => 'https://www.qatarliving.com/jobs' },
  { id: 'glassdoor', label: 'Glassdoor', url: (q) => `https://www.glassdoor.com/Job/qatar-${encodeURIComponent(q.trim().toLowerCase().replace(/\s+/g, '-'))}-jobs-SRCH_IL.0,5_IN192.htm` },
  { id: 'drjobs', label: 'Dr.Job', url: (q) => `https://qa.drjobpro.com/jobs?q=${encodeURIComponent(q)}` },
];
