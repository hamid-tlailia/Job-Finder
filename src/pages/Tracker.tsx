import { motion } from 'motion/react';
import { Briefcase } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { CompanyAvatar, Empty } from '../ui/kit';
import { useNav } from '../ui/nav';
import type { MatchStatus } from '../core/types';

const STAGES: MatchStatus[] = ['applied', 'interview', 'offer', 'rejected'];
const COLORS: Record<string, string> = { applied: 'bg-accent-soft text-accent', interview: 'bg-gold-soft text-gold', offer: 'bg-ok/15 text-ok', rejected: 'bg-surface-2 text-muted' };

export default function Tracker() {
  const { t, f, ago } = useT();
  const { matches, jobs, setStatus } = useStore();
  const push = useNav((s) => s.push);
  const list = Object.values(matches)
    .filter((m) => STAGES.includes(m.status) && jobs[m.jobId])
    .sort((a, b) => (b.appliedAt ?? b.updatedAt).localeCompare(a.appliedAt ?? a.updatedAt));

  return (
    <div className="px-4 pt-safe">
      <h1 className="font-display px-1 pb-5 pt-6 text-[1.85rem] font-bold">{t.tracker.title}</h1>
      {list.length > 0 && (
        <div className="mb-5 grid grid-cols-4 gap-2">
          {STAGES.map((s) => (
            <div key={s} className={`rounded-2xl px-2 py-3 text-center ${COLORS[s]}`}>
              <div className="text-xl font-extrabold tabular-nums">{list.filter((m) => m.status === s).length}</div>
              <div className="text-[11px] font-semibold">{t.tracker.status[s as keyof typeof t.tracker.status]}</div>
            </div>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <Empty icon={<Briefcase className="size-9" />} title={t.tracker.empty} body={t.tracker.emptyBody} />
      ) : (
        <div className="space-y-3">
          {list.map((m, i) => {
            const job = jobs[m.jobId];
            return (
              <motion.div key={m.jobId} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="card p-4">
                <button onClick={() => push({ name: 'job', id: job.id })} className="flex w-full items-center gap-3 text-start">
                  <CompanyAvatar name={job.company || job.title} logo={job.logo} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{job.title}</div>
                    <div className="truncate text-[13px] text-muted">{job.company}</div>
                    <div className="mt-0.5 text-[11.5px] text-muted">{f(t.tracker.appliedOn, { time: ago(m.appliedAt), via: m.appliedVia ? t.job[m.appliedVia] : '—' })}</div>
                  </div>
                </button>
                <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
                  {STAGES.map((s) => (
                    <button key={s} onClick={() => setStatus(m.jobId, s)} className={`relative h-8 shrink-0 rounded-full px-3 text-xs font-semibold ${m.status === s ? COLORS[s] : 'border border-line text-muted'}`}>
                      {t.tracker.status[s as keyof typeof t.tracker.status]}
                    </button>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
