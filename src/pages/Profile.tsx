import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, GraduationCap, Languages, Mail, MapPin, Pencil, Phone, Settings2, SlidersHorizontal, Award, BriefcaseBusiness } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { QATAR_CITIES } from '../core/qatar';

export default function ProfilePage() {
  const { t, lang } = useT();
  const p = useStore((s) => s.profile);
  const push = useNav((s) => s.push);
  const city = QATAR_CITIES.find((c) => c.id === p.city);
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight;
  const initials = p.fullName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  const rows = [
    { icon: SlidersHorizontal, label: t.profile.preferences, section: 'prefs', value: [...p.prefs.jobTypes.map((j) => t.jobType[j]), ...p.prefs.workplaces.map((w) => t.workplace[w])].join(' · ') },
    { icon: BriefcaseBusiness, label: t.profile.experience, section: 'experience', value: `${p.experience.length}` },
    { icon: GraduationCap, label: t.profile.education, section: 'education', value: `${p.education.length}` },
    { icon: Award, label: t.profile.certifications, section: 'education', value: `${p.certifications.length}` },
    { icon: Languages, label: t.profile.languages, section: 'languages', value: p.languages.map((l) => l.name).join('، ') },
  ];
  return (
    <div>
      <header className="hero-bg noise relative px-5 pt-safe pb-7">
        <div className="flex justify-end py-2">
          <button onClick={() => push({ name: 'settings' })} className="grid size-10 place-items-center rounded-full border border-line bg-surface/70">
            <Settings2 className="size-5" />
          </button>
        </div>
        <div className="flex flex-col items-center text-center">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid size-24 place-items-center rounded-[2rem] bg-gradient-to-br from-accent to-[#4a0a1e] text-3xl font-bold text-[#f3dcae] shadow-[0_20px_40px_-15px_var(--glow)]">
            {initials || '✦'}
          </motion.div>
          <h1 className="font-display mt-4 text-2xl font-bold">{p.fullName || '—'}</h1>
          <p className="mt-1 font-medium text-accent">{p.headline}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] text-muted">
            {city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {lang === 'ar' ? city.ar : city.en}
              </span>
            )}
            {p.phone && (
              <span className="inline-flex items-center gap-1" dir="ltr">
                <Phone className="size-3.5" />
                {p.phone}
              </span>
            )}
            {p.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3.5" />
                {p.email}
              </span>
            )}
          </div>
          <button onClick={() => push({ name: 'editProfile', section: 'basics' })} className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold">
            <Pencil className="size-4" />
            {t.profile.edit}
          </button>
        </div>
      </header>
      <div className="space-y-4 px-4 pt-2">
        <div className="card p-4">
          <div className="mb-2 text-[13px] font-semibold text-muted">{t.ob.goals.titles}</div>
          <div className="flex flex-wrap gap-1.5">
            {p.targetTitles.map((x) => (
              <span key={x} className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent">
                {x}
              </span>
            ))}
          </div>
          <div className="mb-2 mt-4 text-[13px] font-semibold text-muted">{t.ob.goals.skills}</div>
          <div className="flex flex-wrap gap-1.5">
            {p.skills.map((x) => (
              <span key={x} className="rounded-full bg-surface-2 px-3 py-1 text-[13px]">
                {x}
              </span>
            ))}
          </div>
        </div>
        <div className="card divide-y divide-[var(--line)] overflow-hidden">
          {rows.map(({ icon: Icon, label, section, value }) => (
            <button key={label} onClick={() => push({ name: 'editProfile', section })} className="flex w-full items-center gap-3 px-4 py-4 text-start active:bg-surface-2">
              <span className="grid size-9 place-items-center rounded-xl bg-gold-soft text-gold">
                <Icon className="size-[18px]" />
              </span>
              <span className="flex-1 font-semibold">{label}</span>
              <span className="max-w-[45%] truncate text-[13px] text-muted">{value}</span>
              <Chevron className="size-4 text-muted" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
