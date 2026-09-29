// OG 分享圖(1200×630)+ apple-touch-icon(180×180)
//
// 檔名帶版號:X / Facebook 這些平台會把 OG 圖快取在自己那裡好幾天,而且認的是 URL。
// 同一個 URL 換內容,它們可能繼續發舊圖 —— 換背景時記得把版號 +1,
// 並同步改 index.html 的 og:image、twitter:image 與 JSON-LD 的 image。
// 背景是《訊號簡史》結尾那一幀(雜訊一路變成光束),存在 scripts/og-film-frame.jpg ——
// 它是從瀏覽器裡的即時場景直接擷取的,跟著 repo 走,新 clone 也能重跑。
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ogText = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f4efe7"/>
      <stop offset="0.55" stop-color="#e8b45c"/>
      <stop offset="1" stop-color="#a487ff"/>
    </linearGradient>
  </defs>
  <rect x="80" y="86" width="30" height="20" rx="3" fill="#e8b45c"/>
  <text x="95" y="101" font-family="Menlo, monospace" font-size="12" font-weight="700" fill="#140e05" text-anchor="middle">07</text>
  <text x="124" y="102" font-family="Menlo, monospace" font-size="13" letter-spacing="4" fill="rgba(244,239,231,0.6)">FROM NOISE TO A BEAM OF LIGHT</text>
  <text x="76" y="232" font-family="Georgia, 'Times New Roman', serif" font-size="118" font-weight="700" fill="url(#grad)" letter-spacing="-2">Tunai</text>
  <text x="82" y="288" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="rgba(244,239,231,0.9)">Software Engineering · AI Agents · Python Systems</text>
  <text x="82" y="336" font-family="Menlo, monospace" font-size="22" letter-spacing="3" fill="#e8b45c">TUN9I.COM</text>
</svg>`;

await sharp(join(root, 'scripts', 'og-film-frame.jpg'))
  .resize(1200, 630, { fit: 'cover' })
  .composite([{ input: Buffer.from(ogText) }])
  .jpeg({ quality: 86 })
  .toFile(join(root, 'public', 'og-image-v4.jpg'));
console.log('OK og-image-v4.jpg');

// 圖示:來源是 public/favicon-v2.svg(訊號:雜訊 → 正弦 → 亮點)。換設計就把版號 +1 ——
// 瀏覽器的 favicon 快取比一般快取更頑固,同一個網址換內容,很多人會卡在舊圖好幾天。
// apple-touch-icon 要滿版不透明:iOS 會自己裁圓角,透明的四角會變成黑邊。
import { readFileSync } from 'node:fs';
const iconSvg = readFileSync(join(root, 'public', 'favicon-v2.svg'));

// -v2 給 <link> 用;不帶版號的那份給沒讀 <link> 就直接要 /apple-touch-icon.png 的裝置
for (const name of ['apple-touch-icon-v2.png', 'apple-touch-icon.png']) {
  await sharp(iconSvg, { density: 600 }).resize(180, 180).flatten({ background: '#050407' }).png()
    .toFile(join(root, 'public', name));
  console.log('OK ' + name);
}

await sharp(iconSvg, { density: 300 }).resize(32, 32).png().toFile(join(root, 'public', 'favicon-32-v2.png'));
console.log('OK favicon-32-v2.png');
