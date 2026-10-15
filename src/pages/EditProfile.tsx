import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Award, BriefcaseBusiness, Check, GraduationCap, Languages, Plus, SlidersHorizontal, Target, Trash2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { Button, ChipGroup, Field, Input, Segmented, Select, Slider, TagInput, TextArea } from '../ui/kit';
import { QATAR_CITIES } from '../core/qatar';
import type { Availability, DistancePref, JobType, Lang, Seniority, VisaStatus, Workplace } from '../core/types';
import { SKILL_SUGGESTIONS, TITLE_SUGGESTIONS } from './Onboarding';
import { syncBackground } from '../lib/background';
import { SuggestionList } from '../ui/Suggestions';
import { MatchLevel } from '../ui/MatchLevel';

type Section = 'basics' | 'goals' | 'prefs' | 'experience' | 'education' | 'languages';
const SECTIONS: { id: Section; icon: typeof UserRound }[] = [
  { id: 'basics', icon: UserRound },
  { id: 'goals', icon: Target },
  { id: 'prefs', icon: SlidersHorizontal },
  { id: 'experience', icon: BriefcaseBusiness },
  { id: 'education', icon: GraduationCap },
  { id: 'languages', icon: Languages },
];

/** A titled card that groups related fields with generous spacing. */
function Group({ title, icon, children }: { title?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="card space-y-5 p-5">
      {title && (
        <h3 className="flex items-center gap-2 text-[15px] font-bold">
          {icon && <span className="text-gold">{icon}</span>}
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

export default function EditProfile({ section }: { section?: string }) {
  const { t, lang } = useT();
  const pop = useNav((s) => s.pop);
  const { profile: p, setProfile, setPrefs } = useStore();
  const prefs = p.prefs;
  const initial = (SECTIONS.find((s) => s.id === section)?.id ?? 'basics') as Section;
  const [tab, setTab] = useState<Section>(initial);
  const [dir, setDir] = useState(1);
  const tabsRef = useRef<HTMLDivElement>(null);
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const sx = lang === 'ar' ? -1 : 1;
  const opts = <T extends string>(o: Record<T, string>) => (Object.keys(o) as T[]).map((id) => ({ id, label: o[id] }));
  const cityOptions = QATAR_CITIES.map((c) => ({ id: c.id, label: lang === 'ar' ? c.ar : c.en }));

  useEffect(() => {
    tabsRef.current?.querySelector(`[data-tab="${tab}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [tab]);

  const select = (id: Section) => {
    setDir(SECTIONS.findIndex((s) => s.id === id) > SECTIONS.findIndex((s) => s.id === tab) ? 1 : -1);
    setTab(id);
  };
  const close = () => {
    void syncBackground();
    pop();
  };

  const content: Record<Section, ReactNode> = {
    basics: (
      <>
        <Group>
          <Field label={t.ob.basics.name}>
            <Input value={p.fullName} onChange={(e) => setProfile({ fullName: e.target.value })} autoComplete="name" />
          </Field>
          <Field label={t.ob.basics.headline}>
            <Input value={p.headline} placeholder={t.ob.basics.headlinePh} onChange={(e) => setProfile({ headline: e.target.value })} />
          </Field>
          <Field label={t.ob.basics.nationality}>
            <Input value={p.nationality} onChange={(e) => setProfile({ nationality: e.target.value })} />
          </Field>
        </Group>
        <Group title={t.profile.contact}>
          <Field label={t.ob.basics.phone}>
            <Input dir="ltr" type="tel" value={p.phone} placeholder="+974" onChange={(e) => setProfile({ phone: e.target.value })} />
          </Field>
          <Field label={t.ob.basics.whatsapp}>
            <Input dir="ltr" type="tel" value={p.whatsapp} placeholder="+974" onChange={(e) => setProfile({ whatsapp: e.target.value })} />
          </Field>
          <Field label={t.ob.basics.email}>
            <Input dir="ltr" type="email" value={p.email} onChange={(e) => setProfile({ email: e.target.value })} />
          </Field>
          <Field label={t.ob.basics.linkedin}>
            <Input dir="ltr" value={p.linkedin} onChange={(e) => setProfile({ linkedin: e.target.value })} />
          </Field>
        </Group>
        <Group title={t.profile.location}>
          <Field label={t.ob.basics.city}>
            <Select value={p.city} onChange={(v) => setProfile({ city: v })} options={cityOptions} />
          </Field>
        </Group>
      </>
    ),
    goals: (
      <>
        <Group>
          <Field label={t.ob.goals.titles}>
            <TagInput value={p.targetTitles} onChange={(v) => setProfile({ targetTitles: v })} placeholder={t.ob.goals.titlesPh} suggestions={TITLE_SUGGESTIONS[lang]} />
          </Field>
          <Field label={t.ob.goals.skills}>
            <TagInput value={p.skills} onChange={(v) => setProfile({ skills: v })} placeholder={t.ob.goals.skillsPh} suggestions={SKILL_SUGGESTIONS} />
          </Field>
        </Group>
        <Group>
          <Field label={`${t.ob.goals.years}: ${p.yearsExperience}`}>
            <Slider value={p.yearsExperience} min={0} max={30} onChange={(v) => setProfile({ yearsExperience: v })} />
          </Field>
          <Field label={t.ob.goals.seniority}>
            <ChipGroup<Seniority> options={opts(t.seniority)} value={prefs.seniority} onChange={(v) => setPrefs({ seniority: v })} />
          </Field>
        </Group>
        <Group title={t.profile.summary}>
          <TextArea rows={6} value={p.summary} onChange={(e) => setProfile({ summary: e.target.value })} />
        </Group>
      </>
    ),
    prefs: (
      <>
        <Group title={t.profile.jobTypeSec}>
          <Field label={t.ob.type.jobType}>
            <ChipGroup<JobType> options={opts(t.jobType)} value={prefs.jobTypes} onChange={(v) => setPrefs({ jobTypes: v })} />
          </Field>
          <Field label={t.ob.type.workplace}>
            <ChipGroup<Workplace> options={opts(t.workplace)} value={prefs.workplaces} onChange={(v) => setPrefs({ workplaces: v })} />
          </Field>
        </Group>
        <Group title={t.profile.languageSec}>
          <Field label={t.ob.language.jobLang}>
            <ChipGroup<Lang> options={opts(t.langs)} value={prefs.jobLanguages} onChange={(v) => setPrefs({ jobLanguages: v })} />
          </Field>
          <Field label={t.ob.language.cvLang}>
            <Segmented value={prefs.cvLanguage} onChange={(v) => setPrefs({ cvLanguage: v })} options={[{ id: 'auto', label: t.ob.language.auto }, { id: 'ar', label: t.langs.ar }, { id: 'en', label: t.langs.en }]} />
          </Field>
        </Group>
        <Group title={t.profile.placeSec}>
          <Field label={t.ob.location.distance}>
            <ChipGroup<DistancePref> multi={false} options={opts(t.distance)} value={[prefs.distance]} onChange={(v) => setPrefs({ distance: v[0] })} />
          </Field>
          {prefs.distance === 'near' && (
            <Field label={`${t.ob.location.maxKm}: ${prefs.maxKm} ${t.common.km}`}>
              <Slider value={prefs.maxKm} min={5} max={80} step={5} onChange={(v) => setPrefs({ maxKm: v })} />
            </Field>
          )}
        </Group>
        <Group title={t.profile.statusSec}>
          <Field label={t.ob.status.visa}>
            <ChipGroup<VisaStatus> multi={false} options={opts(t.visa)} value={[prefs.visaStatus]} onChange={(v) => setPrefs({ visaStatus: v[0] })} />
          </Field>
          <Field label={t.ob.status.availability}>
            <ChipGroup<Availability> multi={false} options={opts(t.availability)} value={[prefs.availability]} onChange={(v) => setPrefs({ availability: v[0] })} />
          </Field>
          <Field label={`${t.ob.status.salary}: ${prefs.salaryMinQar ? `${prefs.salaryMinQar.toLocaleString()} ${t.common.qar}` : t.ob.status.salaryAny}`}>
            <Slider value={prefs.salaryMinQar} min={0} max={40000} step={500} onChange={(v) => setPrefs({ salaryMinQar: v })} />
          </Field>
        </Group>
        <Group title={t.profile.autoSec}>
          <MatchLevel />
          <Field label={t.profile.exclude}>
            <TagInput value={prefs.excludeKeywords} onChange={(v) => setPrefs({ excludeKeywords: v })} placeholder={t.profile.excludePh} />
          </Field>
        </Group>
      </>
    ),
    experience: (
      <>
        <AnimatePresence initial={false}>
          {p.experience.map((e, i) => {
            const upd = (x: Partial<typeof e>) => setProfile({ experience: p.experience.map((y, j) => (j === i ? { ...y, ...x } : y)) });
            return (
              <motion.section key={i} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, height: 0 }} className="card space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-gold">#{i + 1}</span>
                  <button onClick={() => setProfile({ experience: p.experience.filter((_, j) => j !== i) })} className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2" aria-label={t.common.remove}>
                    <Trash2 className="size-5" />
                  </button>
                </div>
                <Field label={t.profile.jobTitle}>
                  <Input value={e.title} onChange={(ev) => upd({ title: ev.target.value })} />
                </Field>
                <Field label={t.profile.company}>
                  <Input value={e.company} onChange={(ev) => upd({ company: ev.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t.profile.start}>
                    <Input value={e.start} placeholder="2021" onChange={(ev) => upd({ start: ev.target.value })} />
                  </Field>
                  <Field label={t.profile.end}>
                    <Input value={e.end} onChange={(ev) => upd({ end: ev.target.value })} />
                  </Field>
                </div>
                <Field label={t.profile.bullets}>
                  <TextArea rows={5} value={e.bullets.join('\n')} onChange={(ev) => upd({ bullets: ev.target.value.split('\n') })} />
                </Field>
              </motion.section>
            );
          })}
        </AnimatePresence>
        <Button variant="soft" size="lg" className="w-full" icon={<Plus className="size-5" />} onClick={() => setProfile({ experience: [...p.experience, { title: '', company: '', start: '', end: '', bullets: [] }] })}>
          {t.profile.addExp}
        </Button>
      </>
    ),
    education: (
      <>
        {p.education.map((e, i) => {
          const upd = (x: Partial<typeof e>) => setProfile({ education: p.education.map((y, j) => (j === i ? { ...y, ...x } : y)) });
          return (
            <section key={i} className="card space-y-4 p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-gold">#{i + 1}</span>
                <button onClick={() => setProfile({ education: p.education.filter((_, j) => j !== i) })} className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2" aria-label={t.common.remove}>
                  <Trash2 className="size-5" />
                </button>
              </div>
              <Field label={t.profile.degree}>
                <Input value={e.degree} onChange={(ev) => upd({ degree: ev.target.value })} />
              </Field>
              <Field label={t.profile.school}>
                <Input value={e.school} onChange={(ev) => upd({ school: ev.target.value })} />
              </Field>
              <Field label={t.profile.year}>
                <Input value={e.year} inputMode="numeric" onChange={(ev) => upd({ year: ev.target.value })} />
              </Field>
            </section>
          );
        })}
        <Button variant="soft" size="lg" className="w-full" icon={<Plus className="size-5" />} onClick={() => setProfile({ education: [...p.education, { degree: '', school: '', year: '' }] })}>
          {t.profile.addEdu}
        </Button>
        <Group title={t.profile.certifications} icon={<Award className="size-5" />}>
          <TagInput value={p.certifications} onChange={(v) => setProfile({ certifications: v })} />
        </Group>
      </>
    ),
    languages: (
      <>
        {p.languages.map((l, i) => (
          <section key={i} className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-gold">#{i + 1}</span>
              <button onClick={() => setProfile({ languages: p.languages.filter((_, j) => j !== i) })} className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2" aria-label={t.common.remove}>
                <Trash2 className="size-5" />
              </button>
            </div>
            <Field label={t.profile.langName}>
              <Input value={l.name} onChange={(e) => setProfile({ languages: p.languages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            </Field>
            <Field label={t.profile.level}>
              <Input value={l.level} onChange={(e) => setProfile({ languages: p.languages.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)) })} />
            </Field>
          </section>
        ))}
        <Button variant="soft" size="lg" className="w-full" icon={<Plus className="size-5" />} onClick={() => setProfile({ languages: [...p.languages, { name: '', level: '' }] })}>
          {t.common.add}
        </Button>
      </>
    ),
  };

  return (
    <div className="min-h-full bg-bg">
      <header className="sticky top-0 z-20 border-b border-line bg-surface pt-safe">
        <div className="flex items-center justify-between px-3 pb-1">
          <button onClick={close} className="grid size-11 place-items-center rounded-full" aria-label={t.common.back}>
            <Back className="size-5" />
          </button>
          <span className="font-display text-lg font-semibold">{t.profile.edit}</span>
          <span className="size-11" />
        </div>
        <div ref={tabsRef} className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3 pt-1">
          {SECTIONS.map(({ id, icon: Icon }) => {
            const active = tab === id;
            return (
              <button key={id} data-tab={id} onClick={() => select(id)} className={`relative flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold transition-colors ${active ? 'text-white' : 'border border-line text-muted'}`}>
                {active && <motion.span layoutId="edit-tab" className="absolute inset-0 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <Icon className="relative size-4" />
                <span className="relative">{t.profile.tabs[id]}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="overflow-x-hidden px-4 pb-40 pt-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, x: 40 * dir * sx }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 * dir * sx }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} className="mx-auto max-w-xl space-y-4">
            {tab !== 'prefs' && <SuggestionList section={tab} compact />}
            {content[tab]}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-3" style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}>
        <Button size="lg" className="mx-auto w-full max-w-xl" icon={<Check className="size-5" />} onClick={close}>
          {t.profile.saveAll}
        </Button>
      </div>
    </div>
  );
}
