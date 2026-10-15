import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, FileCheck2, FileX2, Layers, Plus, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { EMPTY, useStore } from '../store/useStore';
import { useT } from '../i18n';
import { useNav } from './nav';
import { Button, toast } from './kit';
import { addTrack, autoTracks } from '../lib/tracks';
import { MAX_TRACKS } from '../core/types';

export function TracksCard() {
  const { t, f, lang } = useT();
  const tracks = useStore((s) => s.profile.tracks ?? EMPTY);
  const apiKey = useStore((s) => s.settings.apiKey);
  const push = useNav((s) => s.push);
  const [busy, setBusy] = useState(false);
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight;
  const full = tracks.length >= MAX_TRACKS;

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[14.5px] font-bold">
          <Layers className="size-4 text-gold" />
          {t.tracks.title}
        </h3>
        <span className="text-[12px] font-semibold text-muted">
          {tracks.length}/{MAX_TRACKS}
        </span>
      </div>
      {!tracks.length && <p className="text-[13px] leading-relaxed text-muted">{t.tracks.body}</p>}
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {tracks.map((tr) => (
            <motion.li key={tr.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
              <button onClick={() => push({ name: 'track', id: tr.id })} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3.5 text-start active:bg-surface-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-[15px] font-bold text-accent">{(tr.name || '?').slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{tr.name || t.tracks.untitled}</span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-muted">{tr.targetTitles.join(' · ') || '—'}</span>
                </span>
                {tr.cvText.trim() ? <FileCheck2 className="size-5 shrink-0 text-ok" aria-label={t.tracks.cvYes} /> : <FileX2 className="size-5 shrink-0 text-muted" aria-label={t.tracks.cvNo} />}
                <Chevron className="size-4 shrink-0 text-muted" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {!full && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            icon={<Plus className="size-4" />}
            onClick={() => {
              const tr = addTrack();
              if (tr) push({ name: 'track', id: tr.id });
            }}
          >
            {t.tracks.add}
          </Button>
          {apiKey && (
            <Button
              variant="soft"
              className="flex-1"
              loading={busy}
              icon={<Wand2 className="size-4" />}
              onClick={async () => {
                setBusy(true);
                try {
                  toast(f(t.tracks.autoDone, { n: await autoTracks() }));
                } catch (e) {
                  toast(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? t.tracks.autoWorking : t.tracks.auto}
            </Button>
          )}
        </div>
      )}
      {full && <p className="text-center text-[12px] text-muted">{f(t.tracks.max, { n: MAX_TRACKS })}</p>}
    </div>
  );
}
