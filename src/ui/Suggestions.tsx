import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, Check, FileUp, Layers, Replace, Sparkles, Wand2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { Button, toast } from './kit';
import { applySuggestion, createTrackFromSuggestions, currentValue, isPitch, preview, runProfileReview, type Section } from '../lib/profileReview';
import { useNav } from './nav';
import { MAX_TRACKS } from '../core/types';
import { readCvFile } from '../lib/cvImport';

/** Accept / ignore list of CV-vs-profile suggestions, optionally limited to one profile section. */
export function SuggestionList({ section, compact }: { section?: Section; compact?: boolean }) {
  const { t, f } = useT();
  const all = useStore((s) => s.suggestions);
  const drop = useStore((s) => s.dropSuggestion);
  const profile = useStore((s) => s.profile);
  const push = useNav((s) => s.push);
  const list = all.filter((s) => !section || s.section === section);
  if (!list.length) return null;
  const pitch = list.filter((s) => isPitch(s) && s.kind !== 'missing');
  const canTrack = pitch.length > 0 && (profile.tracks ?? []).length < MAX_TRACKS;
  // "Accept all" only covers additive facts; replacing the title/summary is always a deliberate choice.
  const additive = list.filter((s) => !isPitch(s) || s.kind === 'missing');
  return (
    <motion.section layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[1.375rem] border border-gold/40 bg-gold-soft">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <h3 className="flex items-center gap-2 text-[14.5px] font-bold">
          <Sparkles className="size-4 text-gold" />
          {compact ? f(t.suggest.found, { n: list.length }) : t.suggest.title}
        </h3>
        {additive.length > 1 && (
          <button onClick={() => additive.forEach(applySuggestion)} className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white">
            {t.suggest.applyAll}
          </button>
        )}
      </div>
      {!compact && <p className="px-4 pb-2 text-[13px] leading-relaxed text-muted">{t.suggest.body}</p>}
      {canTrack && (
        <div className="mx-3 mb-2 rounded-2xl border border-accent/30 bg-surface p-3.5">
          <p className="flex items-center gap-2 text-[13.5px] font-bold">
            <Layers className="size-4 text-accent" />
            {t.suggest.otherField}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t.suggest.otherFieldBody}</p>
          <Button
            size="sm"
            className="mt-2.5 w-full"
            icon={<Layers className="size-4" />}
            onClick={() => {
              const id = createTrackFromSuggestions();
              if (id) {
                toast(t.suggest.trackMade);
                push({ name: 'track', id });
              }
            }}
          >
            {t.suggest.makeTrack}
          </Button>
        </div>
      )}
      <ul className="space-y-2 px-3 pb-3">
        <AnimatePresence initial={false}>
          {list.map((s) => (
            <motion.li key={s.id} layout exit={{ opacity: 0, height: 0, marginTop: 0 }} className="rounded-2xl bg-surface p-3.5">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${s.kind === 'missing' ? 'bg-accent-soft text-accent' : 'bg-warn/15 text-warn'}`}>{t.suggest.kind[s.kind]}</span>
                <p className="text-[13.5px] font-medium leading-relaxed">{s.message}</p>
              </div>
              {s.kind !== 'missing' && currentValue(s, profile) && (
                <div className="mt-2 space-y-1">
                  <p dir="auto" className="rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-muted">
                    <span className="me-1 font-bold">{t.suggest.current}:</span>
                    {currentValue(s, profile)}
                  </p>
                  <ArrowDown className="mx-auto size-3.5 text-muted" />
                </div>
              )}
              {preview(s) && (
                <p dir="auto" className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px] leading-relaxed">
                  {s.kind !== 'missing' && <span className="me-1 font-bold text-ok">{t.suggest.proposed}:</span>}
                  {preview(s)}
                </p>
              )}
              <div className="mt-2.5 flex gap-2">
                <Button size="sm" className="flex-1" variant={isPitch(s) && s.kind !== 'missing' ? 'outline' : 'primary'} icon={isPitch(s) && s.kind !== 'missing' ? <Replace className="size-4" /> : <Check className="size-4" />} onClick={() => applySuggestion(s)}>
                  {isPitch(s) && s.kind !== 'missing' ? t.suggest.replaceGeneral : s.kind === 'missing' ? t.suggest.apply : t.suggest.replace}
                </Button>
                <Button size="sm" variant="outline" icon={<X className="size-4" />} onClick={() => drop(s.id)}>
                  {t.suggest.dismiss}
                </Button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}

/** Upload a (new) CV and/or ask the AI to compare it with the profile. */
export function CvActions() {
  const { t, f } = useT();
  const { profile, settings, reviewing, setProfile } = useStore();
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const compare = async () => {
    try {
      const n = await runProfileReview();
      toast(n ? f(t.suggest.found, { n }) : t.suggest.none);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="space-y-2.5">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setReading(true);
          try {
            setProfile({ cvText: await readCvFile(file) });
          } catch (err) {
            toast(err instanceof Error ? err.message : String(err));
            return;
          } finally {
            setReading(false);
          }
          if (settings.apiKey) await compare();
          else toast(t.suggest.needKey);
        }}
      />
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" loading={reading} icon={<FileUp className="size-4" />} onClick={() => fileRef.current?.click()}>
          {reading ? t.suggest.reading : t.suggest.upload}
        </Button>
        {profile.cvText.trim().length > 80 && (
          <Button variant="soft" className="flex-1" loading={reviewing} disabled={!settings.apiKey} icon={<Wand2 className="size-4" />} onClick={compare}>
            {t.suggest.compare}
          </Button>
        )}
      </div>
      {reviewing && <p className="text-center text-[13px] text-muted">{t.suggest.comparing}</p>}
      {!settings.apiKey && profile.cvText.trim().length > 80 && <p className="text-[12.5px] text-muted">{t.suggest.needKey}</p>}
    </div>
  );
}
