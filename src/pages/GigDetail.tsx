import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, CircleCheck, Clock, Copy, ExternalLink, MessageSquareText, ShieldAlert, Sparkles, ThumbsDown, TriangleAlert, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { Button, Field, Input, ScoreRing, Sheet, TextArea, toast } from '../ui/kit';
import { gigScore, useGigs } from '../store/useGigs';
import { draftProposal } from '../lib/gigPipeline';
import { gigWithDetail } from '../core/gigs';
import { fetchText } from '../lib/http';
import { budgetLabel } from './Freelance';

export default function GigDetail({ id }: { id: string }) {
  const { t, f, lang, ago } = useT();
  const pop = useNav((s) => s.pop);
  const g = useGigs((s) => s.gigs[id]);
  const m = useGigs((s) => s.matches[id]);
  const upsertMatch = useGigs((s) => s.upsertMatch);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ask, setAsk] = useState(false);
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  if (!g || !m) return null;
  const a = m.analysis;
  const p = m.proposal;
  const drafting = m.status === 'drafting';
  const setProposal = (patch: Partial<NonNullable<typeof p>>) => p && upsertMatch(id, { proposal: { ...p, ...patch } });

  const write = async () => {
    try {
      await draftProposal(id);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  };

  const loadFull = async () => {
    setLoading(true);
    try {
      useGigs.getState().upsertGig(await gigWithDetail(g, fetchText));
    } finally {
      setLoading(false);
    }
  };

  const copyOpen = async () => {
    if (p) await Clipboard.write({ string: p.proposal });
    toast(f(t.fl.copied, { site: g.sourceLabel }));
    await Browser.open({ url: g.url, presentationStyle: 'fullscreen' });
    setTimeout(() => setAsk(true), 900);
  };

  return (
    <div className="min-h-full pb-36">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-3 pb-2 pt-safe">
        <button onClick={pop} className="grid size-11 place-items-center rounded-full" aria-label={t.common.back}>
          <Back className="size-5" />
        </button>
        <span className="truncate px-2 text-[13px] font-semibold text-muted">{g.sourceLabel}</span>
        <button onClick={() => Browser.open({ url: g.url })} className="grid size-11 place-items-center rounded-full" aria-label={t.job.openPosting}>
          <ExternalLink className="size-5" />
        </button>
      </div>

      <div className="mx-auto max-w-xl space-y-4 px-4 pt-5">
        <div>
          <h1 dir="auto" className="font-display text-[1.45rem] font-bold leading-snug">
            {g.title}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
            <span className="rounded-full bg-gold-soft px-3 py-1.5 font-bold text-gold" dir="ltr">
              {budgetLabel(g, t)}
            </span>
            {g.durationDays && <span className="rounded-full border border-line bg-surface px-3 py-1.5 font-semibold">{f(t.fl.days, { n: g.durationDays })}</span>}
            {g.bids !== undefined && g.source !== 'remoteok' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 font-semibold">
                <MessageSquareText className="size-3.5" />
                {f(t.fl.bids, { n: g.bids })}
              </span>
            )}
            {g.postedAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 font-semibold text-muted">
                <Clock className="size-3.5" />
                {ago(g.postedAt)}
              </span>
            )}
          </div>
          {g.source === 'remoteok' && <p className="mt-2 text-[12px] text-muted">{t.fl.remoteOkNote}</p>}
        </div>

        <section className="card flex flex-col items-center gap-2 p-5 text-center">
          <ScoreRing score={gigScore(m)} size={92} stroke={7} />
          {a ? (
            <>
              <div className="text-[16px] font-bold">{t.verdict[a.verdict]}</div>
              <p className="text-[13.5px] leading-relaxed text-muted">{a.summary}</p>
            </>
          ) : (
            m.hits.length > 0 && <p className="text-[12.5px] text-muted" dir="ltr">{m.hits.join(' · ')}</p>
          )}
        </section>

        {a?.scamRisk === 'high' || a?.scamRisk === 'medium' ? (
          <div className={`flex gap-3 rounded-2xl p-4 text-[13.5px] leading-relaxed ${a.scamRisk === 'high' ? 'bg-accent/10 text-accent' : 'bg-warn/10'}`}>
            <ShieldAlert className="size-5 shrink-0" />
            {t.fl.scam}
          </div>
        ) : null}

        {a && (a.reasons.length > 0 || a.risks.length > 0) && (
          <section className="card space-y-3 p-4">
            {a.reasons.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-[14px] font-bold">{t.fl.fit}</h3>
                <ul className="space-y-1.5">
                  {a.reasons.map((r) => (
                    <li key={r} className="flex gap-2 text-[13.5px] leading-relaxed">
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {a.risks.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-[14px] font-bold">{t.fl.risks}</h3>
                <ul className="space-y-1.5">
                  {a.risks.map((r) => (
                    <li key={r} className="flex gap-2 text-[13.5px] leading-relaxed">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section className="card p-4">
          <h3 className="mb-2 text-[14px] font-bold">{t.fl.description}</h3>
          <p dir="auto" className={`whitespace-pre-line text-[13.5px] leading-relaxed text-muted ${expanded ? '' : 'line-clamp-[10]'}`}>
            {g.description}
          </p>
          <div className="mt-2 flex gap-3">
            <button onClick={() => setExpanded((x) => !x)} className="text-[13px] font-bold text-accent">
              {expanded ? t.job.showLess : t.job.showMore}
            </button>
            {g.needsDetail && (
              <button onClick={loadFull} disabled={loading} className="text-[13px] font-bold text-accent">
                {loading ? '…' : t.fl.loadFull}
              </button>
            )}
          </div>
          {g.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {g.skills.slice(0, 12).map((s) => (
                <span key={s} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[12px]">
                  {s}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="card space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[15px] font-bold">
              <Sparkles className="size-4 text-gold" />
              {t.fl.proposal}
            </h3>
            {p && (
              <Button size="sm" variant="ghost" loading={drafting} icon={<Wand2 className="size-4" />} onClick={write}>
                {t.fl.rewrite}
              </Button>
            )}
          </div>
          {p ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <TextArea dir="auto" rows={12} value={p.proposal} onChange={(e) => setProposal({ proposal: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.fl.bidAmount}>
                  <Input dir="ltr" inputMode="decimal" value={String(p.bidAmount)} onChange={(e) => setProposal({ bidAmount: Number(e.target.value) || 0 })} />
                </Field>
                <Field label={t.fl.delivery}>
                  <Input dir="ltr" inputMode="numeric" value={String(p.deliveryDays)} onChange={(e) => setProposal({ deliveryDays: Number(e.target.value) || 0 })} />
                </Field>
              </div>
              <Button variant="outline" className="w-full" icon={<Copy className="size-4" />} onClick={() => Clipboard.write({ string: p.proposal }).then(() => toast('✓'))}>
                {t.common.copy}
              </Button>
            </motion.div>
          ) : (
            <Button variant="gold" className="w-full" loading={drafting} icon={<Wand2 className="size-4" />} onClick={write}>
              {drafting ? t.fl.writing : t.fl.write}
            </Button>
          )}
          {m.error && <p className="text-[12.5px] text-accent">{m.error}</p>}
        </section>

        {m.status !== 'applied' && (
          <Button
            variant="ghost"
            className="w-full !text-muted"
            icon={<ThumbsDown className="size-4" />}
            onClick={() => {
              upsertMatch(id, { status: 'dismissed' });
              pop();
            }}
          >
            {t.fl.dismiss}
          </Button>
        )}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3">
        <Button variant="gold" size="lg" className="mx-auto mb-2 w-full max-w-xl" icon={<ExternalLink className="size-5" />} onClick={copyOpen}>
          {p ? t.fl.copyOpen : t.job.openPosting}
        </Button>
      </div>

      <Sheet open={ask} onClose={() => setAsk(false)} title={t.fl.didApply}>
        <div className="flex flex-col gap-2.5 pb-4">
          <Button
            size="lg"
            icon={<CircleCheck className="size-5" />}
            onClick={() => {
              upsertMatch(id, { status: 'applied', appliedAt: new Date().toISOString() });
              setAsk(false);
            }}
          >
            {t.fl.markApplied}
          </Button>
          <Button size="lg" variant="outline" onClick={() => setAsk(false)}>
            {t.fl.notYet}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
