import { motion } from 'motion/react';
import { Bookmark, Clock, Loader2, MapPin, Send, Sparkles } from 'lucide-react';
import type { Job, MatchRecord } from '../core/types';
import { CompanyAvatar, ScoreRing } from './kit';
import { useT } from '../i18n';
import { useNav } from './nav';
import { scoreOf, useStore } from '../store/useStore';
import { QATAR_CITIES } from '../core/qatar';

export function JobCard({ job, match, index = 0 }: { job: Job; match: MatchRecord; index?: number }) {
  const { t, lang, ago } = useT();
  const push = useNav((s) => s.push);
  const score = scoreOf(match, job);
  const track = useStore((s) => ((s.profile.tracks ?? []).length > 1 ? s.profile.tracks.find((x) => x.id === match.trackId) : undefined));
  const city = QATAR_CITIES.find((c) => c.id === job.city);
  const where = city ? (lang === 'ar' ? city.ar : city.en) : job.location;
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index, 5) * 0.025, type: 'spring', stiffness: 380, damping: 30 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => push({ name: 'job', id: job.id })}
      className="card relative w-full overflow-hidden p-4 text-start"
    >
      {match.status === 'ready' && !match.seen && <span className="absolute inset-y-0 start-0 w-1 bg-gradient-to-b from-gold to-accent" />}
      <div className="flex gap-3.5">
        <CompanyAvatar name={job.company || job.title} logo={job.logo} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15.5px] font-bold leading-snug">{job.title}</h3>
          <p className="mt-0.5 truncate text-[13px] font-medium text-muted">{job.company || job.sourceLabel}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              <span className="max-w-[9rem] truncate">{where}</span>
            </span>
            {job.employmentType && <span>{t.jobType[job.employmentType as keyof typeof t.jobType] ?? job.employmentType}</span>}
            {job.postedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {ago(job.postedAt)}
              </span>
            )}
          </div>
        </div>
        <ScoreRing score={score} size={52} />
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {track && <span className="shrink-0 rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-bold text-gold">{track.name}</span>}
          <span className="truncate rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted">{job.sourceLabel}</span>
        </span>
        {match.status === 'ready' && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-bold text-gold">
            <Send className="size-3" />
            {t.card.readyBadge}
          </span>
        )}
        {match.status === 'preparing' && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent">
            <Loader2 className="size-3 animate-spin" />
            {t.card.preparing}
          </span>
        )}
        {match.status === 'saved' && <Bookmark className="size-4 fill-gold text-gold" />}
        {match.analysis?.by === 'ai' && match.status === 'new' && <Sparkles className="size-4 text-gold" />}
      </div>
    </motion.button>
  );
}
