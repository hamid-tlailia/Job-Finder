/** Hosts the web build may reach through /api/proxy (the Android build calls them natively). */
export const PROXY_HOSTS = [
  'www.linkedin.com',
  'jobs.workable.com',
  'qatar.tanqeeb.com',
  'api.smartrecruiters.com',
  'himalayas.app',
  'remotive.com',
  'jooble.org',
  'serpapi.com',
  'mostaql.com',
  'www.freelancer.com',
  'remoteok.com',
];

export const BROWSER_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';

export function isAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && PROXY_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}
