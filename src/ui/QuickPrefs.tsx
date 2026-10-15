import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { Button, ChipGroup, Field, Sheet } from './kit';
import type { DistancePref, JobType, Workplace } from '../core/types';
import { syncBackground } from '../lib/background';

/** Bottom sheet with the preferences people tweak most, reachable from the home header. */
export function QuickPrefs({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const prefs = useStore((s) => s.profile.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const opts = <T extends string>(o: Record<T, string>) => (Object.keys(o) as T[]).map((id) => ({ id, label: o[id] }));
  const close = () => {
    void syncBackground();
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title={t.home.quickPrefs}>
      <div className="space-y-6 pb-4">
        <Field label={`${t.ob.finish.minScore}: ${prefs.minScore}%`}>
          <input type="range" min={30} max={90} step={5} value={prefs.minScore} onChange={(e) => setPrefs({ minScore: Number(e.target.value) })} className="h-8 w-full accent-[var(--accent)]" />
        </Field>
        <Field label={`${t.ob.status.salary}: ${prefs.salaryMinQar ? `${prefs.salaryMinQar.toLocaleString()} ${t.common.qar}` : t.ob.status.salaryAny}`}>
          <input type="range" min={0} max={40000} step={500} value={prefs.salaryMinQar} onChange={(e) => setPrefs({ salaryMinQar: Number(e.target.value) })} className="h-8 w-full accent-[var(--accent)]" />
        </Field>
        <Field label={t.ob.type.jobType}>
          <ChipGroup<JobType> options={opts(t.jobType)} value={prefs.jobTypes} onChange={(v) => setPrefs({ jobTypes: v })} />
        </Field>
        <Field label={t.ob.type.workplace}>
          <ChipGroup<Workplace> options={opts(t.workplace)} value={prefs.workplaces} onChange={(v) => setPrefs({ workplaces: v })} />
        </Field>
        <Field label={t.ob.location.distance}>
          <ChipGroup<DistancePref> multi={false} options={opts(t.distance)} value={[prefs.distance]} onChange={(v) => setPrefs({ distance: v[0] })} />
        </Field>
        {prefs.distance === 'near' && (
          <Field label={`${t.ob.location.maxKm}: ${prefs.maxKm} ${t.common.km}`}>
            <input type="range" min={5} max={80} step={5} value={prefs.maxKm} onChange={(e) => setPrefs({ maxKm: Number(e.target.value) })} className="h-8 w-full accent-[var(--accent)]" />
          </Field>
        )}
        <Button size="lg" className="w-full" onClick={close}>
          {t.common.save}
        </Button>
      </div>
    </Sheet>
  );
}
