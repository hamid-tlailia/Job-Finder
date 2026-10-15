import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Bookmark, Briefcase, Check, CircleAlert, Copy, Eye, FileText, Globe, Mail, MapPin, MessageCircle, RefreshCw, Send, Sparkles, Wallet, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import type { Dict } from '../i18n/dict';
import type { ApplicationPackage, Channel, Lang } from '../core/types';
import { Button, CompanyAvatar, Field, Input, ScoreRing, Segmented, Sheet, TagInput, TextArea, toast } from '../ui/kit';
import { useNav } from '../ui/nav';
import { prepare } from '../lib/pipeline';
import { copy, previewPdf, sendApplication } from '../lib/apply';
import { QATAR_CITIES } from '../core/qatar';

function humanize(item: string, t: Dict, lang: Lang): string {
  const [k, v] = item.split(/:(.*)/s);
  if (v === undefined && k !== 'title' && k !== 'arabic' && k !== 'visa') return item;
  const ar = lang === 'ar';
  switch (k) {
    case 'title':
      return ar ? 'المسمى يطابق ما تبحث عنه' : 'Title matches what you are looking for';
    case 'skills':
      return ar ? `مهاراتك المطلوبة: ${v}` : `Your matching skills: ${v}`;
    case 'near':
      return ar ? `قريبة من سكنك (~${v} كم)` : `Close to home (~${v} km)`;
    case 'years':
      return ar ? `الخبرة المطلوبة ${v} سنوات` : `Requires ${v} years of experience`;
    case 'type':
      return ar ? `نوع الدوام: ${t.jobType[v as keyof Dict['jobType']] ?? v}` : `Employment type: ${t.jobType[v as keyof Dict['jobType']] ?? v}`;
    case 'workplace':
      return ar ? `مكان العمل: ${t.workplace[v as keyof Dict['workplace']] ?? v}` : `Work arrangement: ${t.workplace[v as keyof Dict['workplace']] ?? v}`;
    case 'arabic':
      return ar ? 'تتطلب إجادة العربية' : 'Requires fluent Arabic';
    case 'distance':
      return ar ? `بعيدة عن سكنك (~${v} كم)` : `Far from home (~${v} km)`;
    case 'visa':
      return ar ? 'قد تشترط إقامة/NOC أو مواطنين فقط' : 'May require a transferable visa/NOC or nationals only';
    default:
      return item;
  }
}

export default function JobDetail({ id }: { id: string }) {
  const { t, lang, ago, f } = useT();
  const pop = useNav((s) => s.pop);
  const { jobs, matches, profile, upsertMatch, setStatus } = useStore();
  const job = jobs[id];
  const m = matches[id];
  const [tab, setTab] = useState<'cv' | 'letter' | 'message' | 'qa'>('cv');
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [askSent, setAskSent] = useState(false);

  useEffect(() => {
    if (m && !m.seen) upsertMatch(id, { seen: true });
  }, [id, m, upsertMatch]);

  if (!job || !m) return null;
  const pkg = m.pkg;
  const a = m.analysis;
  const score = a?.score ?? m.localScore;
  const city = QATAR_CITIES.find((c) => c.id === job.city);
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const setPkg = (p: Partial<ApplicationPackage>) => pkg && upsertMatch(id, { pkg: { ...pkg, ...p } });
  const setCv = (c: Partial<ApplicationPackage['cv']>) => pkg && setPkg({ cv: { ...pkg.cv, ...c } });

  const doPrepare = async () => {
    setBusy(true);
    try {
      await prepare(id);
    } catch (e) {
      toast(f(t.job.error, { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const doSend = async () => {
    if (!pkg) return;
    setSending(true);
    try {
      const r = await sendApplication(profile, job, pkg, pkg.channel, pkg.target);
      if (r === 'copied') toast(t.job.websiteHint);
      setTimeout(() => setAskSent(true), 900);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const channels: { id: Channel; label: string; icon: React.ReactNode }[] = [
    { id: 'email', label: t.job.email, icon: <Mail className="size-4" /> },
    { id: 'whatsapp', label: t.job.whatsapp, icon: <MessageCircle className="size-4" /> },
    { id: 'website', label: t.job.website, icon: <Globe className="size-4" /> },
  ];
  const defaultTarget = (c: Channel) => (c === 'email' ? job.contactEmail ?? '' : c === 'whatsapp' ? job.contactPhone ?? '' : job.applyUrl ?? job.url);
  const canSend = !!pkg && !!pkg.target.trim();

  return (
    <div className="min-h-full pb-36">
      <div className="glass sticky top-0 z-20 flex items-center justify-between border-b border-line px-3 pt-safe pb-2">
        <button onClick={pop} className="grid size-11 place-items-center rounded-full">
          <Back className="size-5" />
        </button>
        <div className="flex gap-1">
          <button onClick={() => setStatus(id, m.status === 'saved' ? 'new' : 'saved')} className="grid size-11 place-items-center rounded-full">
            <Bookmark className={`size-5 ${m.status === 'saved' ? 'fill-gold text-gold' : ''}`} />
          </button>
          <button onClick={() => Browser.open({ url: job.url })} className="grid size-11 place-items-center rounded-full">
            <Globe className="size-5" />
          </button>
        </div>
      </div>

      <section className="hero-bg px-5 pb-6 pt-5">
        <div className="flex items-start gap-4">
          <CompanyAvatar name={job.company || job.title} logo={job.logo} size={60} />
          <div className="min-w-0 flex-1">
            <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-[1.55rem] font-bold leading-tight">
              {job.title}
            </motion.h1>
            <p className="mt-1 font-semibold text-muted">{job.company}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[12.5px] font-medium">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 border border-line">
            <MapPin className="size-3.5 text-accent" />
            {city ? (lang === 'ar' ? city.ar : city.en) : job.location}
          </span>
          {job.employmentType && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 border border-line">
              <Briefcase className="size-3.5 text-accent" />
              {t.jobType[job.employmentType as keyof Dict['jobType']] ?? job.employmentType}
            </span>
          )}
          {job.salary && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 border border-line">
              <Wallet className="size-3.5 text-accent" />
              {job.salary}
            </span>
          )}
          <span className="rounded-full bg-surface-2 px-3 py-1.5 text-muted">
            {job.sourceLabel}
            {job.postedAt ? ` · ${ago(job.postedAt)}` : ''}
          </span>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card mt-5 flex items-center gap-4 p-4">
          <ScoreRing score={score} size={76} stroke={6} />
          <div className="min-w-0">
            <div className="text-lg font-bold">{t.verdict[a?.verdict ?? 'fair']}</div>
            <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-gold">
              {a?.by === 'ai' && <Sparkles className="size-3.5" />}
              {a?.by === 'ai' ? 'AI' : ''}
            </div>
            {a?.summary && <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-muted">{a.summary}</p>}
          </div>
        </motion.div>
      </section>

      <div className="space-y-4 px-4">
        {a && a.reasons.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-2.5 text-sm font-bold text-ok">{t.job.why}</h3>
            <ul className="space-y-2">
              {a.reasons.map((r, i) => (
                <motion.li key={r} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex gap-2 text-[14px] leading-relaxed">
                  <Check className="mt-0.5 size-4 shrink-0 text-ok" />
                  {a.by === 'ai' ? r : humanize(r, t, lang)}
                </motion.li>
              ))}
            </ul>
          </div>
        )}
        {a && a.gaps.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-2.5 text-sm font-bold text-warn">{t.job.gaps}</h3>
            <ul className="space-y-2">
              {a.gaps.map((g) => (
                <li key={g} className="flex gap-2 text-[14px] leading-relaxed">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                  {a.by === 'ai' ? g : humanize(g, t, lang)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {a && a.keyRequirements.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-2.5 text-sm font-bold">{t.job.requirements}</h3>
            <div className="flex flex-wrap gap-1.5">
              {a.keyRequirements.map((r) => (
                <span key={r} className="rounded-full bg-surface-2 px-3 py-1 text-[12.5px]">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {job.description && (
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-bold">{t.job.description}</h3>
            <motion.div animate={{ height: expanded ? 'auto' : 140 }} className="relative overflow-hidden">
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-muted" dir="auto">
                {job.description}
              </p>
              {!expanded && <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface to-transparent" />}
            </motion.div>
            <button onClick={() => setExpanded((e) => !e)} className="mt-2 text-sm font-semibold text-accent">
              {expanded ? t.job.showLess : t.job.showMore}
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!pkg ? (
            <motion.div key="prep" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card overflow-hidden p-5 text-center">
              {busy || m.status === 'preparing' ? (
                <div className="py-4">
                  <motion.div animate={{ rotate: [0, 8, -8, 0], y: [0, -4, 0] }} transition={{ duration: 1.6, repeat: Infinity }} className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-gold-soft text-gold">
                    <FileText className="size-8" />
                  </motion.div>
                  <p className="font-semibold">{t.job.preparing}</p>
                  <div className="shimmer mx-auto mt-4 h-2 w-40 rounded-full bg-line" />
                </div>
              ) : (
                <>
                  {m.error && <p className="mb-3 text-sm text-warn">{f(t.job.error, { msg: m.error })}</p>}
                  <Button variant="gold" size="lg" className="w-full" onClick={doPrepare} icon={<Sparkles className="size-5" />}>
                    {t.job.prepare}
                  </Button>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="pkg" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gold">
                  <Sparkles className="size-3.5" />
                  {pkg.by === 'ai' ? t.job.aiBy : t.job.localBy} · {t.langs[pkg.language]}
                </span>
                <Button size="sm" variant="ghost" loading={busy} onClick={doPrepare} icon={<RefreshCw className="size-3.5" />}>
                  {t.job.regenerate}
                </Button>
              </div>
              <Segmented value={tab} onChange={setTab} options={(['cv', 'letter', 'message', 'qa'] as const).map((k) => ({ id: k, label: t.job.tabs[k] }))} />
              <AnimatePresence mode="wait">
                <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="mt-4 space-y-4" dir={pkg.language === 'ar' ? 'rtl' : 'ltr'}>
                  {tab === 'cv' && (
                    <>
                      <Field label={t.ob.basics.headline}>
                        <Input value={pkg.cv.headline} onChange={(e) => setCv({ headline: e.target.value })} />
                      </Field>
                      <Field label={t.job.summary}>
                        <TextArea rows={5} value={pkg.cv.summary} onChange={(e) => setCv({ summary: e.target.value })} />
                      </Field>
                      <Field label={t.job.skills}>
                        <TagInput value={pkg.cv.skills} onChange={(v) => setCv({ skills: v })} />
                      </Field>
                      {pkg.cv.experience.map((e, i) => (
                        <Field key={i} label={`${e.title} — ${e.company}`}>
                          <TextArea
                            rows={Math.min(8, e.bullets.length + 2)}
                            value={e.bullets.join('\n')}
                            onChange={(ev) => setCv({ experience: pkg.cv.experience.map((x, j) => (j === i ? { ...x, bullets: ev.target.value.split('\n') } : x)) })}
                          />
                        </Field>
                      ))}
                      {pkg.atsKeywords.length > 0 && (
                        <div>
                          <div className="mb-1.5 text-[13px] font-semibold text-muted">{t.job.ats}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {pkg.atsKeywords.map((k) => (
                              <span key={k} className="rounded-full bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok">
                                {k}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <Button variant="outline" className="w-full" icon={<Eye className="size-4" />} onClick={() => previewPdf(profile, job, pkg, 'cv').catch((e) => toast(String(e)))}>
                        {t.job.preview}
                      </Button>
                    </>
                  )}
                  {tab === 'letter' && (
                    <>
                      <TextArea rows={16} value={pkg.coverLetter} onChange={(e) => setPkg({ coverLetter: e.target.value })} />
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" icon={<Eye className="size-4" />} onClick={() => previewPdf(profile, job, pkg, 'letter').catch((e) => toast(String(e)))}>
                          {t.job.preview}
                        </Button>
                        <Button variant="outline" icon={<Copy className="size-4" />} onClick={() => copy(pkg.coverLetter).then(() => toast(t.common.copied))}>
                          {t.common.copy}
                        </Button>
                      </div>
                    </>
                  )}
                  {tab === 'message' && (
                    <>
                      <Field label={t.job.sendVia}>
                        <Segmented value={pkg.channel} onChange={(c) => setPkg({ channel: c, target: defaultTarget(c) })} options={channels} />
                      </Field>
                      <Field label={pkg.channel === 'email' ? t.job.to : pkg.channel === 'whatsapp' ? t.job.whatsapp : t.job.website}>
                        <Input dir="ltr" value={pkg.target} placeholder={pkg.channel === 'email' ? 'hr@company.qa' : pkg.channel === 'whatsapp' ? '+974' : 'https://'} onChange={(e) => setPkg({ target: e.target.value })} />
                      </Field>
                      {pkg.channel === 'email' && (
                        <>
                          <Field label={t.job.subject}>
                            <Input value={pkg.emailSubject} onChange={(e) => setPkg({ emailSubject: e.target.value })} />
                          </Field>
                          <Field label={t.job.body}>
                            <TextArea rows={9} value={pkg.emailBody} onChange={(e) => setPkg({ emailBody: e.target.value })} />
                          </Field>
                        </>
                      )}
                      {pkg.channel === 'whatsapp' && (
                        <Field label={t.job.body}>
                          <TextArea rows={6} value={pkg.whatsappMessage} onChange={(e) => setPkg({ whatsappMessage: e.target.value })} />
                        </Field>
                      )}
                      {pkg.channel === 'website' && <p className="rounded-2xl bg-surface-2 p-3.5 text-[13px] leading-relaxed text-muted">{t.job.websiteHint}</p>}
                    </>
                  )}
                  {tab === 'qa' && (
                    <>
                      <p className="text-[13px] text-muted">{pkg.formAnswers.length ? t.job.qaHint : t.job.noQa}</p>
                      {pkg.formAnswers.map((qa, i) => (
                        <div key={i} className="rounded-2xl bg-surface-2 p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13.5px] font-bold">{qa.question}</p>
                            <button onClick={() => copy(qa.answer).then(() => toast(t.common.copied))} className="shrink-0 text-accent">
                              <Copy className="size-4" />
                            </button>
                          </div>
                          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{qa.answer}</p>
                        </div>
                      ))}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<X className="size-4" />}
            onClick={() => {
              setStatus(id, 'dismissed');
              pop();
            }}
          >
            {t.job.dismiss}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {pkg && (
          <motion.div initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="pb-safe glass fixed inset-x-0 bottom-0 z-30 border-t border-line px-4 pt-3">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-muted">
              {channels.find((c) => c.id === pkg.channel)?.icon}
              <span className="truncate" dir="ltr">
                {pkg.target || '—'}
              </span>
            </div>
            <Button
              variant="gold"
              size="lg"
              className="mb-2 w-full"
              loading={sending}
              disabled={!canSend}
              onClick={() => (canSend ? doSend() : setTab('message'))}
              icon={<Send className="size-5" />}
            >
              {t.job.send} · {channels.find((c) => c.id === pkg.channel)?.label}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={askSent} onClose={() => setAskSent(false)} title={t.job.didSend}>
        <div className="flex flex-col gap-2.5 pb-4">
          <Button
            size="lg"
            icon={<Check className="size-5" />}
            onClick={() => {
              setStatus(id, 'applied');
              upsertMatch(id, { appliedVia: pkg?.channel });
              setAskSent(false);
              toast('✓');
              pop();
            }}
          >
            {t.job.markApplied}
          </Button>
          <Button size="lg" variant="outline" onClick={() => setAskSent(false)}>
            {t.job.notYet}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
