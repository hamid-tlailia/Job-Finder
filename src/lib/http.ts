import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { BROWSER_UA } from '../core/allowlist';

export type FetchInit = { method?: string; headers?: Record<string, string>; body?: string };

export const isNative = Capacitor.isNativePlatform();

export async function fetchText(url: string, init: FetchInit = {}): Promise<string> {
  if (isNative) {
    const res = await CapacitorHttp.request({
      url,
      method: init.method ?? 'GET',
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8', ...init.headers },
      data: init.body,
      responseType: 'text',
      connectTimeout: 15000,
      readTimeout: 20000,
    });
    if (res.status >= 400) throw new Error(`HTTP ${res.status} ${new URL(url).hostname}`);
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }
  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, ...init }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${new URL(url).hostname}`);
  return res.text();
}
