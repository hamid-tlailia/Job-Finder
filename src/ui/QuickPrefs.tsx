import { useStore } from '../store/useStore';
import { useT } from '../i18n';
import { Button, ChipGroup, Field, Sheet, Slider } from './kit';
import type { DistancePref, JobType, Workplace } from '../core/types';
import { syncBackground } from '../lib/background';
import { MatchLevel } from './MatchLevel';

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
        <MatchLevel />
        <Field label={`${t.ob.status.salary}: ${prefs.salaryMinQar ? `${prefs.salaryMinQar.toLocaleString()} ${t.common.qar}` : t.ob.status.salaryAny}`}>
          <Slider min={0} max={40000} step={500} value={prefs.salaryMinQar} onChange={(v) => setPrefs({ salaryMinQar: v })} />
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
            <Slider min={5} max={80} step={5} value={prefs.maxKm} onChange={(v) => setPrefs({ maxKm: v })} />
          </Field>
        )}
        <Button size="lg" className="w-full" onClick={close}>
          {t.common.save}
        </Button>
      </div>
    </Sheet>
  );
}
