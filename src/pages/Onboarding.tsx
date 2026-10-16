import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Bell, FileUp, Globe2, Laptop, MapPin, Moon, Sparkles, Sun, Wand2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useStore, hasAi, aiCfg } from '../store/useStore';
import { useT } from '../i18n';
import { Button, ChipGroup, Field, Input, Segmented, Select, TagInput, TextArea, Toggle, toast, Slider } from '../ui/kit';
import { COUNTRIES, QATAR_CITIES } from '../core/qatar';
import type { Availability, DistancePref, JobType, Lang, Seniority, VisaStatus, Workplace } from '../core/types';
import { readCvFile } from '../lib/cvImport';
import { parseCv } from '../ai/claude';
import { ensureNotifyPermission } from '../lib/notify';
import { runSearch } from '../lib/pipeline';
import { MatchLevel } from '../ui/MatchLevel';
import { AvoidIndustries } from '../ui/AvoidIndustries';

export const TITLE_SUGGESTIONS = {
  en: ['Accountant', 'Sales Executive', 'Software Engineer', 'Customer Service', 'Admin Assistant', 'HR Officer', 'Civil Engineer', 'Nurse', 'Teacher', 'Driver', 'Marketing Specialist', 'Receptionist'],
  ar: ['محاسب', 'مندوب مبيعات', 'مهندس برمجيات', 'خدمة عملاء', 'مساعد إداري', 'موارد بشرية', 'مهندس مدني', 'ممرض', 'معلم', 'سائق', 'أخصائي تسويق', 'موظف استقبال'],
};
export const SKILL_SUGGESTIONS = ['Microsoft Excel', 'Communication', 'Customer Service', 'SAP', 'Sales', 'Project Management', 'Arabic', 'English', 'Leadership', 'AutoCAD', 'Python', 'Data Analysis'];

function StepShell({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-accent-soft to-gold-soft text-accent">{icon}</div>
      <h1 className="font-display text-[1.9rem] font-bold leading-tight">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
      <div className="mt-7 space-y-6">{children}</div>
    </div>
  );
}

export default function Onboarding({ onBack }: { onBack: () => void }) {
  const { t, lang, f } = useT();
  const { profile, settings, setProfile, setPrefs, setSettings, finishOnboarding } = useStore();
  const prefs = profile.prefs;
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [parsing, setParsing] = useState(false);
  const [cvMsg, setCvMsg] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const opts = <T extends string>(o: Record<T, string>) => (Object.keys(o) as T[]).map((id) => ({ id, label: o[id] }));

  async function importCv(text: string) {
    setProfile({ cvText: text });
    if (!hasAi(settings)) {
      setCvMsg(t.ob.cv.needKey);
      return;
    }
    setParsing(true);
    try {
      const r = await parseCv(aiCfg(settings), text);
      const pick = <T,>(a: T, b: T) => (a && (!Array.isArray(a) || a.length) ? a : b);
      const cur = useStore.getState().profile;
      setProfile({
        fullName: pick(r.fullName, cur.fullName),
        email: pick(r.email, cur.email),
        phone: pick(r.phone, cur.phone),
        linkedin: pick(r.linkedin, cur.linkedin),
        nationality: pick(r.nationality, cur.nationality),
        headline: pick(r.headline, cur.headline),
        summary: pick(r.summary, cur.summary),
        targetTitles: pick(r.targetTitles, cur.targetTitles),
        skills: pick(r.skills, cur.skills),
        yearsExperience: r.yearsExperience || cur.yearsExperience,
        experience: pick(r.experience, cur.experience),
        education: pick(r.education, cur.education),
        certifications: pick(r.certifications, cur.certifications),
        languages: pick(r.languages, cur.languages),
      });
      setCvMsg(t.ob.cv.parsed);
      useStore.getState().setSuggestions([], new Date().toISOString()); // just filled from this CV; nothing to compare yet
    } catch (e) {
      setCvMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  }

  const steps: { valid: boolean; node: ReactNode }[] = [
    {
      valid: true,
      node: (
        <StepShell icon={<Sun className="size-7" />} title={t.ob.appearance.title} body={t.ob.appearance.body}>
          <Field label={t.ob.appearance.lang}>
            <Segmented value={lang} onChange={(v) => setSettings({ uiLang: v })} options={[{ id: 'ar', label: 'العربية' }, { id: 'en', label: 'English' }]} />
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
        </StepShell>
      ),
    },
    {
      valid: true,
      node: (
        <StepShell icon={<Globe2 className="size-7" />} title={t.ob.country.title} body={t.ob.country.body}>
          <div className="grid grid-cols-2 gap-3">
            {COUNTRIES.map((c) => (
              <motion.button
                key={c.id}
                whileTap={c.enabled ? { scale: 0.96 } : undefined}
                onClick={() => c.enabled && setPrefs({ country: c.id })}
                className={`relative flex h-24 flex-col items-start justify-between rounded-2xl border p-4 text-start ${prefs.country === c.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface'} ${c.enabled ? '' : 'opacity-50'}`}
              >
                <span className="text-3xl">{c.flag}</span>
                <span className="font-semibold">{lang === 'ar' ? c.ar : c.en}</span>
                {!c.enabled && <span className="absolute end-3 top-3 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-muted">{t.common.soon}</span>}
              </motion.button>
            ))}
          </div>
        </StepShell>
      ),
    },
    {
      valid: true,
      node: (
        <StepShell icon={<FileUp className="size-7" />} title={t.ob.cv.title} body={t.ob.cv.body}>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                await importCv(await readCvFile(file));
              } catch (err) {
                toast(err instanceof Error ? err.message : String(err));
              }
            }}
          />
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-gold/50 bg-gold-soft px-6 py-9 text-center">
            <FileUp className="size-8 text-gold" />
            <span className="font-semibold">{t.ob.cv.upload}</span>
          </motion.button>
          <Field label={t.ob.cv.paste}>
            <TextArea rows={5} value={profile.cvText} onChange={(e) => setProfile({ cvText: e.target.value })} />
          </Field>
          {profile.cvText.length > 80 && (
            <Button variant="soft" className="w-full" loading={parsing} icon={<Wand2 className="size-4" />} onClick={() => importCv(profile.cvText)}>
              {parsing ? t.ob.cv.parsing : t.ob.cv.parse}
            </Button>
          )}
          <AnimatePresence>{cvMsg && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed">{cvMsg}</motion.p>}</AnimatePresence>
        </StepShell>
      ),
    },
    {
      valid: !!profile.fullName.trim() && (!!profile.phone.trim() || !!profile.email.trim()),
      node: (
        <StepShell icon={<span className="text-2xl">👤</span>} title={t.ob.basics.title} body={t.ob.basics.body}>
          <Field label={t.ob.basics.name}>
            <Input value={profile.fullName} onChange={(e) => setProfile({ fullName: e.target.value })} autoComplete="name" />
          </Field>
          <Field label={t.ob.basics.headline}>
            <Input value={profile.headline} placeholder={t.ob.basics.headlinePh} onChange={(e) => setProfile({ headline: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.ob.basics.phone}>
              <Input dir="ltr" type="tel" value={profile.phone} placeholder="+974" onChange={(e) => setProfile({ phone: e.target.value })} />
            </Field>
            <Field label={t.ob.basics.whatsapp}>
              <Input dir="ltr" type="tel" value={profile.whatsapp} placeholder="+974" onChange={(e) => setProfile({ whatsapp: e.target.value })} />
            </Field>
          </div>
          <Field label={t.ob.basics.email}>
            <Input dir="ltr" type="email" value={profile.email} onChange={(e) => setProfile({ email: e.target.value })} autoComplete="email" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.ob.basics.nationality}>
              <Input value={profile.nationality} onChange={(e) => setProfile({ nationality: e.target.value })} />
            </Field>
            <Field label={t.ob.basics.city}>
              <Select value={profile.city} onChange={(v) => setProfile({ city: v })} options={QATAR_CITIES.map((c) => ({ id: c.id, label: lang === 'ar' ? c.ar : c.en }))} />
            </Field>
          </div>
          <Field label={`${t.ob.basics.linkedin} · ${t.common.optional}`}>
            <Input dir="ltr" value={profile.linkedin} onChange={(e) => setProfile({ linkedin: e.target.value })} />
          </Field>
        </StepShell>
      ),
    },
    {
      valid: profile.targetTitles.length > 0,
      node: (
        <StepShell icon={<span className="text-2xl">🎯</span>} title={t.ob.goals.title} body={t.ob.goals.body}>
          <Field label={t.ob.goals.titles}>
            <TagInput value={profile.targetTitles} onChange={(v) => setProfile({ targetTitles: v })} placeholder={t.ob.goals.titlesPh} suggestions={TITLE_SUGGESTIONS[lang]} />
          </Field>
          <Field label={t.ob.goals.skills}>
            <TagInput value={profile.skills} onChange={(v) => setProfile({ skills: v })} placeholder={t.ob.goals.skillsPh} suggestions={SKILL_SUGGESTIONS} />
          </Field>
          <Field label={`${t.ob.goals.years}: ${profile.yearsExperience}`}>
            <Slider min={0} max={30} value={profile.yearsExperience} onChange={(v) => setProfile({ yearsExperience: v })} />
          </Field>
          <Field label={`${t.ob.goals.seniority} · ${t.common.optional}`}>
            <ChipGroup<Seniority> options={opts(t.seniority)} value={prefs.seniority} onChange={(v) => setPrefs({ seniority: v })} />
          </Field>
        </StepShell>
      ),
    },
    {
      valid: prefs.jobTypes.length > 0 && prefs.workplaces.length > 0,
      node: (
        <StepShell icon={<span className="text-2xl">🕘</span>} title={t.ob.type.title} body={t.ob.type.body}>
          <Field label={t.ob.type.jobType}>
            <ChipGroup<JobType> options={opts(t.jobType)} value={prefs.jobTypes} onChange={(v) => setPrefs({ jobTypes: v })} />
          </Field>
          <Field label={t.ob.type.workplace}>
            <ChipGroup<Workplace> options={opts(t.workplace)} value={prefs.workplaces} onChange={(v) => setPrefs({ workplaces: v })} />
          </Field>
          <AvoidIndustries />
        </StepShell>
      ),
    },
    {
      valid: prefs.jobLanguages.length > 0,
      node: (
        <StepShell icon={<span className="text-2xl">🗣️</span>} title={t.ob.language.title} body={t.ob.language.body}>
          <Field label={t.ob.language.jobLang}>
            <ChipGroup<Lang> options={opts(t.langs)} value={prefs.jobLanguages} onChange={(v) => setPrefs({ jobLanguages: v })} />
          </Field>
          <Field label={t.ob.language.cvLang}>
            <Segmented value={prefs.cvLanguage} onChange={(v) => setPrefs({ cvLanguage: v })} options={[{ id: 'auto', label: t.ob.language.auto }, { id: 'ar', label: t.langs.ar }, { id: 'en', label: t.langs.en }]} />
          </Field>
        </StepShell>
      ),
    },
    {
      valid: true,
      node: (
        <StepShell icon={<MapPin className="size-7" />} title={t.ob.location.title} body={t.ob.location.body}>
          <Field label={t.ob.location.distance}>
            <ChipGroup<DistancePref> multi={false} options={opts(t.distance)} value={[prefs.distance]} onChange={(v) => setPrefs({ distance: v[0] })} />
          </Field>
          <AnimatePresence>
            {prefs.distance === 'near' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <Field label={`${t.ob.location.maxKm}: ${prefs.maxKm} ${t.common.km}`}>
                  <Slider min={5} max={80} step={5} value={prefs.maxKm} onChange={(v) => setPrefs({ maxKm: v })} />
                </Field>
              </motion.div>
            )}
          </AnimatePresence>
          <Field label={t.ob.basics.city}>
            <Select value={profile.city} onChange={(v) => setProfile({ city: v })} options={QATAR_CITIES.map((c) => ({ id: c.id, label: lang === 'ar' ? c.ar : c.en }))} />
          </Field>
        </StepShell>
      ),
    },
    {
      valid: true,
      node: (
        <StepShell icon={<span className="text-2xl">🪪</span>} title={t.ob.status.title} body={t.ob.status.body}>
          <Field label={t.ob.status.visa}>
            <ChipGroup<VisaStatus> multi={false} options={opts(t.visa)} value={[prefs.visaStatus]} onChange={(v) => setPrefs({ visaStatus: v[0] })} />
          </Field>
          <Field label={t.ob.status.availability}>
            <ChipGroup<Availability> multi={false} options={opts(t.availability)} value={[prefs.availability]} onChange={(v) => setPrefs({ availability: v[0] })} />
          </Field>
          <Field label={`${t.ob.status.salary}: ${prefs.salaryMinQar ? `${prefs.salaryMinQar.toLocaleString()} ${t.common.qar}` : t.ob.status.salaryAny}`}>
            <Slider min={0} max={40000} step={500} value={prefs.salaryMinQar} onChange={(v) => setPrefs({ salaryMinQar: v })} />
          </Field>
        </StepShell>
      ),
    },
    {
      valid: true,
      node: (
        <StepShell icon={<Sparkles className="size-7" />} title={t.ob.finish.title} body={t.ob.finish.body}>
          <Field label={`${t.ob.finish.key} · ${t.common.optional}`} hint={t.ob.finish.keyHelp}>
            <Input dir="ltr" type="password" value={settings.apiKey} placeholder="sk-ant-…" onChange={(e) => setSettings({ apiKey: e.target.value.trim() })} />
          </Field>
          <div>
            <button type="button" onClick={() => setShowGuide((v) => !v)} className="text-sm font-semibold text-accent">
              {t.settings.howKey}
            </button>
            <AnimatePresence>
              {showGuide && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <ol className="mt-3 space-y-2.5 rounded-2xl bg-surface-2 p-4">
                    {t.keyGuide.claude.map((st, i) => (
                      <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                        <span className="font-bold text-accent">{i + 1}.</span>
                        {st}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{t.keyGuide.claudeCost}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <MatchLevel />
          <div className="card px-4">
            <Toggle
              checked={settings.notifications}
              onChange={async (v) => {
                setSettings({ notifications: v });
                if (v) await ensureNotifyPermission();
              }}
              label={
                <span className="flex items-center gap-2">
                  <Bell className="size-4 text-gold" />
                  {t.ob.finish.notify}
                </span>
              }
            />
          </div>
        </StepShell>
      ),
    },
  ];

  const last = step === steps.length - 1;
  const go = async (d: 1 | -1) => {
    if (d === -1 && step === 0) return onBack();
    if (d === 1 && last) {
      if (settings.notifications) await ensureNotifyPermission();
      finishOnboarding();
      void runSearch().catch(() => undefined);
      return;
    }
    setDir(d);
    setStep((s) => s + d);
  };
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const Next = lang === 'ar' ? ArrowLeft : ArrowRight;
  const sx = lang === 'ar' ? -1 : 1;

  return (
    <div className="hero-bg flex min-h-full flex-col px-6 pt-safe pb-safe">
      <div className="flex items-center gap-4 py-3">
        <button onClick={() => go(-1)} className="grid size-11 place-items-center rounded-full border border-line bg-surface">
          <Back className="size-5" />
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-gold" animate={{ width: `${((step + 1) / steps.length) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
        <span className="w-12 text-end text-xs font-bold tabular-nums text-muted">
          {step + 1}/{steps.length}
        </span>
      </div>
      <p className="sr-only">{f(t.ob.step, { n: step + 1, total: steps.length })}</p>
      <div className="relative flex-1 overflow-x-hidden pt-6">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={step} initial={{ x: 60 * dir * sx, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60 * dir * sx, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }} className="pb-32">
            {steps[step].node}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="pb-safe fixed inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg to-transparent px-6 pt-10">
        <div className="mb-3 flex gap-3">
          {(step === 2 || last) && (
            <Button variant="ghost" onClick={() => go(1)} className="shrink-0">
              {t.common.skip}
            </Button>
          )}
          <Button size="lg" className="flex-1" variant={last ? 'gold' : 'primary'} disabled={!steps[step].valid} onClick={() => go(1)}>
            {last ? t.ob.finish.start : t.common.next}
            {last ? <Sparkles className="size-5" /> : <Next className="size-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
