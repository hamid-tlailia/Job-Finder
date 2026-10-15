import { ArrowLeft, ArrowRight, ExternalLink, KeyRound, Laptop, Moon, ShieldCheck, Sun, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Browser } from '@capacitor/browser';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { Button, Field, Input, Segmented, SectionTitle, Select, Toggle, toast } from '../ui/kit';
import { SOURCES } from '../core/sources';
import { MODELS, testKey } from '../ai/claude';
import { ensureNotifyPermission } from '../lib/notify';
import { syncBackground } from '../lib/background';

export default function Settings() {
  const { t, lang } = useT();
  const pop = useNav((s) => s.pop);
  const { settings, setSettings, reset } = useStore();
  const [testing, setTesting] = useState(false);
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const close = () => {
    void syncBackground();
    pop();
  };

  return (
    <div className="min-h-full pb-16">
      <div className="glass sticky top-0 z-20 flex items-center gap-2 border-b border-line px-3 pt-safe pb-2">
        <button onClick={close} className="grid size-11 place-items-center rounded-full">
          <Back className="size-5" />
        </button>
        <span className="font-display text-lg font-semibold">{t.settings.title}</span>
      </div>
      <div className="px-4">
        <SectionTitle>{t.settings.general}</SectionTitle>
        <div className="card space-y-4 p-4">
          <Field label={t.ob.appearance.lang}>
            <Segmented value={settings.uiLang} onChange={(v) => setSettings({ uiLang: v })} options={[{ id: 'ar', label: 'العربية' }, { id: 'en', label: 'English' }]} />
          </Field>
          <Field label={t.ob.appearance.theme}>
            <Segmented
              value={settings.theme}
              onChange={(v) => setSettings({ theme: v })}
              options={[
                { id: 'system', label: t.theme.system, icon: <Laptop className="size-4" /> },
                { id: 'light', label: t.theme.light, icon: <Sun className="size-4" /> },
                { id: 'dark', label: t.theme.dark, icon: <Moon className="size-4" /> },
              ]}
            />
          </Field>
        </div>

        <SectionTitle>{t.settings.ai}</SectionTitle>
        <div className="card space-y-4 p-4">
          <Field label={t.ob.finish.key} hint={t.ob.finish.keyHelp}>
            <Input dir="ltr" type="password" placeholder="sk-ant-…" value={settings.apiKey} onChange={(e) => setSettings({ apiKey: e.target.value.trim() })} />
          </Field>
          <Field label={t.settings.model}>
            <Select value={settings.model} onChange={(v) => setSettings({ model: v })} options={MODELS.map((m) => ({ id: m.id, label: `${m.label}` }))} />
          </Field>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              icon={<KeyRound className="size-4" />}
              loading={testing}
              disabled={!settings.apiKey}
              onClick={async () => {
                setTesting(true);
                try {
                  await testKey({ apiKey: settings.apiKey, model: settings.model });
                  toast(`✓ ${t.settings.testOk}`);
                } catch (e) {
                  toast(e instanceof Error ? e.message : String(e));
                } finally {
                  setTesting(false);
                }
              }}
            >
              {t.settings.test}
            </Button>
            <Button variant="ghost" icon={<ExternalLink className="size-4" />} onClick={() => Browser.open({ url: 'https://console.anthropic.com/settings/keys' })}>
              Console
            </Button>
          </div>
        </div>

        <SectionTitle>{t.settings.sources}</SectionTitle>
        <div className="card p-4">
          <p className="mb-2 text-[13px] text-muted">{t.settings.sourcesBody}</p>
          <div className="divide-y divide-[var(--line)]">
            {SOURCES.map((s) => (
              <Toggle key={s.id} checked={settings.sources[s.id] !== false} onChange={(v) => setSettings({ sources: { ...settings.sources, [s.id]: v } })} label={s.label} hint={s.needsKey ? (s.needsKey === 'jooble' ? 'jooble.org/api/about' : 'serpapi.com') : undefined} />
            ))}
          </div>
          <div className="mt-3 space-y-3">
            <Field label={t.settings.joobleKey}>
              <Input dir="ltr" type="password" value={settings.joobleKey} onChange={(e) => setSettings({ joobleKey: e.target.value.trim() })} />
            </Field>
            <Field label={t.settings.serpKey}>
              <Input dir="ltr" type="password" value={settings.serpapiKey} onChange={(e) => setSettings({ serpapiKey: e.target.value.trim() })} />
            </Field>
          </div>
        </div>

        <SectionTitle>{t.settings.automation}</SectionTitle>
        <div className="card divide-y divide-[var(--line)] px-4">
          <Toggle checked={settings.autoPrepare} onChange={(v) => setSettings({ autoPrepare: v })} label={t.settings.autoPrepare} />
          <Toggle
            checked={settings.notifications}
            onChange={async (v) => {
              setSettings({ notifications: v });
              if (v) await ensureNotifyPermission();
            }}
            label={t.settings.notifications}
            hint={t.settings.backgroundBody}
          />
          <div className="py-3">
            <Field label={`${t.settings.maxAi}: ${settings.maxAiPerRun}`}>
              <input type="range" min={2} max={20} value={settings.maxAiPerRun} onChange={(e) => setSettings({ maxAiPerRun: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
            </Field>
          </div>
        </div>

        <SectionTitle>{t.settings.data}</SectionTitle>
        <div className="card space-y-3 p-4">
          <p className="flex gap-2 text-[13px] leading-relaxed text-muted">
            <ShieldCheck className="size-5 shrink-0 text-ok" />
            {t.settings.privacy}
          </p>
          <Button
            variant="outline"
            className="w-full !text-accent"
            icon={<Trash2 className="size-4" />}
            onClick={() => {
              if (window.confirm(t.settings.resetConfirm)) {
                reset();
                pop();
              }
            }}
          >
            {t.settings.reset}
          </Button>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          {t.appName} · {t.settings.version} 1.0.0
        </p>
      </div>
    </div>
  );
}
