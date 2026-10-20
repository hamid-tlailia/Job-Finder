import { registerPlugin } from '@capacitor/core';

export interface ComposerPlugin {
  email(o: { to: string; subject: string; body: string; attachments: string[] }): Promise<void>;
  whatsapp(o: { phone: string; text: string; attachments: string[] }): Promise<{ opened: boolean }>;
  batteryStatus(): Promise<{ ignoring: boolean }>;
  requestBatteryExemption(): Promise<void>;
  openAutostart(): Promise<{ vendor: boolean }>;
  applyWeb(o: { url: string; cv: string; letter: string; lang: 'ar' | 'en' }): Promise<void>;
}

/** Native Android intents (see android/.../ComposerPlugin.java): email and WhatsApp with PDF attachments. */
export const Composer = registerPlugin<ComposerPlugin>('Composer');
