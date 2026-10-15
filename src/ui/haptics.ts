import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export function haptic(style: ImpactStyle = ImpactStyle.Light): void {
  if (Capacitor.isNativePlatform()) void Haptics.impact({ style }).catch(() => undefined);
}
