// 黏土世界捲動背景 —— 11 段鏡頭鏈(6 俯衝 + 5 連接)隨整頁捲動逐格 scrub。
//
// 取代 scrollbg.js(上滑覆蓋圖層)與 heroscrub.js(hero 單支影片):
// 整個網站變成一趟飛越黏土微縮世界的旅程,區塊即場景 ——
//   dive_1 校園   = #hero + #about + #journey(起點/時間軸/證照)
//   dive_2 AI 室  = #ai            dive_3 展示館 = #projects
//   dive_4 遊戲房 = #interests     dive_5 主機房 = #setup
//   dive_6 燈塔   = #contact
// 連接段(conn_i)佔據相鄰區塊邊界前後各 CONN_W 視窗高的捲動帶:
// 跨區塊時鏡頭拉出、飛越世界、降落下一景 —— 全程無剪接。
//
// 衛生守則沿用 heroscrub:blob 載入(避開 seekable=[0,0]、seek 即時)、
// rAF seek-coalescing(手機快滑不堆積)、iOS 首觸 priming、
// reduced-motion / saveData 早退(海報圖交叉淡化,仍有旅程感)、
// 影片畫出首格(seeked)才淡出海報。模組整頁生命週期只掛載一次,無 teardown 需求。

const GROUPS = [
  ['hero', 'about', 'journey'],
  ['ai'],
  ['projects'],
  ['interests'],
  ['setup'],
  ['contact'],
];

// 素材 manifest(重生某段就改版號檔名,一處搞定)
// 版號 V:/video/* 與 /images/* 都是 immutable 長快取,重生素材必須改版號 +
// 改檔名,不可原地覆蓋同一 URL(見 public/_headers 的血淚註解)。
const V = 'v1';
const DIVE = (i) => `/video/world/dive_${i}-${V}.mp4`;
const CONN = (i) => `/video/world/conn_${i}-${V}.mp4`;
const DIVE_M = (i) => `/video/world/dive_${i}-${V}-m.mp4`;
const CONN_M = (i) => `/video/world/conn_${i}-${V}-m.mp4`;
const POSTER = (i) => `/images/world/poster_${i}-${V}.webp`;

const CONN_W = 0.45;   // 連接段半寬(視窗高的倍數)
const FADE = 0.1;      // 接縫交叉淡化帶(視窗高的倍數)
const LOOKAHEAD = 1.6; // 提前載入距離(視窗高的倍數)

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

export function initWorldBg({ reduced } = {}) {
  const stage = document.getElementById('bg-stage');
  if (!stage) return;

  const coarse = matchMedia('(pointer: coarse)').matches;
  const isMobile = () => coarse || innerWidth <= 860;
  const noVideo = reduced || navigator.connection?.saveData;

  // ---- 段落表:dive/conn 交錯 ----
  const segs = [];
  GROUPS.forEach((ids, gi) => {
    segs.push({ kind: 'dive', gi, src: DIVE(gi + 1), srcM: DIVE_M(gi + 1), poster: POSTER(gi + 1) });
    if (gi < GROUPS.length - 1)
      segs.push({ kind: 'conn', gi, src: CONN(gi + 1), srcM: CONN_M(gi + 1), poster: POSTER(gi + 2) });
  });

  // ---- DOM ----
  segs.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'world-seg';
    el.style.zIndex = String(i);
    const poster = document.createElement('div');
    poster.className = 'world-seg-poster';
    poster.style.backgroundImage = `url('${s.poster}')`;
    el.appendChild(poster);
    stage.appendChild(el);
    Object.assign(s, { el, video: null, loading: false, ready: false, cur: 0, target: 0, visible: false });
  });
  const veil = document.createElement('div');
  veil.className = 'world-veil';
  stage.appendChild(veil);

  // ---- 佈局:把每段對映到絕對捲動範圍 ----
  // 內容高度會變(GitHub 卡片晚到、切語言、字型載入),所以除了 resize,
  // 還用 ResizeObserver 盯著 main —— 高度一變就重算。
  // 進度探針用「視窗中心」(yc = scrollY + vh/2),不是視窗頂端 ——
  // 場景在區塊置中於畫面時亮相;更關鍵的是:比視窗矮的尾端區塊
  // (#contact)用頂端基準永遠捲不到,用中心基準才進得去。
  function layout() {
    const vh = innerHeight;
    const W = CONN_W * vh;
    const maxYc = Math.max(1, document.documentElement.scrollHeight - vh) + vh / 2;
    const bounds = GROUPS.map((ids) => {
      const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
      if (!els.length) return null;
      const top = els[0].getBoundingClientRect().top + scrollY;
      const last = els[els.length - 1];
      const bottom = last.getBoundingClientRect().bottom + scrollY;
      return { top, bottom };
    });
    segs.forEach((s) => {
      const b = bounds[s.gi];
      if (!b) { s.start = 0; s.end = 1; return; }
      if (s.kind === 'dive') {
        s.start = s.gi === 0 ? vh / 2 : b.top + W; // 頁面頂 yc=vh/2 → 第一景從 0 起飛
        s.end = s.gi === GROUPS.length - 1 ? maxYc : b.bottom - W;
      } else {
        const mid = (b.bottom + (bounds[s.gi + 1]?.top ?? b.bottom)) / 2;
        s.start = mid - W;
        s.end = mid + W;
      }
    });
    // 尾端壓縮:矮於視窗的最終區塊塞不下「連接窗 + 俯衝」的名目範圍。
    // 從最後一段往回夾:每段至少留最小跨距,且全部在 maxYc(頁底)前完成 ——
    // 燈塔一定飛得完,前面的段最多被擠掉一點尾巴。
    let limit = maxYc;
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      const minSpan = (s.kind === 'dive' ? 0.6 : 0.5) * vh;
      s.end = Math.min(s.end, limit);
      s.start = Math.min(s.start, s.end - minSpan);
      limit = s.start;
    }
    read();
  }

  // ---- blob 載入(懶,進入視距才抓;載過不重抓) ----
  let primed = false;
  function prime(v) {
    if (!isMobile() || !v) return;
    try {
      const p = v.play();
      if (p?.then) p.then(() => { try { v.pause(); } catch (e) { /* noop */ } }).catch(() => {});
    } catch (e) { /* noop */ }
  }
  function loadSeg(s) {
    if (noVideo || s.loading) return;
    s.loading = true;
    const url = isMobile() ? s.srcM : s.src;
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('404'))))
      .then((blob) => {
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        v.setAttribute('muted', '');
        v.setAttribute('playsinline', '');
        v.setAttribute('aria-hidden', 'true');
        v.disablePictureInPicture = true;
        v.src = URL.createObjectURL(blob); // 常駐記憶體:背景整頁共用,不回收
        v.addEventListener('loadedmetadata', () => { s.ready = true; });
        // 畫出真實影格才淡出海報(iOS 沒 play 過的 muted video seek 完仍空白)
        v.addEventListener('seeked', () => s.el.classList.add('has-video'), { once: true });
        v.addEventListener('loadeddata', () => { if (primed) prime(v); });
        s.el.appendChild(v);
        s.video = v;
      })
      .catch(() => { s.loading = false; /* 404/斷線:海報留著,下次進視距再試 */ });
  }

  // ---- 捲動→各段透明度與目標進度 ----
  let ticking = false;
  function read() {
    ticking = false;
    const vh = innerHeight;
    const y = scrollY + vh / 2; // 視窗中心探針(見 layout 註解)
    const fade = FADE * vh;
    segs.forEach((s) => {
      if (y > s.start - LOOKAHEAD * vh && y < s.end + LOOKAHEAD * vh) loadSeg(s);
      s.target = clamp01((y - s.start) / (s.end - s.start));
      const outside = y < s.start ? s.start - y : y > s.end ? y - s.end : 0;
      const op = smooth(1 - outside / fade);
      s.el.style.opacity = op.toFixed(3);
      s.visible = op > 0.001;
    });
  }

  // ---- rAF seek-coalescing ----
  function tick() {
    const eps = isMobile() ? 0.02 : 0.008;
    for (const s of segs) {
      if (!s.ready || !s.video || s.video.seeking) continue;
      if (!s.visible && Math.abs(s.cur - s.target) < 0.002) continue;
      s.cur += (s.target - s.cur) * 0.18;
      const dur = s.video.duration || 1;
      const t = Math.min(Math.max(s.cur, 0), 0.999) * dur;
      if (Math.abs(s.video.currentTime - t) > eps) {
        try { s.video.currentTime = t; } catch (e) { /* 尚未可 seek */ }
      }
    }
    requestAnimationFrame(tick);
  }

  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(read); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', layout, { passive: true });
  addEventListener('orientationchange', layout);
  addEventListener('load', layout, { once: true });
  addEventListener('langchange', () => requestAnimationFrame(layout));
  const main = document.querySelector('main');
  if (main && 'ResizeObserver' in window) {
    let raf = null;
    new ResizeObserver(() => {
      if (raf == null) raf = requestAnimationFrame(() => { raf = null; layout(); });
    }).observe(main);
  }

  const onFirstGesture = () => {
    if (primed) return;
    primed = true;
    segs.forEach((s) => prime(s.video));
  };
  addEventListener('pointerdown', onFirstGesture, { once: true, passive: true });
  addEventListener('touchstart', onFirstGesture, { once: true, passive: true });

  layout();
  if (!noVideo) requestAnimationFrame(tick);
}
