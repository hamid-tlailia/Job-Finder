import { useStore } from '../store/useStore';
import { ar, en, type Dict } from './dict';

export function useT(): { t: Dict; lang: 'ar' | 'en'; f: (s: string, v: Record<string, string | number>) => string; ago: (iso?: string) => string } {
  const lang = useStore((s) => s.settings.uiLang);
  const t = lang === 'ar' ? ar : en;
  const f = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));
  const ago = (iso?: string) => {
    if (!iso) return '';
    const mins = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return t.time.now;
    if (mins < 60) return f(t.time.m, { n: Math.round(mins) });
    if (mins < 1440) return f(t.time.h, { n: Math.round(mins / 60) });
    return f(t.time.d, { n: Math.round(mins / 1440) });
  };
  return { t, lang, f, ago };
}
