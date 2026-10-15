import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { BROWSER_UA } from '../core/allowlist';

export type FetchInit = { method?: string; headers?: Record<string, string>; body?: string };

export const isNative = Capacitor.isNativePlatform();

/** Minimum spacing between requests to the same host — LinkedIn answers bursts with HTTP 429. */
const MIN_GAP_MS: Record<string, number> = { 'www.linkedin.com': 2500, 'qatar.tanqeeb.com': 700 };
/** SerpApi runs a live Google search per call and regularly needs 20–40 s. */
const READ_TIMEOUT_MS: Record<string, number> = { 'serpapi.com': 75000, 'jooble.org': 45000 };
/** After a 429 the host is left alone for this long instead of being hammered again. */
const COOLDOWN_MS = 30 * 60000;
const COOLDOWN_KEY = 'jf-cooldown';

export class HttpError extends Error {
  readonly status: number;
  readonly host: string;
  constructor(status: number, host: string) {
    super(`HTTP ${status} ${host}`);
    this.status = status;
    this.host = host;
  }
}

function cooldowns(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(COOLDOWN_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export function coolingDown(host: string): boolean {
  return (cooldowns()[host] ?? 0) > Date.now();
}

function startCooldown(host: string): void {
  try {
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify({ ...cooldowns(), [host]: Date.now() + COOLDOWN_MS }));
  } catch {
    /* storage unavailable: the next run simply tries again */
  }
}

const queues = new Map<string, Promise<unknown>>();

/** Runs requests to one host one after another, spaced by MIN_GAP_MS. */
function throttled<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const gap = MIN_GAP_MS[host] ?? 0;
  const prev = queues.get(host) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  queues.set(
    host,
    run.catch(() => undefined).then(() => new Promise((r) => setTimeout(r, gap))),
  );
  return run;
}

async function request(url: string, host: string, init: FetchInit): Promise<string> {
  if (isNative) {
    const res = await CapacitorHttp.request({
      url,
      method: init.method ?? 'GET',
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8', Accept: 'text/html,application/json;q=0.9,*/*;q=0.8', ...init.headers },
      data: init.body,
      responseType: 'text',
      connectTimeout: 15000,
      readTimeout: READ_TIMEOUT_MS[host] ?? 25000,
    });
    if (res.status >= 400) throw new HttpError(res.status, host);
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }
  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, ...init }),
  });
  if (!res.ok) throw new HttpError(res.status, host);
  return res.text();
}

export async function fetchText(url: string, init: FetchInit = {}): Promise<string> {
  const host = new URL(url).hostname;
  if (coolingDown(host)) throw new HttpError(429, host);
  try {
    return await throttled(host, () => request(url, host, init));
  } catch (e) {
    if (e instanceof HttpError && e.status === 429) startCooldown(host);
    throw e;
  }
}
