import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { Button, Logo, Segmented } from '../ui/kit';
import { useT } from '../i18n';
import { useStore } from '../store/useStore';

const PLATFORMS = ['LinkedIn', 'Tanqeeb', 'Workable', 'Google Jobs', 'Bayt', 'GulfTalent', 'Jooble', 'Indeed', 'NaukriGulf', 'SmartRecruiters', 'Himalayas', 'Remotive'];

export default function Welcome({ onStart }: { onStart: () => void }) {
  const { t, lang } = useT();
  const setSettings = useStore((s) => s.setSettings);
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  return (
    <div className="hero-bg noise relative flex min-h-full flex-col overflow-hidden px-6 pt-safe pb-safe">
      <motion.div className="pointer-events-none absolute -top-24 end-[-30%] size-[26rem] rounded-full bg-accent/20 blur-3xl" animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 9, repeat: Infinity }} />
      <motion.div className="pointer-events-none absolute bottom-40 start-[-25%] size-80 rounded-full bg-gold/20 blur-3xl" animate={{ scale: [1.1, 1, 1.1] }} transition={{ duration: 11, repeat: Infinity }} />

      <div className="relative mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={38} />
          <span className="font-display text-lg font-semibold">{t.appName}</span>
        </div>
        <div className="w-32">
          <Segmented value={lang} onChange={(v) => setSettings({ uiLang: v })} options={[{ id: 'ar', label: 'ع' }, { id: 'en', label: 'EN' }]} />
        </div>
      </div>

      <div className="relative flex flex-1 flex-col justify-center py-10">
        <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.1 }} className="mb-8">
          <div className="relative inline-block">
            <Logo size={84} />
            <motion.span className="absolute -end-2 -top-2 grid size-8 place-items-center rounded-full bg-surface text-gold shadow-lg" animate={{ rotate: [0, 15, -10, 0] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}>
              <Sparkles className="size-4" />
            </motion.span>
          </div>
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="gold-text mb-3 text-sm font-bold uppercase tracking-[0.2em]">
          {t.tagline}
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={`font-display whitespace-pre-line font-bold leading-[1.2] ${lang === 'ar' ? 'text-[2rem]' : 'text-[2.35rem]'}`}>
          {t.welcome.title}
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-4 text-[15px] leading-relaxed text-muted">
          {t.welcome.body}
        </motion.p>
        <ul className="mt-7 space-y-3">
          {t.welcome.points.map((p, i) => (
            <motion.li key={p} initial={{ opacity: 0, x: lang === 'ar' ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.08 }} className="flex items-center gap-3 text-[15px] font-medium">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
              {p}
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="relative -mx-6 mb-6 overflow-hidden" dir="ltr">
        <motion.div className="flex w-max gap-2" animate={{ x: ['0%', '-50%'] }} transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}>
          {[...PLATFORMS, ...PLATFORMS].map((p, i) => (
            <span key={i} className="rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-xs font-semibold text-muted">
              {p}
            </span>
          ))}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="relative mb-4">
        <Button size="lg" className="w-full" onClick={onStart}>
          {t.welcome.start}
          <Arrow className="size-5" />
        </Button>
      </motion.div>
    </div>
  );
}
