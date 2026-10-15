import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { Field, Slider, Toggle } from './kit';

/** "Let the AI decide" switch, with the manual minimum slider when it is off. */
export function MatchLevel() {
  const { t } = useT();
  const prefs = useStore((s) => s.profile.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const auto = prefs.minScoreAuto !== false;
  return (
    <div className="space-y-2">
      <Toggle
        checked={auto}
        onChange={(v) => setPrefs({ minScoreAuto: v })}
        label={
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-gold" />
            {t.ob.finish.autoScore}
          </span>
        }
        hint={t.ob.finish.autoScoreHint}
      />
      <AnimatePresence initial={false}>
        {!auto && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Field label={`${t.ob.finish.minScore}: ${prefs.minScore}%`}>
              <Slider min={30} max={90} step={5} value={prefs.minScore} onChange={(v) => setPrefs({ minScore: v })} />
            </Field>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
