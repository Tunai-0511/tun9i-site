// 依時間自動切換主題(可關)
//
// 規則:使用者一旦自己挑過主題,就完全尊重他的選擇,不再自動改。
// 只有在「自動」模式下才依當地時間換。
import { THEMES } from './theme.js';

const KEY = 'tun9i-theme-auto';

// 一天的時段 → 主題
const SCHEDULE = [
  { from: 5,  to: 8,  theme: 'sakura' },    // 清晨:櫻花柔光
  { from: 8,  to: 16, theme: 'cosmic' },    // 白天:深空黑洞
  { from: 16, to: 19, theme: 'lavender' },  // 傍晚:薰衣草暮色
  { from: 19, to: 23, theme: 'bento' },     // 夜晚:暗夜便當格
  { from: 23, to: 5,  theme: 'aurora' },    // 深夜:極光
];

export function themeForHour(h) {
  for (const s of SCHEDULE) {
    const wraps = s.from > s.to;                       // 跨午夜
    if (wraps ? (h >= s.from || h < s.to) : (h >= s.from && h < s.to)) return s.theme;
  }
  return 'lavender';
}

export const isAuto = () => localStorage.getItem(KEY) === '1';
export function setAuto(on) {
  localStorage.setItem(KEY, on ? '1' : '0');
  if (on) applyNow();
}

let applyFn = null;
export function bindAuto(fn) { applyFn = fn; }

function applyNow() {
  if (!isAuto() || !applyFn) return;
  const next = themeForHour(new Date().getHours());
  if (THEMES.includes(next) && next !== document.documentElement.dataset.theme) applyFn(next);
}

// firstVisit 必須由 main.js 在 initTheme() 之前判斷後傳進來 ——
// initTheme() 一定會寫入 tun9i-theme,若在這裡才讀,永遠會以為使用者挑過主題,
// 自動模式就再也不會被開啟。
export function initAutoTheme({ firstVisit = false } = {}) {
  // 首次造訪 → 預設開啟自動
  if (localStorage.getItem(KEY) == null && firstVisit) {
    localStorage.setItem(KEY, '1');
  }
  applyNow();
  // 每分鐘檢查一次,跨時段就換
  setInterval(applyNow, 60_000);
  // 分頁重新可見時也檢查(電腦睡醒後 setInterval 會失準)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyNow(); });
}
