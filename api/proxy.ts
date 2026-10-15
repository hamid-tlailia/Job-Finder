import { BROWSER_UA, isAllowed } from '../src/core/allowlist';

export const config = { runtime: 'edge' };

/** Forwards job-board requests for the web build, which cannot call those hosts directly (CORS). */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const { url, method, headers, body } = (await req.json()) as { url: string; method?: string; headers?: Record<string, string>; body?: string };
  if (!isAllowed(url)) return new Response('Host not allowed', { status: 403 });
  const upstream = await fetch(url, {
    method: method ?? 'GET',
    headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8', ...(headers ?? {}) },
    body,
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'text/plain', 'Cache-Control': 's-maxage=600' },
  });
}
