// 《訊號簡史》—— 背景場景。
//
// 全黑舞台,主體自己發光(沒有環境光撐場,靠 bloom)。一條訊號沿著 x 軸
// 從左跑到右,它的形狀就是故事:
//   原始雜訊 → 穿過真空管變成乾淨正弦 → 爬上五級證照台階 → 在六個 AI 節點
//   之間跳成金線拱橋 → 走過三塊晶片(三個作品)→ 分裂成諧波(遊戲與音樂)
//   → 扇出到 16 顆核心再收回 → 通過透鏡,變成一道紫色光束。
// 色溫就是時間軸:左邊是鎢絲琥珀,越往右越冷,最後是紫光。
// 結尾攝影機拉到很遠,整條訊號一次看完 —— 像一張示波器上的履歷。

import * as THREE from 'three';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { STOP_X, PALETTES, DEFAULT_PALETTE } from './palettes.js';

// ---------- 場景在 x 軸上的位置 ----------
export const X = {
  start: -34, inlet: -1.3, outlet: 1.3,
  stairs0: 22, stairStep: 4.4,
  ai0: 51, aiStep: 3,
  dieA: 86, dieB: 98, dieC: 110, dieHalf: 2.5,
  play0: 128, play1: 146,
  rig: 158, lamp: 182, end: 262,
};
const STEPS = 5;

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- 色溫:x → 顏色。由目前的色票決定(palettes.js),換色票時整個世界跟著換 ----------
const STOPS = STOP_X.map(() => new THREE.Color());
const METAL = new THREE.Color();
export const WHITE = new THREE.Color(1, 1, 1);
export function paletteColors(key) {
  const P = PALETTES[key] || PALETTES[DEFAULT_PALETTE];
  return { stops: P.stops.map((h) => new THREE.Color(h)), metal: new THREE.Color(P.metal) };
}
export function setPaletteColors({ stops, metal }) {
  stops.forEach((c, i) => STOPS[i].copy(c));
  METAL.copy(metal);
}
setPaletteColors(paletteColors(DEFAULT_PALETTE));
export const paletteStops = STOPS; // city.js 直接把它當 uniform 陣列用
export const metalColor = (out = new THREE.Color()) => out.copy(METAL);
export function eraColor(x, out = new THREE.Color()) {
  if (x <= STOP_X[0]) return out.copy(STOPS[0]);
  for (let i = 0; i < STOP_X.length - 1; i++) {
    if (x <= STOP_X[i + 1]) return out.copy(STOPS[i]).lerp(STOPS[i + 1], (x - STOP_X[i]) / (STOP_X[i + 1] - STOP_X[i]));
  }
  return out.copy(STOPS[STOPS.length - 1]);
}

// ---------- 訊號的形狀:y(x)。原始雜訊那段另外處理(會隨時間抖動) ----------
const stairTop = (i) => 0.55 * (i + 1);
function stairsY(x) {
  let y = 0;
  for (let i = 0; i < STEPS; i++) {
    const left = X.stairs0 + i * X.stairStep - X.stairStep / 2;
    y += sstep(left - 0.35, left + 0.35, x) * 0.55;
  }
  const last = X.stairs0 + (STEPS - 1) * X.stairStep + X.stairStep / 2;
  return (y + 0.28) * (1 - sstep(last + 0.4, last + 8, x));
}
const arc = (x, a, b, h) => (x > a && x < b ? Math.sin(((x - a) / (b - a)) * Math.PI) * h : 0);
export function signalY(x) {
  if (x < X.outlet) return 0;
  // 真空管出口:乾淨的正弦
  let y = 0.55 * Math.sin(((x - X.outlet) / 3.2) * Math.PI * 2) * sstep(X.outlet, 3, x) * (1 - sstep(13, 18, x));
  // 證照台階
  if (x > 17 && x < 52) y += stairsY(x);
  // AI:節點之間的金線拱橋
  const aiEnd = X.ai0 + 5 * X.aiStep;
  if (x >= X.ai0 && x <= aiEnd) {
    const k = Math.min(4, Math.floor((x - X.ai0) / X.aiStep));
    y += arc(x, X.ai0 + k * X.aiStep, X.ai0 + (k + 1) * X.aiStep, 1.35);
  }
  // 晶片:走過晶片表面,晶片之間拉起打線
  const dies = [X.dieA, X.dieB, X.dieC];
  const onDie = 0.2;
  if (x > aiEnd && x < X.dieC + X.dieHalf + 6) {
    let d = onDie * sstep(aiEnd, X.dieA - X.dieHalf, x);
    for (let i = 0; i < 2; i++) d += arc(x, dies[i] + X.dieHalf, dies[i + 1] - X.dieHalf, 2.0);
    y += d * (1 - sstep(X.dieC + X.dieHalf, X.dieC + X.dieHalf + 6, x));
  }
  // 遊戲與音樂:頻率越來越快的 chirp
  if (x > 116 && x < 152) {
    const base = 0.8 * sstep(116, 126, x) * (1 - sstep(X.play1, 152, x));
    const env = sstep(X.play0, X.play0 + 2, x) * (1 - sstep(X.play1 - 2, X.play1, x));
    const p = x - X.play0;
    y += base + 0.62 * env * Math.sin(p * (1.1 + p * 0.09));
  }
  // 核心陣列:貼著晶片表面
  if (x >= 150 && x < 172) y += 0.25 * sstep(150, 152, x) * (1 - sstep(166, 172, x));
  // 透鏡 → 光束
  if (x >= 168 && x < X.lamp) y += 1.25 * sstep(168, X.lamp - 1.5, x);
  if (x >= X.lamp) y += 1.25 + (x - X.lamp) * 0.055;
  return y;
}
export const signalPoint = (x, out = new THREE.Vector3()) => out.set(x, signalY(x), 0);

// 原始雜訊:幾個不相干的正弦疊加 + 時間 —— 看起來像靜電
export function noiseY(x, t) {
  const env = sstep(X.start, X.start + 6, x) * (1 - sstep(-5.5, X.inlet, x));
  const n = Math.sin(x * 7.3 + t * 11.0) * 0.32 + Math.sin(x * 13.1 - t * 17.0) * 0.22 +
    Math.sin(x * 2.1 + t * 3.1) * 0.35 + Math.sin(x * 29.7 + t * 23.0) * 0.12;
  return n * env * 1.05;
}

// ---------- 材質 ----------
// 玻璃:只畫邊緣(菲涅耳),加法混色 —— 黑底上的玻璃本來就只看得到輪廓的反光
export function glassMat(color, strength = 1.4, power = 2.6) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uStr: { value: strength }, uPow: { value: power } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uStr; uniform float uPow; varying vec3 vN; varying vec3 vV;
      void main(){
        // 兩道防線,少一道都會出事:法線長度為 0(車床幾何的極點)normalize 會得 NaN;
        // 1-|dot| 在浮點誤差下可能是極小的負數,pow(負數) 也是 NaN。
        // NaN 一旦進了 bloom 的模糊金字塔,就會擴散成一整塊黑色方塊。
        float ln = length(vN);
        vec3 n = ln > 1e-5 ? vN / ln : vec3(0.0, 0.0, 1.0);
        float f = pow(clamp(1.0 - abs(dot(n, normalize(vV))), 0.0, 1.0), uPow);
        gl_FragColor = vec4(uColor * f * uStr, f);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}
// 自發光(HDR,讓 bloom 抓得到)
export const glow = (hex, k = 2.5) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: true });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x15121b, metalness: 0.75, roughness: 0.32 });
const darkPlate = new THREE.MeshStandardMaterial({ color: 0x0f0d14, metalness: 0.4, roughness: 0.55 });

function segLines(pairs, color, k = 1.8, opacity = 1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pairs, 3));
  const m = new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  return new THREE.LineSegments(g, m);
}
function rectPairs(x0, z0, x1, z1, y) {
  return [x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0];
}
function circlePairs(cx, cz, r, y, n = 48, a0 = 0, a1 = Math.PI * 2) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, b = a0 + ((a1 - a0) * (i + 1)) / n;
    out.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, cx + Math.cos(b) * r, y, cz + Math.sin(b) * r);
  }
  return out;
}
export function fatLine(points, colorFn, width, { opacity = 1, k = 2.2 } = {}) {
  const pos = [], col = [];
  const c = new THREE.Color();
  for (const p of points) {
    pos.push(p.x, p.y, p.z);
    colorFn(p, c);
    col.push(c.r * k, c.g * k, c.b * k);
  }
  const g = new LineGeometry();
  g.setPositions(pos);
  g.setColors(col);
  const m = new LineMaterial({ linewidth: width, vertexColors: true, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, worldUnits: false });
  const l = new Line2(g, m);
  l.frustumCulled = false;
  l.userData.pts = points;
  return l;
}
// 就地重寫線的顏色(不重建幾何):LineGeometry 每一段存 [起點色, 終點色]
export function paintLine(l, colorFn, k) {
  const pts = l.userData.pts;
  const buf = l.geometry.attributes.instanceColorStart.data;
  const arr = buf.array;
  const c = new THREE.Color();
  let pr = 0, pg = 0, pb = 0;
  for (let i = 0; i < pts.length; i++) {
    colorFn(pts[i], c);
    const r = c.r * k, g = c.g * k, b = c.b * k;
    if (i > 0) { const o = (i - 1) * 6; arr[o] = pr; arr[o + 1] = pg; arr[o + 2] = pb; arr[o + 3] = r; arr[o + 4] = g; arr[o + 5] = b; }
    pr = r; pg = g; pb = b;
  }
  buf.needsUpdate = true;
}
const tint = (x, k, mixWhite = 0, out = new THREE.Color()) => eraColor(x, out).lerp(WHITE, mixWhite).multiplyScalar(k);

// =====================================================================
export function buildFilm({ mobile = false } = {}) {
  const root = new THREE.Group();
  const anim = {};
  const labels = []; // { pos, zh, en, s0, s1 }
  const recolor = []; // 換色票時,依序重新上色

  // (地面、方塊、走線由 city.js 的晶片城市負責)

  // ---- 01 真空管:雜訊從左邊進來,右邊出來是乾淨的正弦 ----
  {
    const g = new THREE.Group();
    const prof = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const y = -1.35 + t * 3.1;
      const r = 1.18 * Math.sin(Math.pow(t, 0.8) * Math.PI) * (t < 0.12 ? 0.62 + t * 3.2 : 1) + (t > 0.95 ? 0 : 0.02);
      prof.push(new THREE.Vector2(Math.max(0.05, r), y));
    }
    const bulb = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), glassMat(0xffc27a, 1.6, 2.4));
    recolor.push(() => tint(2, 1, 0.25, bulb.material.uniforms.uColor.value));
    g.add(bulb);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.45, 36, 1, true, 0.5, 4.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb35c).multiplyScalar(0.55), transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    plate.position.y = 0.15;
    g.add(plate);
    recolor.push(() => tint(0, 0.55, 0, plate.material.color));
    // 燈絲:一個細細的倒 U
    const fil = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI;
      fil.push(new THREE.Vector3(Math.cos(a) * 0.22, 0.12 + Math.sin(a) * 0.9 - 0.55, 0));
    }
    const filament = fatLine(fil, (p, c) => c.setHex(0xffe2a8), mobile ? 2.2 : 3, { k: 6 });
    g.add(filament);
    recolor.push(() => paintLine(filament, (p, c) => tint(0, 1, 0.6, c), 6));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.55, 24), darkMetal);
    cap.position.y = -1.55;
    g.add(cap);
    const ringMat = glow(0xffb35c, 0.9);
    recolor.push(() => tint(0, 0.9, 0, ringMat.color));
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.025, 6, 32), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -1.72 + i * 0.12;
      g.add(ring);
    }
    g.position.set(0, 0.25, 0);
    root.add(g);
    anim.filament = filament;
    anim.plate = plate;
    labels.push({ pos: new THREE.Vector3(-12, 1.6, 0), zh: '輸入 · 原始訊號', en: 'INPUT · RAW SIGNAL', s0: -1, s1: 1.4 });
    labels.push({ pos: new THREE.Vector3(9, 1.5, 0), zh: '輸出 · 乾淨訊號', en: 'OUTPUT · CLEAN SIGNAL', s0: 0.5, s1: 1.6 });
  }

  // ---- 02 證照台階:五塊玻璃板,頂邊發光,一年比一年高 ----
  const CERT = [['電腦硬體裝修', '2024'], ['工業電子', '2024'], ['數位電子', '2025'], ['資安實務挑戰賽', '2025.05'], ['iPAS AI 應用規劃師', '2025.12']];
  anim.steps = [];
  for (let i = 0; i < STEPS; i++) {
    const x = X.stairs0 + i * X.stairStep;
    const h = stairTop(i) + 1.6; // 從網格面(-1.6)長上來
    const w = X.stairStep - 0.5, d = 3.2;
    const c = eraColor(x);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat(c.getHex(), 0.9, 3.2));
    slab.position.set(x, -1.6 + h / 2, 0);
    root.add(slab);
    const top = stairTop(i);
    const edge = segLines(rectPairs(x - w / 2, -d / 2, x + w / 2, d / 2, top), c.getHex(), 3.2);
    root.add(edge);
    recolor.push(() => { tint(x, 1, 0, slab.material.uniforms.uColor.value); tint(x, 3.2, 0, edge.material.color); });
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), glow(0xffffff, 3));
    node.position.set(x, top + 0.28, 0);
    root.add(node);
    anim.steps.push({ edge, node, x });
    labels.push({ pos: new THREE.Vector3(x, top + 1.05, 0), zh: CERT[i][0], en: CERT[i][1], s0: 1.45, s1: 2.6, small: true });
  }

  // ---- 03 AI:六個節點坐在基板上,訊號在它們之間跳成金線拱橋;後方的打線連到中樞 ----
  {
    const TOOLS = [['Claude', 0xff8a65], ['ChatGPT', 0x74d7a8], ['Gemini', 0x7fb2ff], ['Higgsfield', 0xd6f06a], ['Hermes', 0xb89bff], ['OpenClaw', 0xff6f61]];
    const x0 = X.ai0 - 2.5, x1 = X.ai0 + 5 * X.aiStep + 2.5;
    const base = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.22, 6.5), darkPlate);
    base.position.set((x0 + x1) / 2, -0.12, -1.2);
    root.add(base);
    const aiRect = segLines(rectPairs(x0, -4.45, x1, 2.05, 0.0), 0xff9ebd, 1.4, 0.8);
    root.add(aiRect);
    recolor.push(() => tint(58, 1.4, 0, aiRect.material.color));
    const hub = new THREE.Vector3((x0 + x1) / 2, 0, -3.3);
    // 中樞:一塊暗色晶片 + 發光外框(整塊發白會把畫面炸掉)
    const hubM = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 1.2), darkMetal);
    hubM.position.copy(hub).setY(0.1);
    root.add(hubM);
    const hubEdge = segLines(rectPairs(hub.x - 1.1, hub.z - 0.6, hub.x + 1.1, hub.z + 0.6, 0.27), 0xffd9e6, 2.2);
    root.add(hubEdge);
    recolor.push(() => tint(58, 2.2, 0.5, hubEdge.material.color));
    anim.aiNodes = [];
    TOOLS.forEach(([name, col], i) => {
      const x = X.ai0 + i * X.aiStep;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20), glow(col, 1.6));
      pad.position.set(x, 0.02, 0);
      root.add(pad);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), glow(col, 4));
      core.position.set(x, 0.24, 0);
      root.add(core);
      anim.aiNodes.push(core);
      // 打線:節點 → 中樞,拱起來的金線
      const pts = [];
      for (let j = 0; j <= 32; j++) {
        const t = j / 32;
        pts.push(new THREE.Vector3(x + (hub.x - x) * t, 0.1 + Math.sin(t * Math.PI) * (1.1 + (i % 3) * 0.25), 0 + (hub.z - 0) * t));
      }
      const bond = fatLine(pts, (p, c) => c.setHex(0xf6c56b), mobile ? 1.2 : 1.6, { k: 1.8, opacity: 0.9 });
      root.add(bond);
      recolor.push(() => paintLine(bond, (p, c) => metalColor(c), 1.8));
      labels.push({ pos: new THREE.Vector3(x, -0.55, 0.9), zh: name, en: '', s0: 2.5, s1: 3.6, small: true, col });
    });
  }

  // ---- 04 三塊晶片 = 三個作品。每塊的電路紋路不一樣 ----
  const DIE = [
    { x: X.dieA, zh: 'iPAS 備考學院', en: 'IPAS.TUN9I.COM', kind: 'rows' },
    { x: X.dieB, zh: 'AgentAQI', en: 'AIR QUALITY · AGENT', kind: 'rings' },
    { x: X.dieC, zh: 'Vision Nav', en: 'AR NAVIGATION', kind: 'radar' },
  ];
  anim.dies = [];
  DIE.forEach((D, di) => {
    const s = X.dieHalf * 2;
    const c = eraColor(D.x);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(s + 1.4, 0.3, s + 1.4), darkMetal);
    plate.position.set(D.x, -0.2, 0);
    root.add(plate);
    const die = new THREE.Mesh(new THREE.BoxGeometry(s, 0.12, s), darkPlate);
    die.position.set(D.x, 0.0, 0);
    root.add(die);
    const y = 0.07;
    const pairs = [];
    pairs.push(...rectPairs(D.x - s / 2, -s / 2, D.x + s / 2, s / 2, y));
    if (D.kind === 'rows') {
      for (let r = 0; r < 8; r++) {
        const z = -1.8 + r * 0.5, len = 2.2 + ((r * 37) % 7) * 0.25;
        pairs.push(D.x - 1.9, y, z, D.x - 1.9 + len, y, z);
        pairs.push(D.x + 1.3, y, z - 0.12, D.x + 1.5, y, z + 0.1, D.x + 1.5, y, z + 0.1, D.x + 1.85, y, z - 0.22);
      }
    } else if (D.kind === 'rings') {
      for (let r = 1; r <= 4; r++) pairs.push(...circlePairs(D.x, 0, r * 0.48, y, 40));
      for (let b = 0; b < 9; b++) pairs.push(D.x - 2.0 + b * 0.5, y, 2.1, D.x - 2.0 + b * 0.5, y, 2.1 - (0.3 + ((b * 5) % 4) * 0.2));
    } else {
      for (let r = 1; r <= 4; r++) pairs.push(...circlePairs(D.x, 0, r * 0.5, y, 40, Math.PI * 1.05, Math.PI * 1.95));
      pairs.push(D.x - 2.1, y, 0.4, D.x + 2.1, y, 0.4);
    }
    const traces = segLines(pairs, c.getHex(), 2.4);
    root.add(traces);
    recolor.push(() => tint(D.x, 2.4, 0, traces.material.color));
    // 四周的焊墊
    const padM = glow(0xf6c56b, 0.42);
    recolor.push(() => metalColor(padM.color).multiplyScalar(0.42));
    const padG = new THREE.BoxGeometry(0.26, 0.05, 0.26);
    for (let k = 0; k < 7; k++) {
      const t = -s / 2 + 0.45 + k * ((s - 0.9) / 6);
      for (const [px, pz] of [[t, -s / 2 - 0.42], [t, s / 2 + 0.42], [-s / 2 - 0.42, t], [s / 2 + 0.42, t]]) {
        const p = new THREE.Mesh(padG, padM);
        p.position.set(D.x + px, -0.03, pz);
        root.add(p);
      }
    }
    let sweep = null;
    if (D.kind === 'radar') {
      sweep = segLines([0, 0, 0, 2.1, 0, 0], 0xc9b8ff, 4);
      sweep.position.set(D.x, y + 0.01, 0);
      root.add(sweep);
      recolor.push(() => tint(D.x, 4, 0.4, sweep.material.color));
    }
    anim.dies.push({ traces, sweep, x: D.x });
    labels.push({ pos: new THREE.Vector3(D.x, 0.2, -X.dieHalf - 1.2), zh: D.zh, en: D.en, s0: 3.4 + di, s1: 4.6 + di });
  });

  // ---- 05 諧波:訊號分裂成幾道不同頻率的波;下方是跳動的等化器 ----
  {
    const harm = [];
    [[-1.6, 1.9, 0xff9ec8], [1.4, 2.6, 0xb69cff], [-3.0, 3.4, 0x8fb8ff]].forEach(([z, f, col], hi) => {
      const pts = [];
      for (let x = X.play0; x <= X.play1; x += 0.05) {
        const env = sstep(X.play0, X.play0 + 3, x) * (1 - sstep(X.play1 - 3, X.play1, x));
        pts.push(new THREE.Vector3(x, 0.8 + Math.sin((x - X.play0) * f + hi) * 0.45 * env, z));
      }
      const hl = fatLine(pts, (p, c) => c.setHex(col), mobile ? 1.4 : 2, { k: 2, opacity: 0.85 });
      const hx = [70, 137, 215][hi]; // 三道諧波各取色票的不同段,同一組色票裡也有三種顏色
      recolor.push(() => paintLine(hl, (p, c) => tint(hx, 1, 0.1, c), 2));
      harm.push(hl);
    });
    harm.forEach((h) => root.add(h));
    const N = 22;
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 1, 0.22), glow(0xb69cff, 0.38), N);
    for (let i = 0; i < N; i++) bars.setMatrixAt(i, new THREE.Matrix4().makeTranslation(X.play0 + 1 + i * 0.8, 0, -5));
    recolor.push(() => tint(137, 0.38, 0, bars.material.color));
    root.add(bars);
    anim.bars = { mesh: bars, N };
    labels.push({ pos: new THREE.Vector3(X.play0 + 3, 2.2, -1.6), zh: '遊戲', en: 'GAMES · APEX / 原神 / SF6', s0: 5.6, s1: 7.6, small: true });
    labels.push({ pos: new THREE.Vector3(X.play1 - 4, 2.1, 1.4), zh: '音樂', en: 'MUSIC · J-POP / HOYO-MiX', s0: 5.6, s1: 7.6, small: true });
  }

  // ---- 06 16 顆核心:訊號扇出到每一顆,再收回來 ----
  {
    const cx = X.rig, S = 8;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(S + 1.6, 0.3, S + 1.6), darkMetal);
    plate.position.set(cx, -0.25, 0);
    root.add(plate);
    const rigRect = segLines(rectPairs(cx - S / 2, -S / 2, cx + S / 2, S / 2, -0.05), 0x8d6cff, 1.8);
    root.add(rigRect);
    recolor.push(() => tint(cx, 1.8, 0, rigRect.material.color));
    const cores = new THREE.InstancedMesh(new THREE.BoxGeometry(1.35, 0.14, 1.35), new THREE.MeshBasicMaterial({ color: 0xffffff }), 16);
    const fan = [];
    const inX = cx - S / 2 - 1.2, outX = cx + S / 2 + 1.2;
    for (let i = 0; i < 16; i++) {
      const gx = cx - 2.7 + (i % 4) * 1.8, gz = -2.7 + Math.floor(i / 4) * 1.8;
      cores.setMatrixAt(i, new THREE.Matrix4().makeTranslation(gx, 0.02, gz));
      cores.setColorAt(i, new THREE.Color(0x8d6cff));
      fan.push(inX, 0.25, 0, gx, 0.1, gz, gx, 0.1, gz, outX, 0.25, 0);
    }
    root.add(cores);
    const fanLines = segLines(fan, 0xa487ff, 1.1, 0.5);
    root.add(fanLines);
    recolor.push(() => tint(170, 1.1, 0, fanLines.material.color));
    anim.cores = cores;
    labels.push({ pos: new THREE.Vector3(cx - 2.7, 0.6, -4.8), zh: '16 核心', en: 'RYZEN 9 9950X3D', s0: 6.6, s1: 8.6 });
    labels.push({ pos: new THREE.Vector3(cx + 2.9, 0.6, 4.8), zh: '32 執行緒 · 64GB', en: 'RTX 5080 · DDR5-6000', s0: 6.6, s1: 8.6, small: true });
  }

  // ---- 07 透鏡 → 光束 ----
  {
    const lx = X.lamp, ly = 1.25;
    const lens = new THREE.Mesh(new THREE.SphereGeometry(1.25, 40, 24), glassMat(0xb69cff, 1.8, 2.2));
    lens.scale.set(0.32, 1, 1);
    lens.position.set(lx, ly, 0);
    root.add(lens);
    recolor.push(() => tint(lx, 1, 0.15, lens.material.uniforms.uColor.value));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.05, 8, 64), glow(0xa487ff, 2.2));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(lx, ly, 0);
    root.add(ring);
    recolor.push(() => tint(190, 2.2, 0, ring.material.color));
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, ly + 1.6, 10), darkMetal);
    mount.position.set(lx, (ly - 1.6) / 2, 0);
    root.add(mount);
    // 光束的柔光:沿光束方向的半透明圓錐
    const len = X.end - lx;
    const bg = new THREE.CylinderGeometry(0.55, 0.12, len, 24, 1, true);
    bg.rotateZ(-Math.PI / 2);
    bg.translate(len / 2, 0, 0);
    const beamGlow = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8d6cff).multiplyScalar(0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beamGlow.position.set(lx, ly, 0);
    beamGlow.rotation.z = Math.atan(0.055);
    root.add(beamGlow);
    recolor.push(() => tint(175, 0.9, 0, beamGlow.material.color));
    anim.beamGlow = beamGlow;
    labels.push({ pos: new THREE.Vector3(lx + 7, ly + 2.2, 0), zh: '訊號送出', en: 'SIGNAL OUT · TUN9I.COM', s0: 8.4, s1: 10.2 });
  }

  // ---- 大氣:每個時代後面一團有色的霧光 ----
  {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    anim.softTex = tex;
    for (const [hx, s, k] of [[-12, 34, 0.14], [2, 18, 0.2], [31, 30, 0.12], [58, 30, 0.14], [98, 44, 0.12], [137, 30, 0.12], [158, 30, 0.13], [186, 40, 0.18], [230, 60, 0.1]]) {
      const m = new THREE.SpriteMaterial({ map: tex, color: eraColor(hx).multiplyScalar(k), blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(m);
      sp.scale.set(s, s * 0.6, 1);
      sp.position.set(hx, 1, -18);
      root.add(sp);
      recolor.push(() => tint(hx, k, 0, m.color));
    }
  }

  // ---- 浮塵(近的大而糊 = 假景深) ----
  {
    const N = mobile ? 260 : 520;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    let a = 11;
    const rnd = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    const cc = new THREE.Color();
    const bright = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = -40 + rnd() * 310;
      pos.set([x, -3 + rnd() * 12, -22 + rnd() * 30], i * 3);
      bright[i] = 0.5 + rnd() * 0.8;
    }
    const paintDust = () => {
      for (let i = 0; i < N; i++) {
        tint(pos[i * 3], bright[i], 0.4, cc);
        col.set([cc.r, cc.g, cc.b], i * 3);
      }
    };
    paintDust();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, sizeAttenuation: true, map: anim.softTex, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    root.add(dust);
    anim.dust = dust;
    recolor.push(() => { paintDust(); g.attributes.color.needsUpdate = true; });
  }

  return { root, anim, labels, recolor };
}
