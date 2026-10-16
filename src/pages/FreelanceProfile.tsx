import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, FileCheck2, FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { Button, Field, Input, Slider, TagInput, TextArea, Toggle, toast } from '../ui/kit';
import { useGigs } from '../store/useGigs';
import { aiCfg, hasAi, useStore } from '../store/useStore';
import { readCvFile } from '../lib/cvImport';
import { parseFreelancerCv } from '../ai/claude';
import { DEFAULT_KEYWORDS, GIG_SOURCES } from '../core/gigs';

export default function FreelanceProfile() {
  const { t, lang } = useT();
  const pop = useNav((s) => s.pop);
  const fp = useGigs((s) => s.fp);
  const setFp = useGigs((s) => s.setFp);
  const settings = useStore((s) => s.settings);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;

  const onFile = async (file: File) => {
    setReading(true);
    try {
      const text = await readCvFile(file);
      setFp({ cvText: text, cvName: file.name });
      if (hasAi(settings)) {
        const r = await parseFreelancerCv(aiCfg(settings, true), text);
        const cur = useGigs.getState().fp;
        setFp({
          name: cur.name || r.name,
          headline: r.headline || cur.headline,
          keywords: [...new Set([...r.keywords.map((k) => k.toLowerCase()), ...cur.keywords])].slice(0, 30),
          portfolio: cur.portfolio.trim() ? cur.portfolio : r.portfolio,
        });
        toast(t.fl.filled);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="min-h-full bg-bg">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-3 pb-2 pt-safe">
        <button onClick={pop} className="grid size-11 place-items-center rounded-full" aria-label={t.common.back}>
          <Back className="size-5" />
        </button>
        <span className="font-display text-lg font-semibold">{t.fl.setup}</span>
        <span className="size-11" />
      </header>

      <div className="mx-auto max-w-xl space-y-4 px-4 pb-40 pt-5">
        <section className="card space-y-3 p-5">
          <h3 className="text-[15px] font-bold">{t.fl.cv}</h3>
          <p className="text-[13px] leading-relaxed text-muted">{t.fl.cvHint}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void onFile(file);
            }}
          />
          {fp.cvText.trim() && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 rounded-2xl bg-ok/10 px-4 py-3">
              <FileCheck2 className="size-6 shrink-0 text-ok" />
              <div className="min-w-0 flex-1 truncate text-[14px] font-semibold">{fp.cvName || 'CV'}</div>
            </motion.div>
          )}
          <Button variant={fp.cvText.trim() ? 'outline' : 'gold'} className="w-full" loading={reading} icon={<FileUp className="size-4" />} onClick={() => fileRef.current?.click()}>
            {reading ? t.fl.reading : fp.cvText.trim() ? t.fl.replace : t.fl.upload}
          </Button>
          {!hasAi(settings) && <p className="text-[12.5px] text-muted">{t.fl.needKey}</p>}
        </section>

        <section className="card space-y-5 p-5">
          <Field label={t.fl.name}>
            <Input value={fp.name} onChange={(e) => setFp({ name: e.target.value })} />
          </Field>
          <Field label={t.fl.headline}>
            <Input value={fp.headline} placeholder="Full-Stack Web & Mobile Developer" onChange={(e) => setFp({ headline: e.target.value })} />
          </Field>
          <Field label={t.fl.keywords} hint={t.fl.keywordsHint}>
            <TagInput value={fp.keywords} onChange={(v) => setFp({ keywords: v.map((x) => x.toLowerCase()) })} suggestions={DEFAULT_KEYWORDS} />
          </Field>
          <Field label={t.fl.portfolio}>
            <TextArea dir="auto" rows={5} value={fp.portfolio} placeholder={t.fl.portfolioPh} onChange={(e) => setFp({ portfolio: e.target.value })} />
          </Field>
        </section>

        <section className="card space-y-5 p-5">
          <Field label={`${t.fl.rate}: $${fp.hourlyRateUsd}`}>
            <Slider min={5} max={100} step={5} value={fp.hourlyRateUsd} onChange={(v) => setFp({ hourlyRateUsd: v })} />
          </Field>
          <Field label={`${t.fl.minBudget}: $${fp.minBudgetUsd}`}>
            <Slider min={0} max={500} step={25} value={fp.minBudgetUsd} onChange={(v) => setFp({ minBudgetUsd: v })} />
          </Field>
          <Field label={`${t.fl.autoDrafts}: ${fp.autoDrafts}`}>
            <Slider min={0} max={8} value={fp.autoDrafts} onChange={(v) => setFp({ autoDrafts: v })} />
          </Field>
        </section>

        <section className="card p-4">
          <h3 className="mb-1 text-[15px] font-bold">{t.fl.sources}</h3>
          <div className="divide-y divide-[var(--line)]">
            {GIG_SOURCES.map((s) => (
              <Toggle key={s.id} checked={fp.sources[s.id] !== false} onChange={(v) => setFp({ sources: { ...fp.sources, [s.id]: v } })} label={s.label} hint={s.id === 'remoteok' ? t.fl.remoteOkNote : undefined} />
            ))}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-3" style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}>
        <Button size="lg" className="mx-auto w-full max-w-xl" icon={<Check className="size-5" />} onClick={pop}>
          {t.common.save}
        </Button>
      </div>
    </div>
  );
}
