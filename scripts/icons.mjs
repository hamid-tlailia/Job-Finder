import { createRequire } from 'node:module'; const sharp = createRequire(import.meta.url)('sharp');
import { mkdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const res = `${root}/android/app/src/main/res`;
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  const dir = `${res}/mipmap-${d}`; mkdirSync(dir, { recursive: true });
  const s = Math.round(48 * k);
  await sharp(`${root}/assets/icon.svg`).resize(s, s).png().toFile(`${dir}/ic_launcher.png`);
  const round = Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`);
  await sharp(`${root}/assets/icon.svg`).resize(s, s).composite([{ input: round, blend: 'dest-in' }]).png().toFile(`${dir}/ic_launcher_round.png`);
  const f = Math.round(108 * k);
  await sharp(`${root}/assets/icon-foreground.svg`).resize(f, f).png().toFile(`${dir}/ic_launcher_foreground.png`);
}
const splash = { 'drawable': [480, 320], 'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280], 'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920], 'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720], 'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280] };
for (const [d, [w, h]] of Object.entries(splash)) {
  mkdirSync(`${res}/${d}`, { recursive: true });
  await sharp(`${root}/assets/splash.svg`).resize(w, h, { fit: 'cover' }).png().toFile(`${res}/${d}/splash.png`);
}
await sharp(`${root}/assets/icon.svg`).resize(512, 512).png().toFile(`${root}/public/icon-512.png`);
await sharp(`${root}/assets/icon.svg`).resize(192, 192).png().toFile(`${root}/public/icon-192.png`);
await sharp(`${root}/assets/icon.svg`).resize(180, 180).png().toFile(`${root}/public/apple-touch-icon.png`);
mkdirSync(`${res}/drawable-nodpi`, { recursive: true });
await sharp(`${root}/assets/icon.svg`).resize(256, 256).png().toFile(`${res}/drawable-nodpi/ic_notify_large.png`);
console.log('ok');
