// 捲動式背景切換(motionsites 風格:新背景由下往上滑入覆蓋 + 交叉淡入 + 視差)
//
// 作法:一個 fixed 的背景舞台,裡面每個 section 各有一層。
// 捲到某個 section 時,它的圖層 clip-path 由下往上展開蓋住前一層,
// 同時 opacity 淡入、內層圖做反向視差位移。
//
// 用 CSS scroll-driven animation(animation-timeline: view())優先,
// 不支援時退回 IntersectionObserver + 單一 scroll listener。

// 相鄰的 section 必須拿到不同的 variant,否則交叉淡入是「同一張圖蓋同一張圖」
// = 過場完全看不見。插入新 section 時記得把後面的整串翻過來。
const LAYER_OF = {
  hero: 'a',
  about: 'b',
  journey: 'a',
  projects: 'b',
  ai: 'a',
  interests: 'b',
  setup: 'a',
  contact: 'b',
};

export function initScrollBg() {
  const stage = document.getElementById('bg-stage');
  if (!stage) return;

  const sections = [...document.querySelectorAll('[data-bg]')];
  if (!sections.length) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 為每個 section 建立一個背景圖層
  const layers = sections.map((sec, i) => {
    const layer = document.createElement('div');
    layer.className = 'bg-layer';
    layer.dataset.variant = LAYER_OF[sec.id] || (i % 2 === 0 ? 'a' : 'b');
    layer.style.zIndex = String(i);
    const inner = document.createElement('div');
    inner.className = 'bg-layer-img';
    const veil = document.createElement('div');
    veil.className = 'bg-layer-veil';
    layer.append(inner, veil);
    stage.appendChild(layer);
    return { sec, layer, inner };
  });

  // 第一層(hero)永遠全開當底
  layers[0].layer.style.setProperty('--p', '1');
  layers[0].layer.classList.add('is-base');

  let raf = null;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  const update = () => {
    raf = null;
    const vh = innerHeight;
    for (let i = 1; i < layers.length; i++) {
      const { sec, layer, inner } = layers[i];
      const r = sec.getBoundingClientRect();
      // p: 這個 section 的上緣從視窗底部(0)升到視窗頂部(1)
      const p = clamp01((vh - r.top) / vh);
      layer.style.setProperty('--p', p.toFixed(4));
      // 視差:圖層內部反向緩慢位移
      if (!reduced) inner.style.transform = `translate3d(0, ${((1 - p) * 8).toFixed(2)}%, 0) scale(${(1.08 - p * 0.04).toFixed(4)})`;
    }
  };

  const onScroll = () => { if (raf == null) raf = requestAnimationFrame(update); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  update();

  // 換主題時圖層背景圖跟著換(靠 CSS var,不需重建)
  addEventListener('themechange', () => requestAnimationFrame(update));
}
