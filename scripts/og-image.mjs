// OG 分享圖(1200×630)+ apple-touch-icon(180×180)
//
// 檔名帶版號:X / Facebook 這些平台會把 OG 圖快取在自己那裡好幾天,而且認的是 URL。
// 同一個 URL 換內容,它們可能繼續發舊圖 —— 換背景時記得把版號 +1,
// 並同步改 index.html 的 og:image、twitter:image 與 JSON-LD 的 image。
// 背景是黏土世界的第一景(校園),直接吃 public/images/world/ 的海報圖 ——
// 那是網站真正的開場畫面,而且新 clone 下來就能重跑,不必先備妥 .assets-raw/。
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ogText = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 世界是奶油亮底、文字是深墨 —— 遮罩要從左邊淡出,不是壓暗整張。 -->
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="rgba(246,239,230,0.94)"/>
      <stop offset="0.42" stop-color="rgba(246,239,230,0.82)"/>
      <stop offset="0.72" stop-color="rgba(246,239,230,0.28)"/>
      <stop offset="1" stop-color="rgba(246,239,230,0)"/>
    </linearGradient>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#3b3247"/>
      <stop offset="1" stop-color="#8b78d0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#scrim)"/>
  <text x="80" y="300" font-family="Segoe UI, Arial, sans-serif" font-size="112" font-weight="700" fill="url(#grad)" letter-spacing="-2">Tunai</text>
  <text x="84" y="362" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="400" fill="rgba(59,50,71,0.88)">Software Engineering · AI Agents · Python Systems</text>
  <text x="84" y="418" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="600" fill="#8b78d0">tun9i.com</text>
</svg>`;

await sharp(join(root, 'public', 'images', 'world', 'poster_1-v1.webp'))
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .composite([{ input: Buffer.from(ogText) }])
  .jpeg({ quality: 84 })
  .toFile(join(root, 'public', 'og-image-v3.jpg'));
console.log('OK og-image-v3.jpg');

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
