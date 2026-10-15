/* Runs in Capacitor Background Runner (no DOM, no web view): periodic job checks while the app is closed. */
import type { Job, Profile, SourceContext } from '../core/types';
import { SOURCES } from '../core/sources';
import { listable } from '../core/sources/util';
import { bestTrack, buildQueries, dedupeKey, prepareThreshold } from '../core/match';
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

async function fetchText(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<string> {
  const res = await fetch(url, { method: init.method ?? 'GET', headers: { 'User-Agent': BROWSER_UA, ...init.headers }, body: init.body });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

addEventListener('sync', (resolve, _reject, args) => {
  CapacitorKV.set('config', JSON.stringify(args));
  resolve();
});

addEventListener('drain', (resolve) => {
  const jobs = kvGet<Job[]>('pending', []);
  CapacitorKV.set('pending', '[]');
  resolve({ jobs });
});

addEventListener('checkJobs', async (resolve) => {
  try {
    const cfg = kvGet<Config | null>('config', null);
    if (!cfg || !cfg.profile.targetTitles.length) return resolve();
    const seen = new Set<string>([...cfg.known, ...kvGet<string[]>('seen', [])]);
    const ctx: SourceContext = { queries: buildQueries(cfg.profile).slice(0, 3), profile: cfg.profile, keys: cfg.keys, fetchText };
    const remoteOk = cfg.profile.prefs.workplaces.includes('remote');
    const found: Job[] = [];
    for (const s of SOURCES) {
      if (cfg.sources[s.id] === false || (s.remoteOnly && !remoteOk)) continue;
      if (s.needsKey && !cfg.keys[s.needsKey]) continue;
      if (s.id === 'google') continue; // keep the SerpApi monthly quota for foreground searches
      try {
        found.push(...(await s.search(ctx)));
      } catch {
        /* one failing board must not stop the others */
      }
    }
    const threshold = Math.max(35, prepareThreshold(cfg.profile.prefs, 'local') - 10);
    const fresh: Job[] = [];
    for (const j of listable(found)) {
      const key = dedupeKey(j);
      if (seen.has(key) || seen.has(j.id)) continue;
      seen.add(key);
      const ls = bestTrack(j, cfg.profile).score;
      if (!ls.blocked && ls.score >= threshold) fresh.push(j);
    }
    CapacitorKV.set('seen', JSON.stringify([...seen].slice(-1500)));
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
    resolve();
  } catch {
    resolve();
  }
});
