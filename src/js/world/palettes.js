// 色票 —— 3D 世界與網站 CSS 共用的唯一來源。
//
// 每一組都是「起點色 → 終點色」的八段漸層,沿著城市的 x 軸鋪開:左邊是過去、右邊是現在。
// 所以換色票不會打散故事,只換語氣。stops 的 x 位置固定在 STOP_X(對齊各街區)。
// metal 是打線與焊墊的金屬色;accent / accent2 / ink 給網站按鈕、漸層標題與眉標用。
//
// 改色票時:這裡改完,tokens.css 的 [data-palette] 區塊也要同步(CSS 讀不到 JS)。

export const STOP_X = [-34, 14, 40, 66, 100, 150, 195, 262];

export const PALETTES = {
  tungsten: {
    zh: '鎢絲', en: 'Tungsten',
    stops: [0xffa94d, 0xffb85c, 0xf3c46e, 0xff9ebd, 0xb69cff, 0x8d6cff, 0xa487ff, 0xd8ccff],
    metal: 0xf6c56b,
  },
  neon: {
    zh: '霓虹', en: 'Neon',
    stops: [0x21e6ff, 0x2fd6ff, 0x4aa8ff, 0x8a7bff, 0xc45cff, 0xff4fd8, 0xff62b8, 0xffc4ee],
    metal: 0xd8f4ff,
  },
  circuit: {
    zh: '電路板', en: 'Circuit',
    stops: [0x3dff7a, 0x4dff9a, 0x40f2b4, 0x30dcd2, 0x2fbfff, 0x3a93ff, 0x5b7cff, 0xb8d4ff],
    metal: 0xf6c56b,
  },
  sakura: {
    zh: '櫻夜', en: 'Sakura',
    stops: [0xff6f9f, 0xff85b0, 0xff9fc2, 0xf7a7d6, 0xdcabf2, 0xc3a6ff, 0xcdb9ff, 0xf1e8ff],
    metal: 0xffe0ea,
  },
  platinum: {
    zh: '白金', en: 'Platinum',
    stops: [0xffe9c7, 0xfbe8cf, 0xf1e6da, 0xe3e5ea, 0xd2e0ef, 0xbcd8f4, 0xa9cdf7, 0xe8f4ff],
    metal: 0xe9edf2,
  },
};

export const PALETTE_KEYS = Object.keys(PALETTES);
export const DEFAULT_PALETTE = 'tungsten';

export function currentPalette() {
  const k = document.documentElement.dataset.palette;
  return PALETTE_KEYS.includes(k) ? k : DEFAULT_PALETTE;
}
