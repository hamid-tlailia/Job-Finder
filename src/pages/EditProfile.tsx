import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { Button, ChipGroup, Field, Input, Segmented, Select, SectionTitle, TagInput, TextArea } from '../ui/kit';
import { QATAR_CITIES } from '../core/qatar';
import type { Availability, DistancePref, JobType, Lang, Seniority, VisaStatus, Workplace } from '../core/types';
import { SKILL_SUGGESTIONS, TITLE_SUGGESTIONS } from './Onboarding';
import { syncBackground } from '../lib/background';

export default function EditProfile({ section }: { section?: string }) {
  const { t, lang } = useT();
  const pop = useNav((s) => s.pop);
  const { profile: p, setProfile, setPrefs } = useStore();
  const prefs = p.prefs;
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const opts = <T extends string>(o: Record<T, string>) => (Object.keys(o) as T[]).map((id) => ({ id, label: o[id] }));
  const close = () => {
    void syncBackground();
    pop();
  };
  const order = ['basics', 'prefs', 'experience', 'education', 'languages'];
  const sections = section ? [section, ...order.filter((s) => s !== section)] : order;

  const blocks: Record<string, React.ReactNode> = {
    basics: (
      <div key="basics" className="space-y-4">
        <SectionTitle>{t.ob.basics.title}</SectionTitle>
        <Field label={t.ob.basics.name}>
          <Input value={p.fullName} onChange={(e) => setProfile({ fullName: e.target.value })} />
        </Field>
        <Field label={t.ob.basics.headline}>
          <Input value={p.headline} onChange={(e) => setProfile({ headline: e.target.value })} />
        </Field>
        <Field label={t.profile.summary}>
          <TextArea rows={4} value={p.summary} onChange={(e) => setProfile({ summary: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.ob.basics.phone}>
            <Input dir="ltr" value={p.phone} onChange={(e) => setProfile({ phone: e.target.value })} />
          </Field>
          <Field label={t.ob.basics.whatsapp}>
            <Input dir="ltr" value={p.whatsapp} onChange={(e) => setProfile({ whatsapp: e.target.value })} />
          </Field>
        </div>
        <Field label={t.ob.basics.email}>
          <Input dir="ltr" value={p.email} onChange={(e) => setProfile({ email: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.ob.basics.nationality}>
            <Input value={p.nationality} onChange={(e) => setProfile({ nationality: e.target.value })} />
          </Field>
          <Field label={t.ob.basics.city}>
            <Select value={p.city} onChange={(v) => setProfile({ city: v })} options={QATAR_CITIES.map((c) => ({ id: c.id, label: lang === 'ar' ? c.ar : c.en }))} />
          </Field>
        </div>
        <Field label={t.ob.basics.linkedin}>
          <Input dir="ltr" value={p.linkedin} onChange={(e) => setProfile({ linkedin: e.target.value })} />
        </Field>
        <Field label={t.ob.goals.titles}>
          <TagInput value={p.targetTitles} onChange={(v) => setProfile({ targetTitles: v })} suggestions={TITLE_SUGGESTIONS[lang]} />
        </Field>
        <Field label={t.ob.goals.skills}>
          <TagInput value={p.skills} onChange={(v) => setProfile({ skills: v })} suggestions={SKILL_SUGGESTIONS} />
        </Field>
        <Field label={`${t.ob.goals.years}: ${p.yearsExperience}`}>
          <input type="range" min={0} max={30} value={p.yearsExperience} onChange={(e) => setProfile({ yearsExperience: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
        </Field>
      </div>
    ),
    prefs: (
      <div key="prefs" className="space-y-5">
        <SectionTitle>{t.profile.preferences}</SectionTitle>
        <Field label={t.ob.type.jobType}>
          <ChipGroup<JobType> options={opts(t.jobType)} value={prefs.jobTypes} onChange={(v) => setPrefs({ jobTypes: v })} />
        </Field>
        <Field label={t.ob.type.workplace}>
          <ChipGroup<Workplace> options={opts(t.workplace)} value={prefs.workplaces} onChange={(v) => setPrefs({ workplaces: v })} />
        </Field>
        <Field label={t.ob.goals.seniority}>
          <ChipGroup<Seniority> options={opts(t.seniority)} value={prefs.seniority} onChange={(v) => setPrefs({ seniority: v })} />
        </Field>
        <Field label={t.ob.language.jobLang}>
          <ChipGroup<Lang> options={opts(t.langs)} value={prefs.jobLanguages} onChange={(v) => setPrefs({ jobLanguages: v })} />
        </Field>
        <Field label={t.ob.language.cvLang}>
          <Segmented value={prefs.cvLanguage} onChange={(v) => setPrefs({ cvLanguage: v })} options={[{ id: 'auto', label: t.ob.language.auto }, { id: 'ar', label: t.langs.ar }, { id: 'en', label: t.langs.en }]} />
        </Field>
        <Field label={t.ob.location.distance}>
          <ChipGroup<DistancePref> multi={false} options={opts(t.distance)} value={[prefs.distance]} onChange={(v) => setPrefs({ distance: v[0] })} />
        </Field>
        {prefs.distance === 'near' && (
          <Field label={`${t.ob.location.maxKm}: ${prefs.maxKm} ${t.common.km}`}>
            <input type="range" min={5} max={80} step={5} value={prefs.maxKm} onChange={(e) => setPrefs({ maxKm: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
          </Field>
        )}
        <Field label={t.ob.status.visa}>
          <ChipGroup<VisaStatus> multi={false} options={opts(t.visa)} value={[prefs.visaStatus]} onChange={(v) => setPrefs({ visaStatus: v[0] })} />
        </Field>
        <Field label={t.ob.status.availability}>
          <ChipGroup<Availability> multi={false} options={opts(t.availability)} value={[prefs.availability]} onChange={(v) => setPrefs({ availability: v[0] })} />
        </Field>
        <Field label={`${t.ob.status.salary}: ${prefs.salaryMinQar ? `${prefs.salaryMinQar.toLocaleString()} ${t.common.qar}` : t.ob.status.salaryAny}`}>
          <input type="range" min={0} max={40000} step={500} value={prefs.salaryMinQar} onChange={(e) => setPrefs({ salaryMinQar: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
        </Field>
        <Field label={`${t.ob.finish.minScore}: ${prefs.minScore}%`}>
          <input type="range" min={30} max={90} step={5} value={prefs.minScore} onChange={(e) => setPrefs({ minScore: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
        </Field>
        <Field label={lang === 'ar' ? 'استبعد الوظائف التي تحتوي على' : 'Exclude jobs containing'}>
          <TagInput value={prefs.excludeKeywords} onChange={(v) => setPrefs({ excludeKeywords: v })} placeholder={lang === 'ar' ? 'مثال: مبيعات ميدانية' : 'e.g. field sales'} />
        </Field>
      </div>
    ),
    experience: (
      <div key="experience" className="space-y-4">
        <SectionTitle>{t.profile.experience}</SectionTitle>
        <AnimatePresence initial={false}>
          {p.experience.map((e, i) => {
            const upd = (x: Partial<typeof e>) => setProfile({ experience: p.experience.map((y, j) => (j === i ? { ...y, ...x } : y)) });
            return (
              <motion.div key={i} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, height: 0 }} className="card space-y-3 p-4">
                <div className="flex gap-2">
                  <Input placeholder={t.profile.jobTitle} value={e.title} onChange={(ev) => upd({ title: ev.target.value })} />
                  <button onClick={() => setProfile({ experience: p.experience.filter((_, j) => j !== i) })} className="grid size-12 shrink-0 place-items-center rounded-2xl text-muted">
                    <Trash2 className="size-5" />
                  </button>
                </div>
                <Input placeholder={t.profile.company} value={e.company} onChange={(ev) => upd({ company: ev.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder={t.profile.start} value={e.start} onChange={(ev) => upd({ start: ev.target.value })} />
                  <Input placeholder={t.profile.end} value={e.end} onChange={(ev) => upd({ end: ev.target.value })} />
                </div>
                <TextArea rows={4} placeholder={t.profile.bullets} value={e.bullets.join('\n')} onChange={(ev) => upd({ bullets: ev.target.value.split('\n') })} />
              </motion.div>
            );
          })}
        </AnimatePresence>
        <Button variant="soft" className="w-full" icon={<Plus className="size-4" />} onClick={() => setProfile({ experience: [...p.experience, { title: '', company: '', start: '', end: '', bullets: [] }] })}>
          {t.profile.addExp}
        </Button>
      </div>
    ),
    education: (
      <div key="education" className="space-y-4">
        <SectionTitle>{t.profile.education}</SectionTitle>
        {p.education.map((e, i) => {
          const upd = (x: Partial<typeof e>) => setProfile({ education: p.education.map((y, j) => (j === i ? { ...y, ...x } : y)) });
          return (
            <div key={i} className="card space-y-3 p-4">
              <div className="flex gap-2">
                <Input placeholder={t.profile.degree} value={e.degree} onChange={(ev) => upd({ degree: ev.target.value })} />
                <button onClick={() => setProfile({ education: p.education.filter((_, j) => j !== i) })} className="grid size-12 shrink-0 place-items-center rounded-2xl text-muted">
                  <Trash2 className="size-5" />
                </button>
              </div>
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <Input placeholder={t.profile.school} value={e.school} onChange={(ev) => upd({ school: ev.target.value })} />
                <Input placeholder={t.profile.year} value={e.year} onChange={(ev) => upd({ year: ev.target.value })} />
              </div>
            </div>
          );
        })}
        <Button variant="soft" className="w-full" icon={<Plus className="size-4" />} onClick={() => setProfile({ education: [...p.education, { degree: '', school: '', year: '' }] })}>
          {t.profile.addEdu}
        </Button>
        <Field label={t.profile.certifications}>
          <TagInput value={p.certifications} onChange={(v) => setProfile({ certifications: v })} />
        </Field>
      </div>
    ),
    languages: (
      <div key="languages" className="space-y-3">
        <SectionTitle>{t.profile.languages}</SectionTitle>
        {p.languages.map((l, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder={t.profile.langName} value={l.name} onChange={(e) => setProfile({ languages: p.languages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <Input placeholder={t.profile.level} value={l.level} onChange={(e) => setProfile({ languages: p.languages.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)) })} />
            <button onClick={() => setProfile({ languages: p.languages.filter((_, j) => j !== i) })} className="grid size-12 shrink-0 place-items-center rounded-2xl text-muted">
              <Trash2 className="size-5" />
            </button>
          </div>
        ))}
        <Button variant="soft" className="w-full" icon={<Plus className="size-4" />} onClick={() => setProfile({ languages: [...p.languages, { name: '', level: '' }] })}>
          {t.common.add}
        </Button>
      </div>
    ),
  };

  return (
    <div className="min-h-full pb-16">
      <div className="glass sticky top-0 z-20 flex items-center justify-between border-b border-line px-3 pt-safe pb-2">
        <button onClick={close} className="grid size-11 place-items-center rounded-full">
          <Back className="size-5" />
        </button>
        <span className="font-semibold">{t.profile.edit}</span>
        <Button size="sm" onClick={close}>
          {t.common.done}
        </Button>
      </div>
      <div className="px-4">{sections.map((s) => blocks[s])}</div>
    </div>
  );
}
