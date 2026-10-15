import type { Job, Workplace } from '../types';
import { cityOf, isInQatar } from '../qatar';
import { detectLang, findEmail, findQatarPhone, htmlToText } from '../html';

export function nowIso(): string {
  return new Date().toISOString();
}

/** Jobs older than this are never shown or prepared. */
export const MAX_AGE_DAYS = 7;

const UNIT_MS: Record<string, number> = { minute: 60e3, hour: 3600e3, day: 864e5, week: 6048e5, month: 2592e6 };

/** Parses absolute dates and relative ones such as "3 hours ago", "yesterday", "قبل 2 يوم". */
export function parsePosted(raw?: string | number | null): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const text = String(raw).trim().toLowerCase();
  if (/^(just|today|now|new|اليوم|الآن|جديد)/.test(text)) return nowIso();
  if (/^(yesterday|أمس|امس)/.test(text)) return new Date(Date.now() - 864e5).toISOString();
  const rel = /(\d+|an?|one)\+?\s*(minute|min|hour|hr|day|week|month)s?\s*ago/.exec(text);
  if (rel) {
    const n = /^\d+$/.test(rel[1]) ? Number(rel[1]) : 1;
    const unit = rel[2].startsWith('min') ? 'minute' : rel[2].startsWith('h') ? 'hour' : rel[2];
    return new Date(Date.now() - n * UNIT_MS[unit]).toISOString();
  }
  const ar = /(\d+)\s*(دقيقة|دقائق|ساعة|ساعات|يوم|أيام|ايام|أسبوع|أسابيع|شهر|أشهر)/.exec(text);
  if (ar) {
    const u = ar[2];
    const ms = /دقي|دقا/.test(u) ? UNIT_MS.minute : /ساع/.test(u) ? UNIT_MS.hour : /يوم|يام/.test(u) ? UNIT_MS.day : /سبو|سابيع/.test(u) ? UNIT_MS.week : UNIT_MS.month;
    return new Date(Date.now() - Number(ar[1]) * ms).toISOString();
  }
  const d = typeof raw === 'number' ? new Date(raw) : new Date(String(raw));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** True when the job has a known posting date within the last MAX_AGE_DAYS days. */
export function isFresh(job: Pick<Job, 'postedAt'>, days = MAX_AGE_DAYS): boolean {
  if (!job.postedAt) return false;
  const age = Date.now() - new Date(job.postedAt).getTime();
  return age >= -864e5 && age <= days * 864e5;
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

/** Keeps only jobs located in Qatar (remote roles too, but only when they are explicitly based in Qatar). */
export function onlyQatar(jobs: Job[]): Job[] {
  return jobs.filter((j) => {
    const placedElsewhere = ELSEWHERE.test(`${j.title} ${j.location}`) && !/qatar|قطر/i.test(j.title);
    return isInQatar(j.location) && !placedElsewhere && !/worldwide|anywhere|global/i.test(j.location);
  });
}

/** True when a job is located in Qatar under the listing rules. */
export function inQatar(job: Job): boolean {
  return onlyQatar([job]).length > 0;
}

/** The listing rules: in Qatar, posted in the last 7 days, still accepting applications. */
export function listable(jobs: Job[]): Job[] {
  return onlyQatar(jobs).filter((j) => !j.closed && isFresh(j));
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
