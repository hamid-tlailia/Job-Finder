import { motion } from 'motion/react';
import { Clock, Code2, Loader2, MessageSquareText, RefreshCw, Send, Sparkles, UserCog } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { Button, Empty, ScoreRing, toast } from '../ui/kit';
import { gigScore, useGigs, type GigMatch } from '../store/useGigs';
import { hasAi, useStore } from '../store/useStore';
import { runGigSearch } from '../lib/gigPipeline';
import type { Gig } from '../core/gigs';

type Filter = 'all' | 'ready' | 'new' | 'applied';

/** "$25–50", "$8–13/hr" or the salary range of a Remote OK role. */
export function budgetLabel(g: Gig, t: ReturnType<typeof useT>['t']): string {
  const { budgetMin: a, budgetMax: b } = g;
  if (!a && !b) return t.fl.noBudget;
  const k = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : `${n}`);
  const range = a && b && a !== b ? `$${k(a)}–${k(b)}` : `$${k((b ?? a)!)}`;
  return g.budgetType === 'hourly' ? `${range}${t.fl.hourly}` : g.budgetType === 'salary' ? `${range} · ${t.fl.salary}` : range;
}

function GigCard({ g, m, index }: { g: Gig; m: GigMatch; index: number }) {
  const { t, f, ago } = useT();
  const push = useNav((s) => s.push);
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 5) * 0.025, type: 'spring', stiffness: 380, damping: 30 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        useGigs.getState().upsertMatch(g.id, { seen: true });
        push({ name: 'gig', id: g.id });
      }}
      className="card relative w-full overflow-hidden p-4 text-start"
    >
      {m.status === 'ready' && !m.seen && <span className="absolute inset-y-0 start-0 w-1 bg-gradient-to-b from-gold to-accent" />}
      <div className="flex gap-3.5">
        <div className="min-w-0 flex-1">
          <h3 dir="auto" className="line-clamp-2 text-[15.5px] font-bold leading-snug">
            {g.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span className="font-bold text-ink" dir="ltr">
              {budgetLabel(g, t)}
            </span>
            {g.bids !== undefined && g.source !== 'remoteok' && (
              <span className="inline-flex items-center gap-1">
                <MessageSquareText className="size-3.5" />
                {f(t.fl.bids, { n: g.bids })}
              </span>
            )}
            {g.postedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {ago(g.postedAt)}
              </span>
            )}
          </div>
        </div>
        <ScoreRing score={gigScore(m)} size={52} />
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-2">
        <span className="truncate rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted">{g.sourceLabel}</span>
        {m.status === 'ready' && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-bold text-gold">
            <Send className="size-3" />
            {t.fl.filters.ready}
          </span>
        )}
        {m.status === 'drafting' && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent">
            <Loader2 className="size-3 animate-spin" />
            {t.fl.writing}
          </span>
        )}
        {m.status === 'applied' && <span className="shrink-0 rounded-full bg-ok/10 px-2.5 py-1 text-[11px] font-bold text-ok">{t.fl.filters.applied}</span>}
        {m.analysis && m.status === 'new' && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-muted">
            <Sparkles className="size-3 text-gold" />
            {t.verdict[m.analysis.verdict]}
          </span>
        )}
      </div>
    </motion.button>
  );
}

export default function Freelance() {
  const { t, f, ago } = useT();
  const push = useNav((s) => s.push);
  const { gigs, matches, run, lastRun, fp } = useGigs();
  const ai = useStore((s) => hasAi(s.settings));
  const [filter, setFilter] = useState<Filter>('all');
  const configured = !!(fp.cvText.trim() || fp.headline.trim());

  const list = useMemo(
    () =>
      Object.values(matches)
        .filter((m) => gigs[m.gigId] && m.status !== 'dismissed' && (filter === 'all' ? m.status !== 'applied' : filter === 'ready' ? m.status === 'ready' || m.status === 'drafting' : m.status === filter))
        .sort((a, b) => gigScore(b) - gigScore(a))
        .slice(0, 100),
    [gigs, matches, filter],
  );
  const counts = useMemo(() => {
    const v = Object.values(matches).filter((m) => gigs[m.gigId]);
    return { ready: v.filter((m) => m.status === 'ready').length, new: v.filter((m) => m.status === 'new').length, applied: v.filter((m) => m.status === 'applied').length };
  }, [gigs, matches]);

  // Opening the tab refreshes when the list is older than 15 minutes: early bids win projects.
  useEffect(() => {
    const { lastRun: last, run: r } = useGigs.getState();
    if (configured && !r.running && (!last || Date.now() - new Date(last).getTime() > 15 * 60000)) void runGigSearch().catch(() => undefined);
  }, [configured]);

  const refresh = async () => {
    try {
      const r = await runGigSearch();
      if (r.fresh === 0) toast(f(t.fl.lastRun, { time: t.time.now }));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="px-4 pt-safe">
      <div className="flex items-center justify-between gap-3 px-1 pb-1 pt-6">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="font-display truncate text-[1.85rem] font-bold">{t.fl.title}</h1>
          {counts.ready > 0 && <span className="grid h-8 min-w-8 place-items-center rounded-full bg-accent px-2.5 text-[14px] font-bold tabular-nums text-white">{counts.ready}</span>}
        </div>
        <button onClick={() => push({ name: 'freelanceProfile' })} className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface" aria-label={t.fl.setup}>
          <UserCog className="size-5" />
        </button>
      </div>
      <p className="px-1 pb-4 text-[13px] text-muted">{t.fl.sub}</p>

      <div className="card mb-3 flex items-center gap-3 p-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">{run.running ? <Loader2 className="size-5 animate-spin" /> : <Code2 className="size-5" />}</span>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">
          {run.running ? t.fl.steps[run.step as keyof typeof t.fl.steps] ?? t.fl.refreshing : lastRun ? f(t.fl.lastRun, { time: ago(lastRun) }) : t.home.never}
        </div>
        <Button size="sm" loading={run.running} icon={<RefreshCw className="size-4" />} onClick={refresh}>
          {t.fl.refresh}
        </Button>
      </div>
      {!ai && <p className="mb-3 rounded-2xl bg-gold-soft p-3 text-[12.5px] leading-relaxed">{t.fl.needKey}</p>}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-3">
        {(['all', 'ready', 'new', 'applied'] as Filter[]).map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={`h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors ${filter === k ? 'bg-ink text-bg' : 'border border-line bg-surface text-muted'}`}>
            {t.fl.filters[k]}
            {k !== 'all' && counts[k] > 0 && <span className="ms-1.5 tabular-nums opacity-70">{counts[k]}</span>}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty
          icon={<Code2 className="size-9" />}
          title={t.fl.empty}
          body={t.fl.emptyBody}
          action={
            configured ? (
              <Button onClick={refresh} loading={run.running} icon={<RefreshCw className="size-4" />}>
                {t.fl.refresh}
              </Button>
            ) : (
              <Button onClick={() => push({ name: 'freelanceProfile' })} icon={<UserCog className="size-4" />}>
                {t.fl.setupCta}
              </Button>
            )
          }
        />
      ) : (
        <motion.div key={filter} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }} className="space-y-3 pb-4">
          {list.map((m, i) => (
            <GigCard key={m.gigId} g={gigs[m.gigId]} m={m} index={i} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
