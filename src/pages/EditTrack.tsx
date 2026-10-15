import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Download, FileCheck2, FileUp, Trash2 } from 'lucide-react';
import { CvDownloadSheet } from '../ui/CvDownload';
import { useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { Button, Field, Input, TagInput, TextArea, toast } from '../ui/kit';
import { SuggestionList } from '../ui/Suggestions';
import { importTrackCv, removeTrack, updateTrack } from '../lib/tracks';
import { SKILL_SUGGESTIONS, TITLE_SUGGESTIONS } from './Onboarding';

export default function EditTrack({ id }: { id: string }) {
  const { t, f, lang } = useT();
  const pop = useNav((s) => s.pop);
  const track = useStore((s) => s.profile.tracks?.find((x) => x.id === id));
  const apiKey = useStore((s) => s.settings.apiKey);
  const [reading, setReading] = useState(false);
  const [dl, setDl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  if (!track) return null;
  const set = (patch: Parameters<typeof updateTrack>[1]) => updateTrack(id, patch);

  return (
    <div className="min-h-full bg-bg">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-3 pb-2 pt-safe">
        <button onClick={pop} className="grid size-11 place-items-center rounded-full" aria-label={t.common.back}>
          <Back className="size-5" />
        </button>
        <span className="font-display truncate text-lg font-semibold">{track.name || t.tracks.edit}</span>
        <span className="size-11" />
      </header>

      <div className="mx-auto max-w-xl space-y-4 px-4 pb-40 pt-5">
        <section className="card space-y-5 p-5">
          <Field label={t.tracks.name}>
            <Input value={track.name} placeholder={t.tracks.namePh} onChange={(e) => set({ name: e.target.value })} />
          </Field>
        </section>

        <section className="card space-y-3 p-5">
          <h3 className="text-[15px] font-bold">{t.tracks.cv}</h3>
          <p className="text-[13px] leading-relaxed text-muted">{t.tracks.cvHint}</p>
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
                const r = await importTrackCv(id, file);
                toast(r.filled ? (r.suggestions ? `${t.tracks.filled} · ${f(t.suggest.found, { n: r.suggestions })}` : t.tracks.filled) : t.suggest.needKey);
              } catch (err) {
                toast(err instanceof Error ? err.message : String(err));
              } finally {
                setReading(false);
              }
            }}
          />
          {track.cvText.trim() ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 rounded-2xl bg-ok/10 px-4 py-3">
              <FileCheck2 className="size-6 shrink-0 text-ok" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{track.cvName || t.tracks.cvYes}</div>
                <div className="text-[12px] text-muted">{t.tracks.cvYes}</div>
              </div>
            </motion.div>
          ) : null}
          <Button variant={track.cvText.trim() ? 'outline' : 'gold'} className="w-full" loading={reading} icon={<FileUp className="size-4" />} onClick={() => fileRef.current?.click()}>
            {reading ? t.tracks.reading : track.cvText.trim() ? t.tracks.replace : t.tracks.upload}
          </Button>
          {!apiKey && <p className="text-[12.5px] text-muted">{t.suggest.needKey}</p>}
        </section>

        <SuggestionList compact />

        <section className="card space-y-5 p-5">
          <Field label={t.ob.goals.titles}>
            <TagInput value={track.targetTitles} onChange={(v) => set({ targetTitles: v })} placeholder={t.ob.goals.titlesPh} suggestions={TITLE_SUGGESTIONS[lang]} />
          </Field>
          <Field label={t.tracks.keywords} hint={t.tracks.keywordsHint}>
            <TagInput value={track.keywords ?? []} onChange={(v) => set({ keywords: v })} />
          </Field>
          <Field label={t.ob.basics.headline}>
            <Input value={track.headline} placeholder={t.ob.basics.headlinePh} onChange={(e) => set({ headline: e.target.value })} />
          </Field>
          <Field label={t.profile.summary}>
            <TextArea rows={5} value={track.summary} onChange={(e) => set({ summary: e.target.value })} />
          </Field>
          <Field label={t.ob.goals.skills}>
            <TagInput value={track.skills} onChange={(v) => set({ skills: v })} placeholder={t.ob.goals.skillsPh} suggestions={SKILL_SUGGESTIONS} />
          </Field>
        </section>

        <Button variant="outline" size="lg" className="w-full" icon={<Download className="size-5" />} onClick={() => setDl(true)}>
          {t.aiTools.download}
        </Button>
        <CvDownloadSheet open={dl} onClose={() => setDl(false)} trackId={id} />

        <Button
          variant="ghost"
          className="w-full !text-accent"
          icon={<Trash2 className="size-4" />}
          onClick={() => {
            if (window.confirm(t.tracks.removeConfirm)) {
              removeTrack(id);
              pop();
            }
          }}
        >
          {t.tracks.remove}
        </Button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-3" style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}>
        <Button size="lg" className="mx-auto w-full max-w-xl" icon={<Check className="size-5" />} onClick={pop}>
          {t.profile.saveAll}
        </Button>
      </div>
    </div>
  );
}
