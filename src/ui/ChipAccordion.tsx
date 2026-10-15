import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { spring } from './kit';

/**
 * A titled list of chips that shows the first rows (up to `preview` items) and expands to all.
 * All chips stay rendered; only the clipping height animates, so opening and closing are one smooth motion.
 */
export function ChipAccordion({ title, icon, items, tone = 'muted', preview = 3 }: { title: string; icon?: ReactNode; items: string[]; tone?: 'accent' | 'muted'; preview?: number }) {
  const { t, f } = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [h, setH] = useState({ collapsed: 0, full: 0, visible: preview });
  const extra = Math.max(0, items.length - h.visible);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const kids = el.children;
      const last = kids[Math.min(preview, kids.length) - 1] as HTMLElement | undefined;
      const collapsed = last ? last.offsetTop + last.offsetHeight : 0;
      // Chips sharing the last preview row are visible too; count them so "+N" is exact.
      const visible = Array.from(kids).filter((k) => (k as HTMLElement).offsetTop + (k as HTMLElement).offsetHeight <= collapsed + 1).length;
      setH({ collapsed, full: el.scrollHeight, visible });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items, preview]);

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
          <span className="flex items-center gap-2">
            {!open && <span className="text-[12px] font-semibold text-muted">{f(t.common.more, { n: extra })}</span>}
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} className="grid size-8 place-items-center rounded-full bg-surface-2 text-muted">
              <ChevronDown className="size-4" />
            </motion.span>
          </span>
        )}
      </button>
      <div className="px-4 pb-4">
        {items.length ? (
          <motion.div initial={false} animate={{ height: extra ? (open ? h.full : h.collapsed) : 'auto' }} transition={{ type: 'spring', stiffness: 320, damping: 36 }} className="overflow-hidden">
            <div ref={box} className="relative flex flex-wrap gap-1.5">
              {items.map((x) => (
                <span key={x} dir="auto" className={`max-w-full break-words rounded-xl px-3 py-1.5 text-[13px] leading-snug ${chip}`}>
                  {x}
                </span>
              ))}
            </div>
          </motion.div>
        ) : (
          <span className="text-[13px] text-muted">—</span>
        )}
      </div>
    </section>
  );
}
