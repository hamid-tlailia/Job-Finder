import { Check, Download, Sparkles, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { Button, Sheet, toast } from './kit';
import { applyPolish, runPolish, undoPolish } from '../lib/polish';
import type { PolishResult } from '../ai/claude';
import { CvDownloadSheet } from './CvDownload';

/** Profile card: one-tap AI polish (with preview and undo) and ready-CV download. */
export function AiTools() {
  const { t } = useT();
  const apiKey = useStore((s) => s.settings.apiKey);
  const backup = useStore((s) => s.profileBackup);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PolishResult | null>(null);
  const [dl, setDl] = useState(false);
  return (
    <div className="card space-y-3 p-4">
      <h3 className="flex items-center gap-2 text-[14.5px] font-bold">
        <Sparkles className="size-4 text-gold" />
        {t.aiTools.title}
      </h3>
      <p className="text-[12.5px] leading-relaxed text-muted">{t.aiTools.polishBody}</p>
      <Button
        variant="gold"
        className="w-full"
        loading={busy}
        disabled={!apiKey}
        icon={<Sparkles className="size-4" />}
        onClick={async () => {
          setBusy(true);
          try {
            setResult(await runPolish());
          } catch (e) {
            toast(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? t.aiTools.polishing : t.aiTools.polish}
      </Button>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" icon={<Download className="size-4" />} onClick={() => setDl(true)}>
          {t.aiTools.download}
        </Button>
        {backup && (
          <Button
            variant="ghost"
            icon={<Undo2 className="size-4" />}
            onClick={() => {
              undoPolish();
              toast(t.aiTools.undone);
            }}
          >
            {t.aiTools.undo}
          </Button>
        )}
      </div>
      {!apiKey && <p className="text-[12px] text-muted">{t.aiTools.needKey}</p>}

      <Sheet open={!!result} onClose={() => setResult(null)} title={t.aiTools.review}>
        {result && (
          <div className="space-y-4 pb-4">
            <ul className="space-y-2">
              {result.changes.map((c, i) => (
                <li key={i} className="flex gap-2 text-[14px] leading-relaxed">
                  <Check className="mt-1 size-4 shrink-0 text-ok" />
                  {c}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button size="lg" variant="outline" className="flex-1" onClick={() => setResult(null)}>
                {t.common.cancel}
              </Button>
              <Button
                size="lg"
                className="flex-[1.5]"
                icon={<Check className="size-5" />}
                onClick={() => {
                  applyPolish(result);
                  setResult(null);
                  toast(t.aiTools.applied);
                }}
              >
                {t.aiTools.apply}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
      <CvDownloadSheet open={dl} onClose={() => setDl(false)} />
    </div>
  );
}
