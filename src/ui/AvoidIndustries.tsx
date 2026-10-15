import { EMPTY, useStore } from '../store/useStore';
import { useT } from '../i18n';
import { ChipGroup, Field } from './kit';
import { INDUSTRIES, type IndustryId } from '../core/industries';
import { syncBackground } from '../lib/background';

/** Multi-select of industries to keep out of the feed. */
export function AvoidIndustries() {
  const { t } = useT();
  const value = useStore((s) => s.profile.prefs.avoidIndustries ?? EMPTY) as IndustryId[];
  const setPrefs = useStore((s) => s.setPrefs);
  return (
    <Field label={t.industries.title} hint={t.industries.hint}>
      <ChipGroup<IndustryId>
        options={INDUSTRIES.map((i) => ({ id: i.id, label: t.industries[i.id] }))}
        value={value}
        onChange={(v) => {
          setPrefs({ avoidIndustries: v });
          useStore.getState().prune();
          void syncBackground();
        }}
      />
    </Field>
  );
}
