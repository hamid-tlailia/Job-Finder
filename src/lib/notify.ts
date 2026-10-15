import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './http';
import { useStore } from '../store/useStore';

export async function ensureNotifyPermission(): Promise<boolean> {
  if (isNative) {
    const p = await LocalNotifications.checkPermissions();
    if (p.display === 'granted') return true;
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  }
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

export async function notifyReady(count: number): Promise<void> {
  const ar = useStore.getState().settings.uiLang === 'ar';
  const title = ar ? `✨ ${count} وظائف جاهزة للمراجعة` : `✨ ${count} applications ready to review`;
  const body = ar ? 'جهّزنا لك السيرة الذاتية وخطاب التقديم. راجعها واضغط إرسال.' : 'Your tailored CV and cover letter are ready. Review and tap send.';
  try {
    if (isNative) {
      await LocalNotifications.schedule({ notifications: [{ id: Date.now() % 2147483647, title, body, extra: { route: '/inbox' }, smallIcon: 'ic_stat_notify' }] });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon-192.png' });
    }
  } catch {
    /* notifications are best effort */
  }
}

export function onNotificationTap(cb: (route: string) => void): void {
  if (!isNative) return;
  void LocalNotifications.addListener('localNotificationActionPerformed', (e) => cb((e.notification.extra?.route as string) ?? '/inbox'));
}

export async function testNotification(): Promise<boolean> {
  if (!(await ensureNotifyPermission())) return false;
  const ar = useStore.getState().settings.uiLang === 'ar';
  const title = ar ? '🔔 الإشعارات تعمل' : '🔔 Notifications work';
  const body = ar ? 'ستصلك تنبيهات الوظائف الجديدة هنا حتى والتطبيق مغلق.' : 'New-job alerts will arrive here even when the app is closed.';
  if (isNative) {
    // Scheduled a few seconds ahead so it can be seen after leaving the app.
    await LocalNotifications.schedule({ notifications: [{ id: 777, title, body, smallIcon: 'ic_stat_notify', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }] });
  } else {
    new Notification(title, { body });
  }
  return true;
}
