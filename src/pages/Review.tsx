import { AnimatePresence, motion } from 'motion/react';
import { Inbox } from 'lucide-react';
import { scoreOf, useStore } from '../store/useStore';
import { useT } from '../i18n';
import { Empty } from '../ui/kit';
import { JobCard } from '../ui/JobCard';

export default function Review() {
  const { t } = useT();
  const { matches, jobs } = useStore();
  const list = Object.values(matches)
    .filter((m) => (m.status === 'ready' || m.status === 'preparing') && jobs[m.jobId])
    .sort((a, b) => Number(a.seen) - Number(b.seen) || scoreOf(b) - scoreOf(a));
  return (
    <div className="px-4 pt-safe">
      <h1 className="font-display px-1 pb-1 pt-6 text-[1.85rem] font-bold">{t.review.title}</h1>
      <p className="px-1 pb-5 text-sm text-muted">{list.length > 0 ? `${list.length}` : ''}</p>
      {list.length === 0 ? (
        <Empty icon={<Inbox className="size-9" />} title={t.review.empty} body={t.review.emptyBody} />
      ) : (
        <motion.div layout className="space-y-3">
          <AnimatePresence>
            {list.map((m, i) => (
              <JobCard key={m.jobId} job={jobs[m.jobId]} match={m} index={i} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
