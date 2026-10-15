import { registerPlugin } from '@capacitor/core';

export interface ComposerPlugin {
  email(o: { to: string; subject: string; body: string; attachments: string[] }): Promise<void>;
  whatsapp(o: { phone: string; text: string; attachments: string[] }): Promise<{ opened: boolean }>;
  batteryStatus(): Promise<{ ignoring: boolean }>;
  requestBatteryExemption(): Promise<void>;
}

/** Native Android intents (see android/.../ComposerPlugin.java): email and WhatsApp with PDF attachments. */
export const Composer = registerPlugin<ComposerPlugin>('Composer');
