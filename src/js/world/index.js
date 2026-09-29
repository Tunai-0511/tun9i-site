// 《訊號簡史》背景的入口 —— 很輕,真正的 three.js 引擎延遲載入。
//
// 首屏文字不等 3D:瀏覽器閒下來才動態 import 引擎(three.js + 後製約 160KB gzip,
// 自成一個 chunk)。沒有 WebGL 就停在全黑舞台,網站其他部分完全不受影響。
//
// HUD(紀錄片式的章節標籤、年份、場景標註)也在這裡建好,交給引擎更新。
// 它在背景舞台裡 —— 內容卡片永遠蓋在它上面。

export function initWorld({ reduced = false } = {}) {
  const stage = document.getElementById('bg-stage');
  if (!stage) return;

  const html = document.documentElement;
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2') || probe.getContext('webgl');
  if (!gl) { html.classList.add('world-fallback'); return; }
  gl.getExtension('WEBGL_lose_context')?.loseContext();

  html.classList.add('world-on');

  const root = document.createElement('div');
  root.className = 'film-hud';
  root.innerHTML = `
    <div class="film-chap"><b class="film-n"></b><span class="film-zh"></span><span class="film-en"></span></div>
    <div class="film-year"><span class="film-num"></span><span class="film-cap"></span></div>
    <div class="film-labels"></div>`;
  const veil = document.createElement('div');
  veil.className = 'world-veil';
  stage.append(veil, root);
  const q = (c) => root.querySelector(c);
  const hud = { root, n: q('.film-n'), zh: q('.film-zh'), en: q('.film-en'), num: q('.film-num'), cap: q('.film-cap'), labels: q('.film-labels') };

  const start = () =>
    import('./engine.js')
      .then((m) => m.mountWorld(stage, { reduced, hud }))
      .catch((err) => {
        console.error('[world]', err);
        html.classList.add('world-fallback');
      });
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 });
  else setTimeout(start, 150);
}
