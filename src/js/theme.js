// 主題切換:popover 選單 + View Transition 圓形擴散 + localStorage + meta theme-color
export const THEMES = ['lavender', 'cosmic', 'bento', 'sakura', 'aurora', 'noir'];
const META_COLOR = {
  lavender: '#161022',
  cosmic: '#05060b',
  bento: '#15170f',
  sakura: '#fdf3f5',
  aurora: '#08131f',
  noir: '#f4f4f2',
};

// 背景圖版號 —— 只列「換過圖」的主題。/images/* 吃 7 天快取且檔名不帶版號,
// 沒有 ?v= 的話舊訪客一整週都看到舊圖。
// 三處必須同步:這裡、index.html 的 FOUC script、tokens.css 的 --hero-img/--deep-img。
const BGV = { cosmic: 2 };

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('tun9i-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme]);

  // 預載該主題 hero 圖。
  // BGV 必須和 index.html 的 FOUC script 與 tokens.css 的 --hero-img 一致,
  // 否則 CSS 拿 ?v=2、這裡拿無版號 = 兩個不同 URL,預載完全白做而且下載兩次。
  const heroImg = new Image();
  heroImg.src = `/images/themes/${theme}/hero-1920.webp${BGV[theme] ? `?v=${BGV[theme]}` : ''}`;

  // 觸發鈕上的當前色球
  const cur = document.getElementById('theme-current-orb');
  if (cur) cur.className = `orb orb-${theme}`;

  // radio 狀態 + roving tabindex
  document.querySelectorAll('[data-set-theme]').forEach((b) => {
    const on = b.dataset.setTheme === theme;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

function switchTheme(next, originEl) {
  if (!THEMES.includes(next) || next === document.documentElement.dataset.theme) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduced) {
    apply(next);
    return;
  }
  // 圓形擴散起點 = 來源元素
  const r = (originEl || document.getElementById('theme-trigger'))?.getBoundingClientRect();
  if (r) {
    document.documentElement.style.setProperty('--vt-x', `${((r.left + r.width / 2) / innerWidth) * 100}%`);
    document.documentElement.style.setProperty('--vt-y', `${((r.top + r.height / 2) / innerHeight) * 100}%`);
  }
  let applied = false;
  const run = () => { if (!applied) { applied = true; apply(next); } };
  document.startViewTransition(run);
  setTimeout(run, 300); // 保底
}

// 給終端機 / 自動主題用:以程式切換(仍走 View Transition)
export function setTheme(next) {
  switchTheme(next, document.getElementById('theme-trigger'));
}

export function initTheme() {
  const current = document.documentElement.dataset.theme;
  apply(THEMES.includes(current) ? current : 'lavender');

  const picker = document.getElementById('theme-picker');
  const trigger = document.getElementById('theme-trigger');
  const menu = document.getElementById('theme-menu');
  if (!picker || !trigger || !menu) return;

  // 用 .is-closed + inert 表示關閉,不要用 hidden 屬性:
  // CSS 那邊為了保留退場動畫會把 display 蓋回 grid,hidden 就形同虛設,
  // 選單會變成一顆永遠存在、看不見卻能被 Tab 到的幽靈。inert 才會真的移除
  // Tab 順序與無障礙樹,而且不影響動畫。
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

  closeMenu();   // 初始狀態(也把 inert 設上)

  trigger.addEventListener('click', () => (isOpen() ? closeMenu() : openMenu()));

  // 使用者親手挑主題 → 關掉「依時間自動換」,之後完全尊重他的選擇。
  // 直接寫 localStorage 而不 import autotheme.js,避免兩個模組循環相依。
  const manual = () => localStorage.setItem('tun9i-theme-auto', '0');

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-set-theme]');
    if (!btn) return;
    manual();
    switchTheme(btn.dataset.setTheme, btn);
    closeMenu({ refocus: true });
  });

  // 方向鍵在選單內移動並即時套用
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeMenu({ refocus: true }); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const cur = document.documentElement.dataset.theme;
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = THEMES[(THEMES.indexOf(cur) + dir + THEMES.length) % THEMES.length];
    const nextBtn = menu.querySelector(`[data-set-theme="${next}"]`);
    manual();
    switchTheme(next, nextBtn);
    nextBtn?.focus();
  });

  // 點外面 / Esc 關閉
  addEventListener('click', (e) => {
    if (isOpen() && !picker.contains(e.target)) closeMenu();
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) closeMenu({ refocus: true });
  });
}
