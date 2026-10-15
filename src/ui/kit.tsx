import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { Check, Loader2, X } from 'lucide-react';
import { isValidElement, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { haptic } from './haptics';

export const spring = { type: 'spring', stiffness: 420, damping: 34 } as const;
export const softSpring = { type: 'spring', stiffness: 220, damping: 26 } as const;

type BtnVariant = 'primary' | 'gold' | 'ghost' | 'outline' | 'soft';

export function Button({ variant = 'primary', loading, icon, children, className = '', size = 'md', ...rest }: HTMLMotionProps<'button'> & { variant?: BtnVariant; loading?: boolean; icon?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-accent text-white shadow-[0_10px_30px_-10px_var(--glow)]',
    gold: 'bg-gradient-to-br from-[#e7cc95] via-gold to-[#9b7743] text-[#2a1a10] shadow-[0_10px_30px_-12px_rgba(176,141,87,.6)]',
    ghost: 'text-ink hover:bg-surface-2',
    outline: 'border border-line text-ink bg-surface',
    soft: 'bg-accent-soft text-accent',
  };
  const s = { sm: 'h-9 px-3.5 text-[13px] rounded-xl', md: 'h-12 px-5 text-[15px] rounded-2xl', lg: 'h-14 px-6 text-base rounded-2xl' }[size];
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={spring}
      onPointerDown={() => haptic()}
      className={`relative inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 ${v[variant]} ${s} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children as ReactNode}
    </motion.button>
  );
}

export function Chip({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={() => {
        haptic();
        onClick();
      }}
      className={`relative inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink'}`}
    >
      <AnimatePresence initial={false}>
        {active && (
          <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 16, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="overflow-hidden">
            <Check className="size-4" />
          </motion.span>
        )}
      </AnimatePresence>
      {icon}
      {children}
    </motion.button>
  );
}

export function ChipGroup<T extends string>({ options, value, onChange, multi = true }: { options: { id: T; label: string; icon?: ReactNode; disabled?: boolean }[]; value: T[]; onChange: (v: T[]) => void; multi?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip
          key={o.id}
          icon={o.icon}
          active={value.includes(o.id)}
          onClick={() => {
            if (o.disabled) return;
            if (!multi) return onChange([o.id]);
            onChange(value.includes(o.id) ? value.filter((x) => x !== o.id) : [...value, o.id]);
          }}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  // One indicator that slides horizontally by index; a shared-layout animation would
  // mis-measure inside scrolled screens and fly in from below.
  const ref = useRef<HTMLDivElement>(null);
  const [rtl, setRtl] = useState(false);
  useLayoutEffect(() => {
    if (ref.current) setRtl(getComputedStyle(ref.current).direction === 'rtl');
  });
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  const n = options.length;
  return (
    <div ref={ref} className="relative flex rounded-2xl border border-line bg-surface-2 p-1">
      <motion.span
        aria-hidden
        className="absolute bottom-1 top-1 rounded-xl bg-surface shadow-sm"
        style={{ width: `calc((100% - 8px) / ${n})`, insetInlineStart: 4 }}
        initial={false}
        animate={{ x: `${(rtl ? -1 : 1) * index * 100}%` }}
        transition={spring}
      />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => {
            haptic();
            onChange(o.id);
          }}
          className={`relative z-10 flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-1.5 py-1.5 text-center text-[13.5px] font-semibold leading-tight transition-colors ${value === o.id ? 'text-ink' : 'text-muted'}`}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic();
        onChange(!checked);
      }}
      className="flex w-full items-center justify-between gap-4 py-3 text-start"
    >
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-2 border border-line'}`}>
        <motion.span layout transition={spring} className="absolute top-1 size-5 rounded-full bg-white shadow" style={{ insetInlineStart: checked ? 24 : 4 }} />
      </span>
    </button>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  // A <label> around a group of buttons would forward taps on the caption to the first button.
  const single = isValidElement(children) && [Input, TextArea, Select].includes(children.type as never);
  const Tag = single ? 'label' : 'div';
  return (
    <Tag className="block" role={single ? undefined : 'group'}>
      <span className="mb-1.5 block text-[13px] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </Tag>
  );
}

const inputCls = 'w-full rounded-2xl border border-line bg-surface px-4 text-[15px] text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-[var(--accent-soft)] placeholder:text-muted/70';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-12 ${inputCls} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`py-3 leading-relaxed ${inputCls} ${props.className ?? ''}`} />;
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={`h-12 appearance-none ${inputCls}`}>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TagInput({ value, onChange, placeholder, suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    onChange([...new Set([...value, ...parts])]);
    setDraft('');
  };
  const sug = suggestions.filter((s) => !value.includes(s)).slice(0, 8);
  return (
    <div>
      <div className={`flex min-h-12 flex-wrap items-center gap-1.5 p-2 ${inputCls}`}>
        <AnimatePresence initial={false}>
          {value.map((v) => (
            <motion.span key={v} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="inline-flex h-8 items-center gap-1 rounded-full bg-accent-soft ps-3 pe-1.5 text-sm font-medium text-accent">
              {v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="grid size-5 place-items-center rounded-full hover:bg-accent/15">
                <X className="size-3.5" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          value={draft}
          onChange={(e) => (/[,،]$/.test(e.target.value) ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? '' : placeholder}
          enterKeyHint="done"
          className="h-8 min-w-[8rem] flex-1 bg-transparent px-2 outline-none placeholder:text-muted/70"
        />
      </div>
      {sug.length > 0 && (
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
          {sug.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="h-8 shrink-0 rounded-full border border-dashed border-line px-3 text-[13px] text-muted">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScoreRing({ score, size = 56, stroke = 5, label }: { score: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? 'var(--ok)' : score >= 60 ? 'var(--gold)' : score >= 40 ? 'var(--warn)' : 'var(--muted)';
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <span className="font-bold tabular-nums" style={{ fontSize: size * 0.3 }}>
          {score}
          <span style={{ fontSize: size * 0.16 }}>%</span>
        </span>
        {label && <span className="-mt-1 text-[9px] uppercase tracking-wide text-muted">{label}</span>}
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="pb-safe fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-[2rem] border-t border-line bg-surface px-5 pt-3"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={softSpring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => i.offset.y > 120 && onClose()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
            {title && <h3 className="font-display mb-4 text-xl font-semibold">{title}</h3>}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

let pushToast: ((m: string) => void) | undefined;
export function toast(m: string): void {
  pushToast?.(m);
}

export function Toaster() {
  const [items, setItems] = useState<{ id: number; m: string }[]>([]);
  useEffect(() => {
    pushToast = (m) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, m }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3400);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-safe">
      <AnimatePresence>
        {items.map((i) => (
          <motion.div key={i.id} initial={{ y: -30, opacity: 0, scale: 0.95 }} animate={{ y: 8, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0 }} transition={spring} className="glass max-w-md rounded-2xl border border-line px-4 py-3 text-sm font-medium shadow-xl">
            {i.m}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center px-8 py-14 text-center">
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="mb-5 grid size-20 place-items-center rounded-[1.75rem] bg-gradient-to-br from-accent-soft to-gold-soft text-accent">
        {icon}
      </motion.div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}

export function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lg-m" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a51d47" />
          <stop offset="1" stopColor="#5e0b25" />
        </linearGradient>
        <linearGradient id="lg-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3dcae" />
          <stop offset="1" stopColor="#b08d57" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#lg-m)" />
      <path d="M18 14h3l3.5 4.5L28 14l3.5 4.5L35 14l3.5 4.5L42 14h4" stroke="url(#lg-g)" strokeWidth="2" fill="none" opacity=".55" />
      <circle cx="29" cy="33" r="11" stroke="url(#lg-g)" strokeWidth="4.5" fill="none" />
      <path d="M37.5 41.5 47 51" stroke="url(#lg-g)" strokeWidth="5" strokeLinecap="round" />
      <path d="m24.5 33 3.2 3.2 6-6.4" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between px-1">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function CompanyAvatar({ name, logo, size = 46 }: { name: string; logo?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = (name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-surface-2 font-bold text-accent" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {logo && !broken ? <img src={logo} alt="" className="size-full object-contain p-1.5" onError={() => setBroken(true)} loading="lazy" /> : initials}
    </div>
  );
}
