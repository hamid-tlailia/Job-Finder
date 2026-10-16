import { AnimatePresence, motion } from 'motion/react';
import { Compass, Inbox } from 'lucide-react';
import { useNav } from '../ui/nav';
import { listable } from '../core/sources/util';
import { prepareThreshold } from '../core/match';
import { scoreOf, useStore } from '../store/useStore';
import { useT } from '../i18n';
import { Button, Empty } from '../ui/kit';
import { JobCard } from '../ui/JobCard';

export default function Review() {
  const { t, f } = useT();
  const { matches, jobs } = useStore();
  const minScore = useStore((s) => prepareThreshold(s.profile.prefs, 'ai'));
  const setTab = useNav((s) => s.setTab);
  const below = Object.values(matches).filter((m) => m.status === 'new' && jobs[m.jobId] && listable([jobs[m.jobId]]).length > 0).length;
  const list = Object.values(matches)
    .filter((m) => (m.status === 'ready' || m.status === 'preparing') && jobs[m.jobId])
    .sort((a, b) => scoreOf(b, jobs[b.jobId]) - scoreOf(a, jobs[a.jobId])); // best fit first
  return (
    <div className="px-4 pt-safe">
      <div className="flex items-center gap-3 px-1 pb-5 pt-6">
        <h1 className="font-display text-[1.85rem] font-bold">{t.review.title}</h1>
        {list.length > 0 && (
          <span className="grid h-8 min-w-8 place-items-center rounded-full bg-accent px-2.5 text-[14px] font-bold tabular-nums text-white shadow-[0_6px_16px_-8px_var(--glow)]">{list.length}</span>
        )}
      </div>
      {list.length === 0 ? (
        <Empty
          icon={<Inbox className="size-9" />}
          title={t.review.empty}
          body={below > 0 ? f(t.review.below, { n: below, min: minScore }) : t.review.emptyBody}
          action={
            below > 0 ? (
              <Button onClick={() => setTab('home')} icon={<Compass className="size-4" />}>
                {t.review.seeNew}
              </Button>
            ) : undefined
          }
        />
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
