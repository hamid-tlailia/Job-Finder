import type { Job, Workplace } from '../types';
import { cityOf, isInQatar } from '../qatar';
import { detectLang, findEmail, findQatarPhone, htmlToText } from '../html';

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeType(raw?: string): string | undefined {
  if (!raw) return undefined;
  const l = raw.toLowerCase();
  if (/part|جزئي/.test(l)) return 'part_time';
  if (/intern|تدريب/.test(l)) return 'internship';
  if (/contract|contractor|عقد/.test(l)) return 'contract';
  if (/temp|مؤقت/.test(l)) return 'temporary';
  if (/freelance|حر/.test(l)) return 'freelance';
  if (/full|كامل/.test(l)) return 'full_time';
  return undefined;
}

export function normalizeWorkplace(raw?: string): Workplace | undefined {
  if (!raw) return undefined;
  const l = raw.toLowerCase();
  if (/remote|telecommute|عن بعد|عن بُعد/.test(l)) return 'remote';
  if (/hybrid|هجين/.test(l)) return 'hybrid';
  if (/on-?site|office|في الموقع/.test(l)) return 'onsite';
  return undefined;
}

/** Fills derived fields (city, contacts, language) from the free-text description. */
export function enrich(job: Job): Job {
  const text = `${job.title}\n${job.description}`;
  return {
    ...job,
    city: job.city ?? cityOf(job.location)?.id,
    contactEmail: job.contactEmail ?? findEmail(job.description),
    contactPhone: job.contactPhone ?? (/whats\s?app|واتس/i.test(job.description) ? findQatarPhone(job.description) : undefined),
    language: job.language ?? detectLang(text),
    workplace: job.workplace ?? normalizeWorkplace(job.description.slice(0, 600)),
  };
}

const ELSEWHERE = /saudi|ksa|riyadh|jeddah|dammam|\buae\b|dubai|abu dhabi|sharjah|kuwait|oman|muscat|bahrain|manama|egypt|cairo|jordan|amman|السعودية|الرياض|جدة|الإمارات|دبي|أبوظبي|الكويت|عمان|مسقط|البحرين|مصر|الأردن/i;

/** Keeps Qatar-based (or open remote) jobs and drops ones whose title or location points to another country. */
export function onlyQatar(jobs: Job[]): Job[] {
  return jobs.filter((j) => {
    const placedElsewhere = ELSEWHERE.test(`${j.title} ${j.location}`) && !/qatar|قطر/i.test(j.title);
    if (j.workplace === 'remote') return !placedElsewhere || /remote/i.test(j.location);
    return isInQatar(j.location) && !placedElsewhere;
  });
}

/** Parses a schema.org JobPosting embedded as JSON-LD, which many job pages include. */
export function parseJsonLdJob(html: string): Partial<Job> | undefined {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const b of blocks) {
    const body = b.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      const data = JSON.parse(body);
      const list = Array.isArray(data) ? data : data['@graph'] ?? [data];
      const jp = list.find((x: { '@type'?: string }) => x && x['@type'] === 'JobPosting');
      if (!jp) continue;
      const salary = jp.baseSalary?.value;
      return {
        description: htmlToText(jp.description ?? ''),
        employmentType: normalizeType(Array.isArray(jp.employmentType) ? jp.employmentType[0] : jp.employmentType),
        postedAt: jp.datePosted,
        salary: salary?.minValue ? `${salary.minValue}${salary.maxValue ? '–' + salary.maxValue : ''} ${jp.baseSalary?.currency ?? ''}`.trim() : undefined,
      };
    } catch {
      /* malformed JSON-LD block */
    }
  }
  return undefined;
}

export async function settle<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const next = queue.shift()!;
      try {
        await fn(next);
      } catch {
        /* individual failures are tolerated */
      }
    }
  });
  await Promise.all(workers);
}

/**
 * Runs one search per query and keeps whatever succeeded; a source only fails when every
 * query failed (e.g. LinkedIn rate-limits the second query after the first one worked).
 */
export async function eachQuery(queries: string[], fn: (q: string) => Promise<Job[]>): Promise<Job[]> {
  const out: Job[] = [];
  let lastError: unknown;
  for (const q of queries) {
    try {
      out.push(...(await fn(q)));
    } catch (e) {
      lastError = e;
    }
  }
  if (!out.length && lastError) throw lastError;
  return out;
}
