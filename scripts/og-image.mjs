// OG 分享圖(1200×630)+ apple-touch-icon(180×180)
//
// 檔名帶版號:X / Facebook 這些平台會把 OG 圖快取在自己那裡好幾天,而且認的是 URL。
// 同一個 URL 換內容,它們可能繼續發舊圖 —— 換背景時記得把版號 +1,
// 並同步改 index.html 的 og:image 與 twitter:image。
// 背景圖來源是 .assets-raw/cosmic-hero.png(目前是黑洞)。
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ogText = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(10,14,26,0)"/>
      <stop offset="1" stop-color="rgba(10,14,26,0.55)"/>
    </linearGradient>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#cfe0f4"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#veil)"/>
  <text x="80" y="460" font-family="Segoe UI, Arial, sans-serif" font-size="104" font-weight="700" fill="url(#grad)" letter-spacing="-2">Tunai</text>
  <text x="84" y="524" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="400" fill="rgba(255,255,255,0.92)">Software Engineering · AI Agents · Python Systems</text>
  <text x="84" y="574" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="600" fill="#d9a441">tun9i.com</text>
</svg>`;

await sharp(join(root, '.assets-raw', 'cosmic-hero.png'))
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .composite([{ input: Buffer.from(ogText) }])
  .jpeg({ quality: 84 })
  .toFile(join(root, 'public', 'og-image-v2.jpg'));
console.log('OK og-image-v2.jpg');

const icon = `
<svg width="180" height="180" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a78bfa"/>
      <stop offset="1" stop-color="#f0abfc"/>
    </linearGradient>
  </defs>
  <rect width="180" height="180" rx="40" fill="#161022"/>
  <text x="90" y="118" font-family="Segoe UI, Arial, sans-serif" font-size="72" font-weight="700" fill="url(#g)" text-anchor="middle">t9</text>
  <circle cx="138" cy="48" r="10" fill="#f0abfc"/>
</svg>`;

await sharp(Buffer.from(icon)).png().toFile(join(root, 'public', 'apple-touch-icon.png'));
console.log('OK apple-touch-icon.png');

await sharp(Buffer.from(icon)).resize(32, 32).png().toFile(join(root, 'public', 'favicon-32.png'));
console.log('OK favicon-32.png');
