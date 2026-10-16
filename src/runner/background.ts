/* Runs in Capacitor Background Runner (no DOM, no web view): periodic job checks while the app is closed. */
import type { Job, Profile, SourceContext } from '../core/types';
import { SOURCES } from '../core/sources';
import { listable } from '../core/sources/util';
import { bestTrack, buildQueries, deepQueries, dedupeKey, prepareThreshold } from '../core/match';
import { BROWSER_UA } from '../core/allowlist';

declare const CapacitorKV: { get(k: string): { value: string } | null | undefined; set(k: string, v: string): void };
declare const CapacitorNotifications: { schedule(o: unknown[]): void };
declare function addEventListener(name: string, cb: (resolve: (v?: unknown) => void, reject: (e?: unknown) => void, args: unknown) => void): void;

interface Config {
  profile: Profile;
  keys: { jooble?: string; serpapi?: string };
  sources: Record<string, boolean>;
  uiLang: 'ar' | 'en';
  notifications: boolean;
  known: string[];
  /** Prepared applications waiting in Review when the app last synced. */
  waiting?: number;
  syncedAt?: number;
}

function kvGet<T>(k: string, fallback: T): T {
  try {
    const v = CapacitorKV.get(k);
    const raw = typeof v === 'string' ? v : v?.value;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const lastHit: Record<string, number> = {};
const DAY = 864e5;

async function fetchText(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<string> {
  // Space requests to one host like the app does; LinkedIn answers bursts with HTTP 429.
  const host = url.split('/')[2];
  const gap = host === 'www.linkedin.com' ? 2000 : 500;
  const wait = (lastHit[host] ?? 0) + gap - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit[host] = Date.now();
  const res = await fetch(url, { method: init.method ?? 'GET', headers: { 'User-Agent': BROWSER_UA, ...init.headers }, body: init.body });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

addEventListener('sync', (resolve, _reject, args) => {
  CapacitorKV.set('config', JSON.stringify(args));
  resolve();
});

addEventListener('status', (resolve) => {
  resolve(kvGet('status', {}));
});

addEventListener('drain', (resolve) => {
  const jobs = kvGet<Job[]>('pending', []);
  CapacitorKV.set('pending', '[]');
  resolve({ jobs });
});

addEventListener('checkJobs', async (resolve) => {
  try {
    const cfg = kvGet<Config | null>('config', null);
    // Career tracks carry their own titles, so a profile with tracks but no general titles is still searched.
    if (!cfg || !buildQueries(cfg.profile).length) {
      CapacitorKV.set('status', JSON.stringify({ at: new Date().toISOString(), found: 0, fresh: 0, error: 'no-profile' }));
      return resolve({ found: 0, fresh: 0 });
    }
    const seen = new Set<string>([...cfg.known, ...kvGet<string[]>('seen2', [])]);
    // The broad field of every track plus a few specific titles. One page each (newest first) is enough
    // to catch what was posted since the last hourly check and keeps the run short.
    const queries = [...new Set([...deepQueries(cfg.profile), ...buildQueries(cfg.profile).slice(0, 6)])].slice(0, 8);
    const ctx: SourceContext = { queries, deep: [], profile: cfg.profile, keys: cfg.keys, fetchText };
    const errors: string[] = [];
    const remoteOk = cfg.profile.prefs.workplaces.includes('remote');
    const found: Job[] = [];
    for (const s of SOURCES) {
      if (cfg.sources[s.id] === false || (s.remoteOnly && !remoteOk)) continue;
      if (s.needsKey && !cfg.keys[s.needsKey]) continue;
      if (s.id === 'google') continue; // keep the SerpApi monthly quota for foreground searches
      try {
        found.push(...(await s.search(ctx)));
      } catch (e) {
        errors.push(`${s.id}: ${e instanceof Error ? e.message : e}`); // one failing board must not stop the others
      }
    }
    const threshold = Math.max(35, prepareThreshold(cfg.profile.prefs, 'local') - 10);
    const fresh: Job[] = [];
    for (const j of listable(found)) {
      const key = dedupeKey(j);
      if (seen.has(key) || seen.has(j.id)) continue;
      const ls = bestTrack(j, cfg.profile).score;
      // Only reported jobs count as seen, so weaker ones are re-checked when the profile or tracks change.
      if (ls.blocked || ls.score < threshold) continue;
      seen.add(key);
      fresh.push(j);
    }
    CapacitorKV.set('seen2', JSON.stringify([...seen].slice(-1500)));
    if (fresh.length) {
      const pending = kvGet<Job[]>('pending', []);
      CapacitorKV.set('pending', JSON.stringify([...pending, ...fresh].slice(-60)));
      if (cfg.notifications) {
        const ar = cfg.uiLang === 'ar';
        CapacitorNotifications.schedule([
          {
            id: 4242,
            title: ar ? `🎯 ${fresh.length} وظائف جديدة تناسبك` : `🎯 ${fresh.length} new jobs match you`,
            body: ar ? `${fresh[0].title} — ${fresh[0].company}. افتح التطبيق لتجهيز السيرة وخطاب التقديم.` : `${fresh[0].title} — ${fresh[0].company}. Open the app to prepare your CV and cover letter.`,
            smallIcon: 'ic_stat_notify', largeIcon: 'ic_notify_large',
            actionTypeId: 'open_review',
            autoCancel: true,
          },
        ]);
      }
    }
    // One reminder a day at most, only while prepared applications wait and the app has not been opened for a day.
    const now = Date.now();
    if (!fresh.length && cfg.notifications && (cfg.waiting ?? 0) > 0 && now - (cfg.syncedAt ?? now) > DAY && now - kvGet<number>('remindedAt', 0) > DAY) {
      CapacitorKV.set('remindedAt', JSON.stringify(now));
      const ar = cfg.uiLang === 'ar';
      CapacitorNotifications.schedule([
        {
          id: 4244,
          title: ar ? `⏰ ${cfg.waiting} طلبات جاهزة تنتظرك` : `⏰ ${cfg.waiting} applications are waiting`,
          body: ar ? 'السيرة وخطاب التقديم جاهزان. راجعها وأرسلها قبل أن تُغلق الوظائف.' : 'Your CV and cover letter are ready. Review and send before the jobs close.',
          smallIcon: 'ic_stat_notify', largeIcon: 'ic_notify_large',
          actionTypeId: 'open_review',
          autoCancel: true,
        },
      ]);
    }
    CapacitorKV.set('status', JSON.stringify({ at: new Date().toISOString(), found: found.length, fresh: fresh.length, error: errors.join(' · ') || undefined }));
    resolve({ found: found.length, fresh: fresh.length });
  } catch (e) {
    CapacitorKV.set('status', JSON.stringify({ at: new Date().toISOString(), found: 0, fresh: 0, error: String(e) }));
    resolve();
  }
});
