// 刻字系統 —— 網站的內容不是疊在畫面上的字卡,而是「刻」在場景裡的物件上。
//
// 每一塊刻字是一張貼在物件表面的平面:用 canvas 畫字 → 貼圖 → 自發光著色器。
// 它跟場景一起受透視、霧、bloom 與遮擋影響,所以看起來是雷射刻在金屬、矽晶或電路板上。
//   - uReveal:雷射掃過的進度(0 → 1),掃過的地方才有字,掃描線本身是一道亮邊
//   - 熱區(hot):可點的區域(連結)。游標移上去會亮,點下去開連結
// 文案一律從 i18n 的 t() 拿,切換語言時整批重畫。

import * as THREE from 'three';

export const FONTS = {
  sans: `'Space Grotesk', 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif`,
  serif: `'Playfair Display', 'Songti TC', 'Noto Serif TC', 'PMingLiU', serif`,
  body: `-apple-system, 'PingFang TC', 'Segoe UI', 'Microsoft JhengHei', 'Noto Sans TC', system-ui, sans-serif`,
  mono: `ui-monospace, 'SF Mono', Menlo, Consolas, monospace`,
};

// ---------- 換行:中日文逐字、英文逐詞;句讀不放行首 ----------
const CJK = /[⺀-鿿　-〿＀-￯぀-ヿ]/;
const NO_START = /^[，。、：；！？）」』〉》…—,.;:!?)\]]/;
function tokenize(str) {
  const out = [];
  let buf = '';
  for (const ch of str) {
    if (CJK.test(ch)) { if (buf) { out.push(buf); buf = ''; } out.push(ch); }
    else if (ch === ' ') { out.push(buf + ch); buf = ''; }
    else buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}

// ---------- 畫筆:座標用「世界單位」,左上角為原點、y 向下 ----------
function painter(block) {
  const { ctx, res } = block;
  const px = (v) => v * res;
  const setFont = (o) => {
    const size = o.size ?? 0.2;
    ctx.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 500} ${px(size)}px ${FONTS[o.font || 'sans']}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${px((o.spacing ?? 0) * size)}px`;
    ctx.fillStyle = o.color || '#fff';
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.textBaseline = o.baseline || 'alphabetic';
    ctx.textAlign = o.align || 'left';
  };
  const g = {
    block,
    w: block.w, h: block.h,
    measure(str, o = {}) { setFont(o); return ctx.measureText(str).width / res; },
    // o.maxW:單行字超過這個寬度就自動縮小(換語言、改文案都不會爆出物件邊緣)
    text(str, x, y, o = {}) {
      if (o.maxW) { setFont(o); const w = ctx.measureText(str).width / res; if (w > o.maxW) o = { ...o, size: (o.size ?? 0.2) * (o.maxW / w) }; }
      setFont(o);
      ctx.fillText(str, px(x), px(y));
      return ctx.measureText(str).width / res;
    },
    // 自動換行,回傳最後一行底下的 y
    wrap(str, x, y, maxW, o = {}) {
      setFont(o);
      const lh = (o.size ?? 0.2) * (o.lh ?? 1.55);
      const lines = [];
      let line = '';
      for (const tk of tokenize(String(str))) {
        const test = line + tk;
        if (line && ctx.measureText(test).width > px(maxW) && !NO_START.test(tk)) {
          lines.push(line.trimEnd());
          line = tk.trimStart();
        } else line = test;
      }
      if (line) lines.push(line);
      const max = o.maxLines ?? 99;
      lines.slice(0, max).forEach((l, i) => ctx.fillText(i === max - 1 && lines.length > max ? l.replace(/.$/, '…') : l, px(x), px(y + i * lh)));
      return y + Math.min(lines.length, max) * lh;
    },
    rule(x, y, w, o = {}) {
      ctx.globalAlpha = o.alpha ?? 0.5;
      ctx.fillStyle = o.color || '#fff';
      ctx.fillRect(px(x), px(y), px(w), Math.max(1, px(o.t ?? 0.012)));
    },
    rect(x, y, w, h, o = {}) {
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px(x), px(y), px(w), px(h), px(o.r ?? 0));
      else ctx.rect(px(x), px(y), px(w), px(h));
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = px(o.lw ?? 0.02); ctx.stroke(); }
    },
    circle(cx, cy, r, o = {}) {
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.beginPath();
      ctx.arc(px(cx), px(cy), px(r), 0, Math.PI * 2);
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = px(o.lw ?? 0.02); ctx.stroke(); }
    },
    image(img, x, y, w, h, o = {}) {
      if (!img || !img.complete || !img.naturalWidth) return;
      ctx.save();
      ctx.globalAlpha = o.alpha ?? 1;
      if (o.round != null) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px(x), px(y), px(w), px(h), px(o.round));
        else ctx.rect(px(x), px(y), px(w), px(h));
        ctx.clip();
      }
      // contain:保持比例置中
      const ar = img.naturalWidth / img.naturalHeight;
      let dw = w, dh = h;
      if (!o.cover) { if (ar > w / h) dh = w / ar; else dw = h * ar; }
      else { if (ar > w / h) dw = h * ar; else dh = w / ar; }
      ctx.drawImage(img, px(x + (w - dw) / 2), px(y + (h - dh) / 2), px(dw), px(dh));
      ctx.restore();
    },
    // 可點區域(世界單位的矩形)→ 存成 UV,給引擎做射線命中
    hot(x, y, w, h, href, label = '') {
      block.hits.push({ u0: x / block.w, u1: (x + w) / block.w, v0: 1 - (y + h) / block.h, v1: 1 - y / block.h, href, label });
    },
  };
  return g;
}

// ---------- 自發光刻字材質 ----------
const VERT = /* glsl */ `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uColor;
  uniform float uInt;
  uniform float uReveal;
  uniform vec4 uHot;
  uniform float uHotK;
  uniform float uTint;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    vec4 tx = texture2D(map, vUv);
    // 雷射由左往右掃(稍微斜一點比較像刀頭在走)
    float rx = vUv.x * 0.9 + (1.0 - vUv.y) * 0.1;
    float fr = uReveal * 1.12 - 0.06;
    float shown = 1.0 - smoothstep(fr - 0.025, fr, rx); // edge0 < edge1
    float live = step(0.002, uReveal) * (1.0 - step(0.998, uReveal));
    float edge = exp(-pow((rx - fr) * 42.0, 2.0)) * live;
    float hot = uHotK * step(uHot.x, vUv.x) * step(vUv.x, uHot.z) * step(uHot.y, vUv.y) * step(vUv.y, uHot.w);
    vec3 tint = mix(vec3(1.0), uColor, uTint);
    vec3 col = tx.rgb * tint * uInt * (1.0 + hot * 1.2) * shown + vec3(1.0, 0.96, 0.9) * edge * (0.35 + tx.a * 2.5);
    gl_FragColor = vec4(col, max(tx.a * shown, edge * 0.6));
    #include <fog_fragment>
  }`;

export function createEtcher({ renderer, mobile = false }) {
  const blocks = [];
  const maxTex = mobile ? 1536 : 2560;
  const aniso = renderer.capabilities.getMaxAnisotropy();

  function block({ w, h, res = 400, draw, color = new THREE.Color(1, 1, 1), intensity = 1, tint = 1, name = '' }) {
    const scale = Math.min(1, maxTex / Math.max(w * res, h * res)) * (mobile ? 0.8 : 1);
    const R = res * scale;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(4, Math.ceil(w * R));
    canvas.height = Math.max(4, Math.ceil(h * R));
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = aniso;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        map: { value: null }, uColor: { value: color }, uInt: { value: intensity * 0.82 }, uReveal: { value: 1 }, // 整體壓一級:再亮會被 bloom 暈成一團
        uHot: { value: new THREE.Vector4(-1, -1, -1, -1) }, uHotK: { value: 0 }, uTint: { value: tint },
      }]),
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    mat.uniforms.map.value = tex;
    mat.uniforms.uColor.value = color; // merge() 會複製,這裡接回同一個物件,換色票時才會連動
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.renderOrder = 5;
    const b = { name, w, h, res: R, canvas, ctx, tex, mat, mesh, draw, hits: [] };
    mesh.userData.etch = b;
    b.redraw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      b.hits.length = 0;
      draw(painter(b));
      ctx.globalAlpha = 1;
      tex.needsUpdate = true;
    };
    b.redraw();
    blocks.push(b);
    return b;
  }

  const redrawAll = () => blocks.forEach((b) => b.redraw());
  return { block, blocks, redrawAll };
}

// ---------- 圖片資產(logo、頭像):載好之後通知重畫 ----------
export function createAssets(onLoad) {
  const cache = new Map();
  const img = (src) => {
    if (cache.has(src)) return cache.get(src);
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => onLoad?.();
    im.src = src;
    cache.set(src, im);
    return im;
  };
  // 官方 logo 的 SVG 片段 → 圖片
  const svg = (brand, color) => {
    if (!brand) return null;
    const key = 'svg:' + brand.body.length + ':' + brand.viewBox + (color || '');
    if (cache.has(key)) return cache.get(key);
    const fill = brand.mono || color ? ` fill="${color || '#fff'}"` : '';
    const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${brand.viewBox}" width="512" height="512"${fill}>${brand.body}</svg>`;
    const im = new Image();
    im.onload = () => onLoad?.();
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    cache.set(key, im);
    return im;
  };
  return { img, svg };
}
