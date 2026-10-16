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

const NOTIFIED_KEY = 'jf-notified';

/** Job ids already announced, so the same jobs never trigger a second notification. */
function notified(): string[] {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/** Announces prepared applications, once per job; nothing is sent when every job was announced before. */
export async function notifyReady(jobIds: string[]): Promise<void> {
  const before = new Set(notified());
  const fresh = jobIds.filter((id) => !before.has(id));
  if (!fresh.length) return;
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...before, ...fresh].slice(-800)));
  } catch {
    /* storage unavailable */
  }
  const count = fresh.length;
  const ar = useStore.getState().settings.uiLang === 'ar';
  const title = ar ? `✨ ${count} وظائف جاهزة للمراجعة` : `✨ ${count} applications ready to review`;
  const body = ar ? 'جهّزنا لك السيرة الذاتية وخطاب التقديم. راجعها واضغط إرسال.' : 'Your tailored CV and cover letter are ready. Review and tap send.';
  try {
    if (isNative) {
      // A fixed id replaces an older "ready" notification instead of stacking another one.
      await LocalNotifications.schedule({ notifications: [{ id: 4243, title, body, extra: { route: '/inbox' }, smallIcon: 'ic_stat_notify', largeIcon: 'ic_notify_large' }] });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon-192.png' });
    }
  } catch {
    /* notifications are best effort */
  }
}

/** Announces freelance projects with a ready proposal, once per project. */
export async function notifyGigs(gigIds: string[]): Promise<void> {
  const before = new Set(notified());
  const fresh = gigIds.filter((id) => !before.has(id));
  if (!fresh.length) return;
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...before, ...fresh].slice(-800)));
  } catch {
    /* storage unavailable */
  }
  const ar = useStore.getState().settings.uiLang === 'ar';
  const title = ar ? `💻 ${fresh.length} مشاريع عمل حر بعروض جاهزة` : `💻 ${fresh.length} freelance projects with proposals ready`;
  const body = ar ? 'كتبنا العرض والسعر والمدة. راجعها وقدّم قبل أن تكثر العروض.' : 'Proposal, price and timeline are written. Review and bid before the competition piles up.';
  try {
    if (isNative) {
      await LocalNotifications.schedule({ notifications: [{ id: 4246, title, body, extra: { route: '/freelance' }, smallIcon: 'ic_stat_notify', largeIcon: 'ic_notify_large' }] });
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
    await LocalNotifications.schedule({ notifications: [{ id: 777, title, body, smallIcon: 'ic_stat_notify', largeIcon: 'ic_notify_large', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }] });
  } else {
    new Notification(title, { body });
  }
  return true;
}
