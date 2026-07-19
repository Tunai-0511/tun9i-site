// 磁性按鈕 + tilt/glare 卡片(僅指標裝置)
//
// 位移全部在 pointermove 裡「同步」寫入 transform,平滑交給 CSS transition
// 在合成層跑 —— 不自己用 rAF lerp 迴圈。
// 原因:rAF 一被節流(分頁未繪製、背景分頁),整個效果就靜止不動,而且
// 完全無法在自動化環境裡驗證(實測 rAF 觸發 0 次)。桌寵先前也是同一個問題。
// pointermove 本來就被瀏覽器限制在每幀一次,同步寫入不會過量。
export function initPointer() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const magnets = [];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function registerMagnet(el) {
    if (el.dataset.magBound) return;
    el.dataset.magBound = '1';
    magnets.push({ el });
  }

  function registerTilt(el) {
    if (el.dataset.tiltBound) return;
    el.dataset.tiltBound = '1';
    if (!el.querySelector('.glare-layer')) {
      const g = document.createElement('div');
      g.className = 'glare-layer';
      g.setAttribute('aria-hidden', 'true');
      el.appendChild(g);
    }
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      el.style.transform = `perspective(900px) rotateX(${((0.5 - py) * 8).toFixed(2)}deg) rotateY(${((px - 0.5) * 10).toFixed(2)}deg)`;
    }, { passive: true });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  }

  document.querySelectorAll('.magnetic').forEach(registerMagnet);
  document.querySelectorAll('.tilt').forEach(registerTilt);

  // 動態產生的 GitHub 卡片(github.js render 後派發)也要註冊
  addEventListener('repos:rendered', () => {
    for (let i = magnets.length - 1; i >= 0; i--) if (!magnets[i].el.isConnected) magnets.splice(i, 1);
    document.querySelectorAll('.tilt').forEach(registerTilt);
    document.querySelectorAll('.magnetic').forEach(registerMagnet);
  });

  // 磁性吸附
  //
  // 舊版有兩個錯,合起來就是使用者看到的「兩顆按鈕互相撞在一起」:
  //  1. 位移 = dx * 0.22 沒有上限。感應範圍 90 + 半個元素寬(GitHub 鈕約 155px),
  //     單顆最多位移 34px;相鄰兩顆同時往中間的游標撲 = 靠近 68px,
  //     但 .cta-row 的 gap 只有 16px → 直接重疊。
  //  2. 吸力與距離成正比 → 越遠吸越猛、越近反而不動,方向整個是反的。
  //
  // 現在:只有「最近的那一顆」會動(相鄰按鈕不可能對撞),位移上限 6px
  // (遠小於 16px 間距,數學上不可能重疊),吸力隨距離衰減(貼著最強、邊緣為 0)。
  const REACH = 70;      // 從元素邊框往外的感應距離
  const MAX_PULL = 6;    // px,必須遠小於相鄰元素間距

  addEventListener('pointermove', (e) => {
    let nearest = null;
    let nearestEdge = Infinity;

    for (const m of magnets) {
      const r = m.el.getBoundingClientRect();
      m._dx = e.clientX - (r.left + r.width / 2);
      m._dy = e.clientY - (r.top + r.height / 2);
      // 量到「元素邊框」的距離而非中心 —— 長條按鈕整條邊都該有磁性
      const ox = Math.max(0, Math.abs(m._dx) - r.width / 2);
      const oy = Math.max(0, Math.abs(m._dy) - r.height / 2);
      m._edge = Math.hypot(ox, oy);
      if (m._edge < REACH && m._edge < nearestEdge) { nearestEdge = m._edge; nearest = m; }
    }

    for (const m of magnets) {
      if (m !== nearest) {
        if (m.el.style.transform) m.el.style.transform = '';
        continue;
      }
      const falloff = 1 - m._edge / REACH;          // 貼著=1,感應邊緣=0
      const len = Math.hypot(m._dx, m._dy) || 1;
      const pull = MAX_PULL * falloff;
      const tx = clamp((m._dx / len) * pull, -MAX_PULL, MAX_PULL);
      const ty = clamp((m._dy / len) * pull, -MAX_PULL, MAX_PULL);
      m.el.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
    }
  }, { passive: true });
}
