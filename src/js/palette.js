// 色調切換:導覽列上的 popover 選單 + localStorage。
//
// 色票定義在 world/palettes.js(3D 世界與 CSS 共用)。這裡只負責 UI 與狀態:
// 寫 html[data-palette]、記住選擇、發出 palettechange 事件 —— 3D 引擎收到後
// 在 0.9 秒內把整座城的顏色平滑過渡過去。
// 不用 View Transition:它對 WebGL 畫布截圖時常截到空白,過渡反而會閃黑。
//
// 選單的 a11y 沿用舊主題選單的做法(關閉用 .is-closed + inert,見 components.css 的註解)。

import { PALETTE_KEYS, currentPalette } from './world/palettes.js';

const STORE = 'tun9i-palette';

function sync(k) {
  const orb = document.getElementById('theme-current-orb');
  if (orb) orb.className = `orb orb-${k}`;
  document.querySelectorAll('[data-set-palette]').forEach((b) => {
    const on = b.dataset.setPalette === k;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}

export function setPalette(next) {
  if (!PALETTE_KEYS.includes(next)) return false;
  if (next === currentPalette()) return true;
  document.documentElement.dataset.palette = next;
  try { localStorage.setItem(STORE, next); } catch (e) { /* 無痕模式寫不進去也沒關係 */ }
  sync(next);
  dispatchEvent(new CustomEvent('palettechange', { detail: next }));
  return true;
}

export function initPalette() {
  sync(currentPalette());

  const picker = document.getElementById('theme-picker');
  const trigger = document.getElementById('theme-trigger');
  const menu = document.getElementById('theme-menu');
  if (!picker || !trigger || !menu) return;

  const openMenu = () => {
    menu.classList.remove('is-closed');
    menu.inert = false;
    picker.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    menu.querySelector('[aria-checked="true"]')?.focus();
  };
  const closeMenu = ({ refocus = false } = {}) => {
    menu.classList.add('is-closed');
    menu.inert = true;
    picker.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    if (refocus) trigger.focus();
  };
  const isOpen = () => !menu.classList.contains('is-closed');
  closeMenu();

  trigger.addEventListener('click', () => (isOpen() ? closeMenu() : openMenu()));
  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-set-palette]');
    if (!btn) return;
    setPalette(btn.dataset.setPalette);
    closeMenu({ refocus: true });
  });
  // 方向鍵在選單內移動並即時套用
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeMenu({ refocus: true }); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const n = PALETTE_KEYS.length;
    const next = PALETTE_KEYS[(PALETTE_KEYS.indexOf(currentPalette()) + dir + n) % n];
    setPalette(next);
    menu.querySelector(`[data-set-palette="${next}"]`)?.focus();
  });
  addEventListener('click', (e) => { if (isOpen() && !picker.contains(e.target)) closeMenu(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) closeMenu({ refocus: true }); });
}
