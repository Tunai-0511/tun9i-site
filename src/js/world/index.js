// 《訊號簡史》的入口 —— 很輕,真正的 three.js 引擎延遲載入。
//
// 有 WebGL、而且沒有要求減少動態時,整個網站變成一部可以捲動的 3D 短片(engine.js),
// 內容刻在場景裡。否則維持原本的卡片版面(world-fallback),內容一樣完整。
// 引擎(three.js + 後製 + 場景)自成一個 chunk,瀏覽器閒下來才載入。
//
// HUD(紀錄片式的章節編號、右上大字)在這裡建好,交給引擎更新。

export function initWorld({ reduced = false } = {}) {
  const stage = document.getElementById('bg-stage');
  if (!stage) return;

  const html = document.documentElement;
  // 一路鑽進去、一路拉出來的鏡頭對前庭敏感的人不友善 → 減少動態時直接用卡片版面
  if (reduced) { html.classList.add('world-fallback'); return; }
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2');
  if (!gl) { html.classList.add('world-fallback'); return; }
  gl.getExtension('WEBGL_lose_context')?.loseContext();

  html.classList.add('world-on');

  const root = document.createElement('div');
  root.className = 'film-hud';
  root.innerHTML = `
    <div class="film-chap"><b class="film-n"></b><span class="film-zh"></span><span class="film-en"></span></div>
    <div class="film-year"><span class="film-num"></span><span class="film-cap"></span></div>
    <div class="film-caption" aria-hidden="true"></div>`;
  stage.append(root);
  const q = (c) => root.querySelector(c);
  const hud = { root, n: q('.film-n'), zh: q('.film-zh'), en: q('.film-en'), num: q('.film-num'), cap: q('.film-cap'), caption: q('.film-caption') };

  const fail = (err) => {
    console.error('[world]', err);
    html.classList.remove('world-on');
    html.classList.add('world-fallback');
    root.remove();
  };
  const start = () => import('./engine.js').then((m) => m.mountWorld(stage, { hud })).catch(fail);
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 800 });
  else setTimeout(start, 120);
}
