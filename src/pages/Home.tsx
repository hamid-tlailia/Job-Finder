import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, Radar, RefreshCw, Settings2, SlidersHorizontal, Sparkles, TriangleAlert } from 'lucide-react';
import { QuickPrefs } from '../ui/QuickPrefs';
import { useEffect, useMemo, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { scoreOf, useStore } from '../store/useStore';
import { useT } from '../i18n';
import { Button, Empty, Logo, SectionTitle, toast } from '../ui/kit';
import { JobCard } from '../ui/JobCard';
import { useNav } from '../ui/nav';
import { runSearch } from '../lib/pipeline';
import { EXPLORE_LINKS } from '../core/sources';
import { buildQueries } from '../core/match';
import { listable } from '../core/sources/util';
import { avoidedIndustry } from '../core/industries';

type Filter = 'all' | 'ready' | 'new' | 'saved';

const REFRESH_GAP_MS = 30 * 60000;

export default function Home() {
  const { t, f, ago } = useT();
  const { profile, matches, jobs, run, lastRun, settings } = useStore();
  const push = useNav((s) => s.push);
  const [filter, setFilter] = useState<Filter>('all');
  const [showErrors, setShowErrors] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [trackFilter, setTrackFilter] = useState<string>('all');
  const tracks = profile.tracks ?? [];

  const list = useMemo(() => {
    const all = Object.values(matches).filter(
      (m) => jobs[m.jobId] && m.status !== 'dismissed' && !['applied', 'interview', 'offer', 'rejected'].includes(m.status) && (m.status !== 'new' || (listable([jobs[m.jobId]]).length > 0 && !avoidedIndustry(jobs[m.jobId], profile.prefs.avoidIndustries))),
    );
    const filtered = all.filter((m) => (filter === 'all' || (filter === 'new' ? m.status === 'new' : m.status === filter)) && (trackFilter === 'all' || m.trackId === trackFilter));
    return filtered.sort((a, b) => scoreOf(b, jobs[b.jobId]) - scoreOf(a, jobs[a.jobId])).slice(0, 120);
  }, [matches, jobs, filter, trackFilter, profile.prefs.avoidIndustries]);

  const counts = useMemo(() => {
    const v = Object.values(matches);
    return { ready: v.filter((m) => m.status === 'ready').length, new: v.filter((m) => m.status === 'new').length, applied: v.filter((m) => ['applied', 'interview', 'offer'].includes(m.status)).length };
  }, [matches]);

  const first = profile.fullName.split(' ')[0];
  const query = buildQueries(profile)[0] ?? '';
  const pct = run.total ? Math.round((run.done / run.total) * 100) : 0;

  const friendlyError = (e: string) => {
    const i = e.indexOf(': ');
    const [label, msg] = i > 0 ? [e.slice(0, i), e.slice(i + 2)] : ['', e];
    const nice = /HTTP 429/.test(msg) ? t.home.errRate : /time ?out|timed out/i.test(msg) ? t.home.errTimeout : /HTTP 40[13]/.test(msg) ? t.home.errBlocked : /network|failed to fetch|unable to resolve|connect/i.test(msg) ? t.home.errNet : msg;
    return label ? `${label}: ${nice}` : nice;
  };

  // A manual refresh is allowed at most every 30 minutes (boards rate-limit frequent searches).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  const waitMin = lastRun ? Math.max(0, Math.ceil((REFRESH_GAP_MS - (now - new Date(lastRun).getTime())) / 60000)) : 0;

  const search = async () => {
    if (waitMin > 0) return;
    try {
      const r = await runSearch();
      if (r.fresh === 0 && r.found > 0) toast(t.home.lastRun.replace('{time}', t.time.now));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <header className="hero-bg noise relative overflow-hidden px-5 pt-safe pb-6">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2.5">
            <Logo size={34} />
            <span className="font-display text-[17px] font-semibold">{t.appName}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPrefsOpen(true)} aria-label={t.home.quickPrefs} className="grid size-10 place-items-center rounded-full border border-line bg-surface">
              <SlidersHorizontal className="size-5" />
            </button>
            <button onClick={() => push({ name: 'settings' })} aria-label={t.settings.title} className="grid size-10 place-items-center rounded-full border border-line bg-surface">
              <Settings2 className="size-5" />
            </button>
          </div>
        </div>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="font-display mt-5 text-[1.85rem] font-bold leading-tight">
          {first ? f(t.home.hello, { name: first }) : t.home.helloAnon}
        </motion.h1>
        <p className="mt-1 text-sm text-muted">{t.home.sub}</p>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {(
            [
              ['ready', counts.ready, 'text-gold'],
              ['new', counts.new, 'text-accent'],
              ['applied', counts.applied, 'text-ok'],
            ] as const
          ).map(([k, n, c], i) => (
            <motion.div key={k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-2 py-4 text-center">
              <motion.div key={n} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`text-[2.6rem] font-extrabold leading-none tabular-nums ${c}`}>
                {n}
              </motion.div>
              <div className="mt-2 text-[13px] font-semibold text-muted">{t.home[k]}</div>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center gap-3 p-3">
            <motion.div animate={run.running ? { rotate: 360 } : { rotate: 0 }} transition={run.running ? { repeat: Infinity, duration: 2.2, ease: 'linear' } : {}} className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Radar className="size-5" />
            </motion.div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{run.running ? t.home.steps[run.step as keyof typeof t.home.steps] ?? t.home.running : lastRun ? f(t.home.lastRun, { time: ago(lastRun) }) : t.home.never}</div>
              {run.running && run.total > 0 && <div className="text-xs tabular-nums text-muted">{run.done} / {run.total}</div>}
              {!run.running && run.errors.length > 0 && (
                <button onClick={() => setShowErrors((s) => !s)} className="inline-flex items-center gap-1 text-xs font-medium text-warn">
                  <TriangleAlert className="size-3.5" />
                  {f(t.home.errors, { n: run.errors.length })}
                </button>
              )}
            </div>
            <Button size="sm" loading={run.running} disabled={waitMin > 0} onClick={search} icon={!run.running && waitMin === 0 ? <RefreshCw className="size-4" /> : undefined}>
              {run.running ? '' : waitMin > 0 ? f(t.home.refreshIn, { n: waitMin }) : t.home.run}
            </Button>
          </div>
          <AnimatePresence>
            {run.running && (
              <motion.div initial={{ height: 0 }} animate={{ height: 3 }} exit={{ height: 0 }} className="relative bg-line">
                <motion.div className="absolute inset-y-0 start-0 bg-gradient-to-r from-accent to-gold" animate={{ width: `${Math.max(6, pct)}%` }} />
                <div className="shimmer absolute inset-0" />
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showErrors && (
              <motion.ul initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-line px-4 text-xs text-muted">
                {run.errors.map((e) => (
                  <li key={e} className="py-1.5">
                    {friendlyError(e)}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="px-4">
        {!settings.apiKey && (
          <button onClick={() => push({ name: 'settings' })} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-gold/40 bg-gold-soft p-3.5 text-start text-[13px] font-medium">
            <Sparkles className="size-5 shrink-0 text-gold" />
            {t.home.noKeyHint}
          </button>
        )}

        <div className="no-scrollbar sticky z-10 -mx-4 mt-3 flex gap-2 overflow-x-auto bg-bg px-4 py-3" style={{ top: 'var(--sat)' }}>
          {(['all', 'ready', 'new', 'saved'] as Filter[]).map((k) => (
            <button key={k} onClick={() => setFilter(k)} className={`relative h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors ${filter === k ? 'text-white' : 'border border-line bg-surface text-muted'}`}>
              {filter === k && <motion.span layoutId="home-filter" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className={`relative ${filter === k ? 'text-bg' : ''}`}>{t.home.filters[k]}</span>
            </button>
          ))}
        </div>

        {tracks.length > 1 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            {[{ id: 'all', name: t.tracks.all }, ...tracks.map((tr) => ({ id: tr.id, name: tr.name || t.tracks.untitled }))].map((tr) => (
              <button
                key={tr.id}
                onClick={() => setTrackFilter(tr.id)}
                className={`h-8 shrink-0 rounded-xl px-3.5 text-[12.5px] font-bold transition-colors ${trackFilter === tr.id ? 'bg-gold text-[#2a1a10]' : 'border border-line bg-surface text-muted'}`}
              >
                {tr.name}
              </button>
            ))}
          </div>
        )}

        {list.length === 0 ? (
          <Empty
            icon={<Radar className="size-9" />}
            title={t.home.empty}
            body={t.home.emptyBody}
            action={
              <Button onClick={search} loading={run.running} disabled={waitMin > 0} icon={waitMin === 0 ? <RefreshCw className="size-4" /> : undefined}>
                {waitMin > 0 ? f(t.home.refreshIn, { n: waitMin }) : t.home.run}
              </Button>
            }
          />
        ) : (
          // Keyed by filter: switching tabs swaps the list at once instead of waiting for every card's exit animation.
          <motion.div key={filter + trackFilter} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }} className="space-y-3">
            {list.map((m, i) => (
              <JobCard key={m.jobId} job={jobs[m.jobId]} match={m} index={i} />
            ))}
          </motion.div>
        )}

        <SectionTitle>{t.home.explore}</SectionTitle>
        <p className="-mt-1 mb-3 px-1 text-[13px] text-muted">{t.home.exploreBody}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {EXPLORE_LINKS.map((l) => (
            <motion.button key={l.id} whileTap={{ scale: 0.96 }} onClick={() => Browser.open({ url: l.url(query) })} className="card flex items-center justify-between px-4 py-3.5 text-sm font-semibold">
              {l.label}
              <ExternalLink className="size-4 text-muted" />
            </motion.button>
          ))}
        </div>
      </div>

      <QuickPrefs open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </div>
  );
}
