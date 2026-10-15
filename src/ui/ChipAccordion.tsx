import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useT } from '../i18n';

/** A titled list of chips that shows the first few and expands to show all. */
export function ChipAccordion({ title, icon, items, tone = 'muted', preview = 3 }: { title: string; icon?: ReactNode; items: string[]; tone?: 'accent' | 'muted'; preview?: number }) {
  const { t, f } = useT();
  const [open, setOpen] = useState(false);
  const extra = Math.max(0, items.length - preview);
  const shown = open ? items : items.slice(0, preview);
  const chip = tone === 'accent' ? 'bg-accent-soft font-semibold text-accent' : 'bg-surface-2';
  return (
    <section className="card overflow-hidden">
      <button type="button" onClick={() => extra && setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-4 pb-2 pt-4 text-start">
        <span className="flex items-center gap-2 text-[14.5px] font-bold">
          {icon && <span className="text-gold">{icon}</span>}
          {title}
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted">{items.length}</span>
        </span>
        {extra > 0 && (
          <motion.span animate={{ rotate: open ? 180 : 0 }} className="grid size-8 place-items-center rounded-full bg-surface-2 text-muted">
            <ChevronDown className="size-4" />
          </motion.span>
        )}
      </button>
      <motion.div layout className="flex flex-wrap gap-1.5 px-4 pb-4">
        <AnimatePresence initial={false}>
          {shown.map((x) => (
            <motion.span key={x} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} dir="auto" className={`max-w-full break-words rounded-xl px-3 py-1.5 text-[13px] leading-snug ${chip}`}>
              {x}
            </motion.span>
          ))}
        </AnimatePresence>
        {!items.length && <span className="text-[13px] text-muted">—</span>}
        {!open && extra > 0 && (
          <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-dashed border-line px-3 py-1.5 text-[12.5px] font-semibold text-muted">
            {f(t.common.more, { n: extra })}
          </button>
        )}
      </motion.div>
    </section>
  );
}
