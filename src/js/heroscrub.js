// hero 捲動影片背景 —— 每主題各一段短片,捲動時逐格 scrub(Apple 產品頁手感)。
//
// 作法:把一支 <video> 塞進 #bg-stage 第 0 層(.bg-layer.is-base)的
//   .bg-layer-img 與 .bg-layer-veil 之間。
//   - veil 仍蓋在影片上 → 各主題的文字遮罩(cosmic 雙層、noir 重白)照舊生效。
//   - 底下的 .bg-layer-img(= var(--hero-img) 靜態圖)天然當 poster,也是
//     reduced-motion / 手機省流量 / 載入失敗時的 fallback。影片真的畫出一格
//     (seeked)才淡出 poster,避免 iOS 上「seek 過但沒 play」的空白閃黑。
//
// 進度參照 hero 之後第一個 [data-bg] 區塊(#about)的位置,跟 scrollbg.js 覆蓋層
// 用同一條公式 → 鏡頭正好在 hero 被 up-wipe 蓋住的那一刻飛完,交接無縫。
//
// scroll-world 的引擎是整頁接管 + 無 teardown + 會漏 listener/objectURL,不能直接用;
// 這裡只移植它的核心:blob 載入(避開 seekable=[0,0] 陷阱、seek 即時)、
// rAF seek-coalescing(手機快滑不堆積 seek)、iOS 首觸 priming。

// 影片 URL 只在這一個 manifest 出現 → 不重蹈 BGV 三處同步的坑。
// 重生某段就把它改 -v2 並改檔名即可。
const CLIP = {
  lavender: '/video/lavender-hero-v1.mp4',
  // 試做階段只有 lavender。其餘主題找不到檔 → fetch 404 → 維持靜態 poster(優雅退化)。
  // cosmic:   '/video/cosmic-hero-v1.mp4',
  // bento:    '/video/bento-hero-v1.mp4',
  // sakura:   '/video/sakura-hero-v1.mp4',
  // aurora:   '/video/aurora-hero-v1.mp4',
  // noir:     '/video/noir-hero-v1.mp4',
};
// 手機較輕的版本(可選)。沒有對應鍵就 fall back 到 CLIP。
const CLIP_M = {
  lavender: '/video/lavender-hero-v1-m.mp4',
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function initHeroScrub({ reduced } = {}) {
  // reduced-motion:完全不載影片,維持靜態 hero 圖(等同現況)。
  if (reduced) return;

  const stage = document.getElementById('bg-stage');
  const base = stage?.querySelector('.bg-layer.is-base');
  if (!base) return; // scrollbg 尚未建好(理論上 initHeroScrub 一定在 initScrollBg 之後)
  const veil = base.querySelector('.bg-layer-veil');

  // 省流量模式 → 只用 poster,不下載 8MB 影片。
  if (navigator.connection?.saveData) return;

  const hero = document.getElementById('hero');
  if (!hero) return;

  // 啟用「跑道」:scrollbg.css 會把 hero 拉成 200svh 並釘住內容。
  // 前 100svh 給影片飛完,之後才輪到 #about 的上滑轉場 → 飛行不再被轉場蓋掉。
  document.documentElement.classList.add('heroscrub-on');

  const coarse = matchMedia('(pointer: coarse)').matches;
  const isMobile = () => coarse || innerWidth <= 860;

  // 單一 <video>,整個生命週期重用,換主題只換 src → 不會漏 listener/objectURL。
  const video = document.createElement('video');
  video.className = 'hero-video';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.disablePictureInPicture = true;
  base.insertBefore(video, veil); // 在 .bg-layer-img 之上、.bg-layer-veil 之下

  const state = { theme: null, url: null, ready: false, cur: 0, target: 0, ctrl: null };

  // 跑道制進度:0 →(heroH - vh)這段捲動把影片從頭放到尾。
  // #about 的上緣要到 scrollY = heroH - vh 才碰到視窗底、轉場才開始 ——
  // 也就是影片一定先飛完,轉場才蓋上來,兩者接力不重疊。
  const progress = () => {
    const runway = Math.max(1, hero.offsetHeight - innerHeight);
    return clamp01(scrollY / runway);
  };

  const clipUrl = (theme) => (isMobile() && CLIP_M[theme]) || CLIP[theme] || null;

  function loadClip(theme) {
    const url = clipUrl(theme);
    if (!url) return; // 此主題沒有影片 → 維持 poster
    state.ctrl?.abort(); // 取消上一個還在飛的 fetch(快速連續換主題)
    const ctrl = new AbortController();
    state.ctrl = ctrl;
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('404'))))
      .then((blob) => {
        if (ctrl.signal.aborted) return;
        if (state.url) URL.revokeObjectURL(state.url);
        state.url = URL.createObjectURL(blob); // 整支載進記憶體 → 每次 seek 即時
        video.src = state.url;
        video.load();
      })
      .catch(() => {
        /* abort 或 404:什麼都不做,poster 留著 */
      });
  }

  video.addEventListener('loadedmetadata', () => {
    state.ready = true;
  });
  // 影片真的畫出一格(seeked)才淡出 poster。iOS 上 seek 過但沒 play 的 muted video
  // 會是空白,光靠 loadedmetadata 就淡出會閃一下黑。
  video.addEventListener(
    'seeked',
    () => {
      base.classList.add('has-video');
    },
    { once: true },
  );

  // rAF seek-coalescing —— 移植自 scroll-world 核心。
  // cur 對 target 做慣性 lerp;絕不在 seeking 中再排下一個 seek(手機防堆積)。
  function tick() {
    if (state.ready && !video.seeking && Math.abs(state.cur - state.target) > 0.0005) {
      state.cur += (state.target - state.cur) * 0.18;
      const eps = isMobile() ? 0.02 : 0.008; // 手機用較粗的 seek 步進 = 少解碼
      const dur = video.duration || 1;
      const t = Math.min(Math.max(state.cur, 0), 0.999) * dur; // 0.999 避開最後一格外
      if (Math.abs(video.currentTime - t) > eps) {
        try {
          video.currentTime = t;
        } catch (e) {
          /* 尚未可 seek */
        }
      }
    }
    requestAnimationFrame(tick);
  }

  const onScroll = () => {
    state.target = progress();
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });

  // iOS 首次手勢後,muted video 才會可靠解碼/畫格。首觸做一次 play→pause,
  // 讓之後第一個 seek 立刻有影格,而不是空白。
  let primed = false;
  const prime = () => {
    if (primed) return;
    primed = true;
    try {
      const p = video.play();
      if (p?.then)
        p.then(() => {
          try {
            video.pause();
          } catch (e) {
            /* noop */
          }
        }).catch(() => {});
    } catch (e) {
      /* noop */
    }
  };
  addEventListener('pointerdown', prime, { once: true, passive: true });
  addEventListener('touchstart', prime, { once: true, passive: true });

  // 換主題:pause → revoke 舊 blob → poster 現身 → 載新片。listener 全程不重綁。
  addEventListener('themechange', (e) => {
    const next = e.detail || document.documentElement.dataset.theme;
    if (next === state.theme) return;
    state.theme = next;
    base.classList.remove('has-video'); // 載入期間先露出 poster
    state.ready = false;
    state.cur = state.target = progress();
    try {
      video.pause();
    } catch (e) {
      /* noop */
    }
    if (state.url) {
      URL.revokeObjectURL(state.url); // 只保留當前主題那一段在記憶體
      state.url = null;
    }
    video.removeAttribute('src');
    video.load();
    loadClip(next);
  });

  // 啟動:initTheme 已在本模組之前發過一次 themechange,所以這裡自己讀目前主題、載一次。
  state.theme = document.documentElement.dataset.theme;
  state.cur = state.target = progress();
  // 影片 ~8MB,延到 idle / load 後再抓,別跟 LCP 的 hero 圖 + 字型搶頻寬。
  const start = () => loadClip(state.theme);
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 3000 });
  else addEventListener('load', start, { once: true });

  requestAnimationFrame(tick);
}
