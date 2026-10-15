import { BedDouble, Building2, Car, Fuel, Headphones, HeartPulse, Palmtree, ShieldCheck, ShoppingCart, Sparkles, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { EMPTY, useStore } from '../store/useStore';
import { useT } from '../i18n';
import { Toggle } from './kit';
import { INDUSTRIES, type IndustryId } from '../core/industries';
import { syncBackground } from '../lib/background';

const ICONS: Record<IndustryId, LucideIcon> = {
  hotels: BedDouble,
  resorts: Palmtree,
  restaurants: UtensilsCrossed,
  construction: Building2,
  retail: ShoppingCart,
  healthcare: HeartPulse,
  callcenter: Headphones,
  security: ShieldCheck,
  cleaning: Sparkles,
  oilgas: Fuel,
  driving: Car,
};

/** One switch per field: on = willing to work there, off = its jobs are hidden. */
export function AvoidIndustries() {
  const { t } = useT();
  const avoid = useStore((s) => s.profile.prefs.avoidIndustries ?? EMPTY) as string[];
  const setPrefs = useStore((s) => s.setPrefs);
  const set = (id: IndustryId, allowed: boolean) => {
    setPrefs({ avoidIndustries: allowed ? avoid.filter((x) => x !== id) : [...avoid, id] });
    useStore.getState().prune();
    void syncBackground();
  };
  return (
    <div>
      <div className="mb-1 text-[13px] font-semibold text-muted">{t.industries.title}</div>
      <p className="mb-2 text-xs leading-relaxed text-muted">{t.industries.hint}</p>
      <div className="divide-y divide-[var(--line)] rounded-2xl border border-line bg-surface px-3">
        {INDUSTRIES.map((i) => {
          const Icon = ICONS[i.id];
          const on = !avoid.includes(i.id);
          return (
            <Toggle
              key={i.id}
              checked={on}
              onChange={(v) => set(i.id, v)}
              label={
                <span className={`flex items-center gap-2.5 ${on ? '' : 'text-muted'}`}>
                  <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${on ? 'bg-gold-soft text-gold' : 'bg-surface-2 text-muted'}`}>
                    <Icon className="size-4" />
                  </span>
                  {t.industries[i.id]}
                </span>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
