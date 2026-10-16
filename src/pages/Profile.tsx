import { motion } from 'motion/react';
import { useEffect } from 'react';
import { CvActions, SuggestionList } from '../ui/Suggestions';
import { TracksCard } from '../ui/TracksCard';
import { ChipAccordion } from '../ui/ChipAccordion';
import { AiTools } from '../ui/AiTools';
import { localGaps, runProfileReview } from '../lib/profileReview';
import { CircleAlert, FileText, Sparkle, Target, ChevronLeft, ChevronRight, GraduationCap, Languages, Mail, MapPin, Pencil, Phone, Settings2, SlidersHorizontal, Award, BriefcaseBusiness } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { QATAR_CITIES } from '../core/qatar';

export default function ProfilePage() {
  const { t, lang } = useT();
  const p = useStore((s) => s.profile);
  const gaps = localGaps(p);

  // First visit after a CV and an AI key are both available: compare them once automatically.
  useEffect(() => {
    const { settings, reviewedAt, reviewing, profile } = useStore.getState();
    if (settings.apiKey && !reviewedAt && !reviewing && profile.cvText.trim().length > 80) void runProfileReview().catch(() => undefined);
  }, []);
  const push = useNav((s) => s.push);
  const city = QATAR_CITIES.find((c) => c.id === p.city);
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight;
  const initials = p.fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase());
  const rows = [
    { icon: SlidersHorizontal, label: t.profile.preferences, section: 'prefs', value: [...p.prefs.jobTypes.map((j) => t.jobType[j]), ...p.prefs.workplaces.map((w) => t.workplace[w])].join(' · ') },
    { icon: BriefcaseBusiness, label: t.profile.experience, section: 'experience', value: `${p.experience.length}` },
    { icon: GraduationCap, label: t.profile.education, section: 'education', value: `${p.education.length}` },
    { icon: Award, label: t.profile.certifications, section: 'education', value: `${p.certifications.length}` },
    { icon: Languages, label: t.profile.languages, section: 'languages', value: p.languages.map((l) => l.name).join('، ') },
  ];
  return (
    <div>
      <header className="relative">
        <div className="noise relative bg-gradient-to-br from-accent to-[#4a0a1e] px-3 pb-[7.5rem] pt-safe text-white">
          <div className="flex items-center justify-between py-2">
            <span className="size-10" />
            <h2 className="font-display text-lg font-semibold">{t.profile.title}</h2>
            <button onClick={() => push({ name: 'settings' })} className="grid size-10 place-items-center rounded-full bg-white/15" aria-label={t.settings.title}>
              <Settings2 className="size-5" />
            </button>
          </div>
        </div>
        <div className="relative -mt-14 flex flex-col items-center rounded-t-[28px] bg-bg px-5 pb-6 pt-16 text-center">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute -top-12 left-1/2 size-24 -translate-x-1/2 overflow-hidden rounded-full border-4 border-bg bg-gradient-to-br from-accent to-[#4a0a1e] shadow-[0_16px_32px_-14px_var(--glow)]">
            {initials.length ? (
              // Each letter in its own span so Arabic initials do not join into one word.
              <span dir="ltr" className="flex size-full items-center justify-center gap-0.5 text-[2rem] font-bold text-[#f3dcae]">
                {(/[\u0600-\u06FF]/.test(initials.join('')) ? [...initials].reverse() : initials).map((c, i) => (
                  <span key={i}>{c}</span>
                ))}
              </span>
            ) : (
              <svg viewBox="0 0 96 96" className="size-full" aria-hidden>
                <circle cx="48" cy="38" r="17" fill="#f3dcae" />
                <path d="M14 96c2-20 16-32 34-32s32 12 34 32z" fill="#f3dcae" />
              </svg>
            )}
          </motion.div>
          <h1 className="font-display text-2xl font-bold">{p.fullName || '—'}</h1>
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
        <AiTools />
        <div className="card space-y-3 p-4">
          <h3 className="flex items-center gap-2 text-[14.5px] font-bold">
            <FileText className="size-4 text-gold" />
            {t.suggest.cvTitle}
          </h3>
          <CvActions />
        </div>
        <TracksCard />
        <SuggestionList />
        {gaps.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-2 text-[14.5px] font-bold">{t.suggest.gapsTitle}</h3>
            <ul className="divide-y divide-[var(--line)]">
              {gaps.map((g) => (
                <li key={g.key} className="flex items-center gap-3 py-2.5">
                  <CircleAlert className="size-4 shrink-0 text-warn" />
                  <span className="min-w-0 flex-1 text-[13.5px] leading-relaxed">{t.suggest.gaps[g.key]}</span>
                  {g.key !== 'cv' && (
                    <button onClick={() => push({ name: 'editProfile', section: g.section })} className="shrink-0 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent">
                      {t.suggest.fix}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <ChipAccordion title={t.ob.goals.titles} icon={<Target className="size-4" />} items={p.targetTitles} tone="accent" />
        <ChipAccordion title={t.ob.goals.skills} icon={<Sparkle className="size-4" />} items={p.skills} />
        <div className="card divide-y divide-[var(--line)] overflow-hidden">
          {rows.map(({ icon: Icon, label, section, value }) => (
            <button key={label} onClick={() => push({ name: 'editProfile', section })} className="flex w-full items-center gap-3 px-4 py-4 text-start active:bg-surface-2">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold">
                <Icon className="size-5 shrink-0" />
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
              <span className="max-w-[38%] shrink truncate text-[13px] text-muted">{value}</span>
              <Chevron className="size-4 shrink-0 text-muted" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
