// 原圖(.assets-raw/)→ public/images/ 的 WebP/AVIF 壓縮管線
// 用法:npm run images
import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { join, parse } from 'node:path';

const RAW = new URL('../.assets-raw/', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1');
const OUT = new URL('../public/images/', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1');

// 命名慣例:<theme>-hero.<ext> → public/images/themes/<theme>/hero-{1920,960}.{webp,avif}
//          avatar.<ext>       → public/images/avatar-v2.webp
const THEMES = ['lavender', 'cosmic', 'bento', 'sakura', 'aurora', 'noir'];
const WIDTHS = [1920, 960];

// 檔名帶版號:換頭像時把版號 +1,可繞過瀏覽器對舊 URL 的快取
const AVATAR_FILE = 'avatar-v2.webp';

async function heroPipeline(file, theme, kind = 'hero') {
  const dir = join(OUT, 'themes', theme);
  await mkdir(dir, { recursive: true });
  for (const w of WIDTHS) {
    const base = sharp(file).resize({ width: w, withoutEnlargement: false });
    await base.clone().webp({ quality: 80 }).toFile(join(dir, `${kind}-${w}.webp`));
    await base.clone().avif({ quality: 55 }).toFile(join(dir, `${kind}-${w}.avif`));
  }
  console.log(`OK ${theme} ${kind} -> ${dir}`);
}

async function avatarPipeline(file) {
  await mkdir(OUT, { recursive: true });
  await sharp(file).resize({ width: 800, height: 800, fit: 'cover' }).webp({ quality: 88 }).toFile(join(OUT, AVATAR_FILE));
  console.log(`OK avatar -> public/images/${AVATAR_FILE}`);
}


async function main() {
  let files;
  try {
    files = await readdir(RAW);
  } catch {
    console.error(`找不到 ${RAW},請先把原圖放進 .assets-raw/`);
    process.exit(1);
  }
  // <theme>-hero 或 <theme>-deep
  const bgRe = new RegExp(`^(${THEMES.join('|')})-(hero|deep)$`);
  for (const f of files) {
    const full = join(RAW, f);
    if (!(await stat(full)).isFile()) continue;
    const { name } = parse(f);
    const bgMatch = name.match(bgRe);
    if (bgMatch) await heroPipeline(full, bgMatch[1], bgMatch[2]);
    else if (name === 'avatar') await avatarPipeline(full);
    else console.log(`-- 略過 ${f}(不符命名慣例)`);
  }
}

main();
