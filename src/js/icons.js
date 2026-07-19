// 品牌圖示掛載
//
// 原則:只用「品牌自己的官方 icon」(來自 simple-icons,路徑 CC0,且明確允許
// 用來代表該品牌)。拿不到官方 icon 的(OpenAI、Higgsfield、Hermes、OpenClaw、
// 各家遊戲)一律退回乾淨字標 —— 不自己畫一個假 logo 冒充。
//
// 註:simple-icons 沒有 OpenAI 與多數遊戲 logo,是因為權利人要求下架。
// 那些品牌的 logo 不該從網路上隨便抓來用。
import { BRAND } from './brand-icons.js';
import { HW } from './hw-icons.js';

// data-brand 值 → 官方 logo
const OFFICIAL = {
  claude: BRAND.claude,
  chatgpt: BRAND.openai,
  gemini: BRAND.gemini,
  // 硬體品牌:simple-icons 有官方路徑,且已烤進各自的官方品牌色。
  // MSI 不在這裡 —— 龍的路徑 8.2KB 太肥,改用 brand/msi-v1.webp。
  amd: HW.amd,
  nvidia: HW.nvidia,
  acer: HW.acer,
  steelseries: HW.steelseries,
  hyperx: HW.hyperx,
};

export function initIcons() {
  document.querySelectorAll('[data-brand]').forEach((el) => {
    const b = OFFICIAL[el.dataset.brand];
    if (!b) return;                       // 沒有官方 logo → 保留 HTML 裡的字標
    // mono logo 自己沒帶顏色(預設黑),要交給 currentColor,
    // 才不會在深色主題變成黑貼黑。
    const fill = b.mono ? ' fill="currentColor"' : '';
    el.innerHTML = `<svg viewBox="${b.viewBox}"${fill} aria-hidden="true">${b.body}</svg>`;
    el.classList.add('has-brand');
    if (b.mono) el.classList.add('is-mono');
    // 橫式字標(AMD/Acer/HyperX)在小徽章裡要放大才讀得到
    if (b.wide) el.classList.add('is-wide');
  });
}
