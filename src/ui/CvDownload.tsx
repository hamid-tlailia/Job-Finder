import { Download } from 'lucide-react';
import { useState } from 'react';
import { EMPTY, useStore } from '../store/useStore';
import { useT } from '../i18n';
import { Button, Chip, Field, Segmented, Sheet, Toggle, toast } from './kit';
import { downloadFieldCv } from '../lib/fieldCv';
import type { CvTemplate, Lang } from '../core/types';

/** Sheet to download a ready (not job-specific) CV for the profile or one track. */
export function CvDownloadSheet({ open, onClose, trackId }: { open: boolean; onClose: () => void; trackId?: string }) {
  const { t, lang: ui } = useT();
  const tracks = useStore((s) => s.profile.tracks ?? EMPTY);
  const cvLang = useStore((s) => s.profile.prefs.cvLanguage);
  const tpl = useStore((s) => s.settings.cvTemplate);
  const [target, setTarget] = useState<string>(trackId ?? tracks[0]?.id ?? 'general');
  const [lang, setLang] = useState<Lang>(cvLang === 'auto' ? ui : cvLang);
  const [template, setTemplate] = useState<CvTemplate>(tpl === 'executive' ? 'executive' : 'classic');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={t.aiTools.downloadTitle}>
      <div className="space-y-5 pb-4">
        {!trackId && tracks.length > 0 && (
          <Field label={t.aiTools.which}>
            <div className="flex flex-wrap gap-2">
              {[{ id: 'general', name: t.aiTools.general }, ...tracks.map((x) => ({ id: x.id, name: x.name || t.tracks.untitled }))].map((x) => (
                <Chip key={x.id} active={target === x.id} onClick={() => setTarget(x.id)}>
                  {x.name}
                </Chip>
              ))}
            </div>
          </Field>
        )}
        <Field label={t.aiTools.language}>
          <Segmented value={lang} onChange={setLang} options={[{ id: 'ar', label: t.langs.ar }, { id: 'en', label: t.langs.en }]} />
        </Field>
        <Field label={t.aiTools.design}>
          <Segmented value={template} onChange={setTemplate} options={[{ id: 'classic', label: t.templates.classic }, { id: 'executive', label: t.templates.executive }]} />
        </Field>
        <Toggle checked={fresh} onChange={setFresh} label={t.aiTools.fresh} hint={t.aiTools.freshHint} />
        <Button
          size="lg"
          variant="gold"
          className="w-full"
          loading={busy}
          icon={<Download className="size-5" />}
          onClick={async () => {
            setBusy(true);
            try {
              await downloadFieldCv(target === 'general' ? undefined : target, lang, template, fresh);
              onClose();
            } catch (e) {
              toast(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? t.aiTools.making : t.aiTools.go}
        </Button>
      </div>
    </Sheet>
  );
}
