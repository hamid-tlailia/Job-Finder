import regularUrl from '../assets/fonts/IBMPlexSansArabic-Regular.ttf?url';
import boldUrl from '../assets/fonts/IBMPlexSansArabic-Bold.ttf?url';
import type { PdfFonts } from './pdf';

let cached: Promise<PdfFonts> | undefined;

async function b64(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function loadFonts(): Promise<PdfFonts> {
  cached ??= Promise.all([b64(regularUrl), b64(boldUrl)]).then(([regular, bold]) => ({ regular, bold }));
  return cached;
}
