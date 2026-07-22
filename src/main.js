// tun9i.com — entry
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/motion.css';
import './styles/world.css';
import './styles/terminal.css';
import './styles/konami.css';
import { initI18n } from './js/i18n.js';
import { initReveal } from './js/reveal.js';
import { initParallax } from './js/parallax.js';
import { initPointer } from './js/pointer.js';
import { initParticles } from './js/particles.js';
import { initGithub } from './js/github.js';
import { initWorldBg } from './js/worldbg.js';
import { initHeatmap } from './js/heatmap.js';
import { initIcons } from './js/icons.js';
import { initTerminal } from './js/terminal.js';
import { initKonami } from './js/konami.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// hero 標題逐字拆分(CJK 也逐字)
function splitTitle() {
  const el = document.getElementById('hero-title');
  if (!el) return;
  const text = el.textContent.trim();
  el.textContent = '';
  el.setAttribute('aria-label', text);
  el.classList.add('split');
  const spans = [...text].map((ch, i) => {
    const span = document.createElement('span');
    span.className = 'ch';
    span.textContent = ch === ' ' ? ' ' : ch;
    span.style.setProperty('--ch-i', i);
    span.setAttribute('aria-hidden', 'true');
    el.appendChild(span);
    return span;
  });

  // 每個 .ch 自帶漸層,靠 --ch-x / --title-w 對齊成一條連續漸層
  // (offsetLeft/offsetWidth 不受 transform 影響,動畫進行中量測仍正確)
  const measure = () => {
    el.style.setProperty('--title-w', `${el.offsetWidth}px`);
    const base = el.offsetLeft;
    spans.forEach((s) => s.style.setProperty('--ch-x', `${s.offsetLeft - base}px`));
  };
  measure();
  document.fonts?.ready.then(measure).catch(() => {});
  addEventListener('resize', measure, { passive: true });

  // 失效保護:標題絕不允許永久隱形。若動畫因任何原因沒跑完
  // (節流、凍結、不支援),3 秒後直接強制顯示。
  setTimeout(() => {
    spans.forEach((s) => {
      if (getComputedStyle(s).opacity === '0') {
        s.style.animation = 'none';
        s.style.opacity = '1';
        s.style.transform = 'none';
      }
    });
  }, 3000);
}

initIcons();
// 黏土世界捲動背景(唯一主題)。reduced-motion / 省流量在模組內早退,退回海報圖。
initWorldBg({ reduced });
initI18n();
if (!reduced) splitTitle();
initReveal();
initGithub();
initHeatmap();
const konami = initKonami();
initTerminal({ fireKonami: konami.fire });

// 終端機提示:第一次來的人不會知道有這東西,滑到最後時提一次
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const hint = document.createElement('div');
  hint.className = 'term-hint';
  hint.innerHTML = '按 <kbd>`</kbd> 或 <kbd>Ctrl</kbd>+<kbd>K</kbd> 開終端機';
  document.body.appendChild(hint);
  const ho = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      ho.disconnect();
      hint.classList.add('on');
      setTimeout(() => hint.classList.remove('on'), 6000);
    }
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  const contact = document.getElementById('contact');
  if (contact) ho.observe(contact);
}

if (!reduced) {
  initParallax();
  initPointer();
  initParticles();
}

// nav 滾動壓縮
const nav = document.getElementById('site-nav');
const onScroll = () => nav.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// 手機漢堡選單
const burger = document.getElementById('nav-burger');
if (burger && nav) {
  const links = document.getElementById('nav-links-list');
  // 手機收合態的 CSS 是 opacity:0 + 位移出畫面 + pointer-events:none ——
  // 那擋得住滑鼠,擋不住鍵盤:七個看不見的連結還在 Tab 順序裡。
  // 跟 theme-menu 當年同一個坑,解法也一樣:inert。
  // inert 要跟「手機版 && 選單關著」連動,跨越 860px 斷點時也要重算,
  // 否則手機開完選單轉成桌機,導覽會被 inert 卡死。
  const mobile = matchMedia('(max-width: 860px)');
  const syncInert = () => { links.inert = mobile.matches && !nav.classList.contains('menu-open'); };
  const closeMenu = () => {
    nav.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    syncInert();
  };
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', String(open));
    syncInert();
  });
  nav.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', closeMenu));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  mobile.addEventListener('change', syncInert);
  syncInert();
}
