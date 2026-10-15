import { ArrowLeft, ArrowRight, CircleHelp, ExternalLink, KeyRound, Laptop, Moon, ShieldCheck, Sun, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Browser } from '@capacitor/browser';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { Button, Field, Input, Segmented, SectionTitle, Select, Sheet, Toggle, toast } from '../ui/kit';
import type { CvTemplate } from '../core/types';
import { SOURCES } from '../core/sources';
import { MODELS, testKey } from '../ai/claude';
import { ensureNotifyPermission } from '../lib/notify';
import { syncBackground } from '../lib/background';

export default function Settings() {
  const { t, lang } = useT();
  const pop = useNav((s) => s.pop);
  const { settings, setSettings, reset } = useStore();
  const [testing, setTesting] = useState(false);
  const [guide, setGuide] = useState<'claude' | 'serp' | 'jooble' | null>(null);
  const help = (g: 'claude' | 'serp' | 'jooble') => (
    <button type="button" onClick={() => setGuide(g)} className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
      <CircleHelp className="size-4" />
      {t.settings.howKey}
    </button>
  );
  const guides = {
    claude: { title: t.keyGuide.claudeTitle, steps: t.keyGuide.claude, note: t.keyGuide.claudeCost, url: 'https://platform.claude.com/settings/keys' },
    serp: { title: t.keyGuide.serpTitle, steps: t.keyGuide.serp, note: t.settings.serpQuota, url: 'https://serpapi.com/users/sign_up' },
    jooble: { title: t.keyGuide.joobleTitle, steps: t.keyGuide.jooble, note: '', url: 'https://jooble.org/api/about' },
  };
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const close = () => {
    void syncBackground();
    pop();
  };

  return (
    <div className="min-h-full pb-16">
      <div className="sticky top-0 bg-surface z-20 flex items-center gap-2 border-b border-line px-3 pt-safe pb-2">
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

        <SectionTitle>{t.settings.cvTemplate}</SectionTitle>
        <div className="card space-y-3 p-4">
          <p className="text-[13px] text-muted">{t.settings.cvTemplateBody}</p>
          <div className="grid grid-cols-3 gap-2.5">
            {(['auto', 'classic', 'executive'] as ('auto' | CvTemplate)[]).map((id) => (
              <motion.button
                key={id}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSettings({ cvTemplate: id })}
                className={`overflow-hidden rounded-2xl border text-start ${settings.cvTemplate === id ? 'border-accent ring-4 ring-[var(--accent-soft)]' : 'border-line'}`}
              >
                <TemplateThumb kind={id} />
                <div className="px-2.5 py-2 text-[13px] font-bold">{t.templates[id]}</div>
              </motion.button>
            ))}
          </div>
        </div>

        <SectionTitle>{t.settings.ai}</SectionTitle>
        <div className="card space-y-4 p-4">
          <Field label={t.ob.finish.key} hint={t.ob.finish.keyHelp}>
            <Input dir="ltr" type="password" placeholder="sk-ant-…" value={settings.apiKey} onChange={(e) => setSettings({ apiKey: e.target.value.trim() })} />
          </Field>
          {help('claude')}
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
            <Button variant="ghost" icon={<ExternalLink className="size-4" />} onClick={() => Browser.open({ url: 'https://platform.claude.com/settings/keys' })}>
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
            {help('jooble')}
            <Field label={t.settings.serpKey}>
              <Input dir="ltr" type="password" value={settings.serpapiKey} onChange={(e) => setSettings({ serpapiKey: e.target.value.trim() })} />
            </Field>
            {help('serp')}
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
        <Sheet open={!!guide} onClose={() => setGuide(null)} title={guide ? guides[guide].title : ''}>
          {guide && (
            <div className="space-y-4 pb-4">
              <ol className="space-y-3">
                {guides[guide].steps.map((st, i) => (
                  <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
                    <span>{st}</span>
                  </li>
                ))}
              </ol>
              {guides[guide].note && <p className="rounded-2xl bg-gold-soft p-3.5 text-[13px] leading-relaxed">{guides[guide].note}</p>}
              <Button className="w-full" icon={<ExternalLink className="size-4" />} onClick={() => Browser.open({ url: guides[guide].url })}>
                {t.keyGuide.open}
              </Button>
            </div>
          )}
        </Sheet>
        <p className="mt-6 text-center text-xs text-muted">
          {t.appName} · {t.settings.version} 1.4.3
        </p>
      </div>
    </div>
  );
}

/** Tiny schematic of each CV layout for the picker. */
function TemplateThumb({ kind }: { kind: 'auto' | CvTemplate }) {
  if (kind === 'auto')
    return (
      <div className="grid h-24 place-items-center bg-gradient-to-br from-accent-soft to-gold-soft text-2xl font-bold text-accent">A</div>
    );
  const exec = kind === 'executive';
  return (
    <div className="h-24 bg-white p-2" dir="ltr">
      {exec ? <div className="-m-2 mb-1.5 h-6 bg-[#14213d] p-1.5"><div className="h-1.5 w-12 rounded-sm bg-white/90" /><div className="mt-0.5 h-1 w-8 rounded-sm bg-[#c4a062]" /></div> : <><div className="h-2 w-14 rounded-sm bg-[#1a202c]" /><div className="mt-1 h-1 w-9 rounded-sm bg-[#7a1232]" /><div className="mt-1 h-px w-full bg-[#1a202c]" /></>}
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-1.5">
          <div className={`h-1 w-8 rounded-sm ${exec ? 'bg-[#14213d]' : 'bg-[#7a1232]'}`} />
          <div className="mt-0.5 h-0.5 w-full bg-gray-200" />
          <div className="mt-0.5 h-0.5 w-11/12 bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
