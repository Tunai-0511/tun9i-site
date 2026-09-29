// 零件庫 —— 所有場景共用的精細模型與材質。
//
// 原則:細節要多,但 draw call 要少 → 同一種小零件一律用 InstancedMesh(上千顆電容也只是一次繪製)。
// 幾何與貼圖都有快取,同樣尺寸的東西只建一次。新場景、新物件請優先從這裡拿零件,
// 這樣整部片的材質與比例會一致,也不用每次重寫。
//
// 單位:呼叫端自己決定(主機板用公分)。

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const geoCache = new Map();
const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
export function rng(seed = 1) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

// ---------- 程序貼圖 ----------
const texCache = new Map();
function canvasTex(key, w, h, draw, { srgb = false, repeat = null } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  texCache.set(key, t);
  return t;
}
// 拉絲金屬:橫向細紋(當粗糙度貼圖 + 凹凸貼圖)
export const brushedTex = (rep = [1, 1]) => canvasTex('brushed' + rep, 512, 512, (x, w, h) => {
  const r = rng(11);
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 2200; i++) { const g = 100 + r() * 90; x.fillStyle = `rgba(${g},${g},${g},${0.18 + r() * 0.25})`; x.fillRect(0, r() * h, w, 0.6 + r() * 1.4); }
}, { repeat: rep });
// 一般雜訊(粗糙度的細微變化,避免塑膠感)
export const noiseTex = (rep = [1, 1]) => canvasTex('noise' + rep, 256, 256, (x, w, h) => {
  const r = rng(5), d = x.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const g = 110 + r() * 80; d.data.set([g, g, g, 255], i * 4); }
  x.putImageData(d, 0, 0);
}, { repeat: rep });
// 六角形散熱孔(透明度貼圖)
export const ventTex = (rep = [1, 1]) => canvasTex('vent' + rep, 256, 256, (x, w, h) => {
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#000';
  const R = 11, dx = R * 1.8, dy = R * 1.56;
  for (let row = -1; row < h / dy + 1; row++) for (let col = -1; col < w / dx + 1; col++) {
    const cx = col * dx + (row % 2 ? dx / 2 : 0), cy = row * dy;
    x.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; x.lineTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78); }
    x.fill();
  }
}, { repeat: rep });

// ---------- 共用材質 ----------
export function materials() {
  const brushed = brushedTex([2, 2]), noise = noiseTex([3, 3]);
  return {
    alu: new THREE.MeshStandardMaterial({ color: 0x4a4e56, metalness: 1, roughness: 0.42, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.002 }),
    aluDark: new THREE.MeshStandardMaterial({ color: 0x24272d, metalness: 0.95, roughness: 0.4, roughnessMap: brushed }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8e949c, metalness: 1, roughness: 0.3, roughnessMap: noise }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd4a64a, metalness: 1, roughness: 0.28 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb4602a, metalness: 1, roughness: 0.35 }),
    solder: new THREE.MeshStandardMaterial({ color: 0xc0c4cb, metalness: 1, roughness: 0.25 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x16181d, metalness: 0.1, roughness: 0.6, roughnessMap: noise }),
    plasticGray: new THREE.MeshStandardMaterial({ color: 0x3a3d44, metalness: 0.1, roughness: 0.55 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0d0e11, metalness: 0, roughness: 0.9 }),
    chip: new THREE.MeshStandardMaterial({ color: 0x15171d, metalness: 0.3, roughness: 0.45, roughnessMap: noise }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0x8a6e4b, metalness: 0.1, roughness: 0.55 }),
    ferrite: new THREE.MeshStandardMaterial({ color: 0x2c2e33, metalness: 0.45, roughness: 0.5 }),
    substrate: new THREE.MeshStandardMaterial({ color: 0x0f2117, metalness: 0.15, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0c0f16, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }),
  };
}

// ---------- 幾何 ----------
export const rbox = (w, h, d, r = 0.04, seg = 2) => cached(`rb:${w}:${h}:${d}:${r}:${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)));
export const boxG = (w, h, d) => cached(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cylG = (r, h, seg = 16) => cached(`c:${r}:${h}:${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg));

export function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}
// 一堆同樣的東西:list = [[x,y,z, rotZ?, sx?, sy?, sz?], ...]
export function instances(geo, mat, list, parent) {
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((p, i) => {
    q.setFromEuler(new THREE.Euler(p[7] || 0, p[8] || 0, p[3] || 0));
    m4.compose(v.set(p[0], p[1], p[2]), q, sc.set(p[4] ?? 1, p[5] ?? 1, p[6] ?? 1));
    im.setMatrixAt(i, m4);
  });
  if (parent) parent.add(im);
  return im;
}

// ---------- 電路板上的小零件 ----------
// 表面黏著的電阻 / 電容(0402、0603):本體 + 兩端金屬。area = [x0,y0,x1,y1],板面朝 +z,z = 板面高度
export function smdField({ area, z, count, seed = 1, avoid = null, scale = 1, mats }, parent) {
  const r = rng(seed);
  const body = [], ends = [], dark = [];
  let tries = 0;
  while (body.length + dark.length < count && tries++ < count * 6) {
    const x = area[0] + r() * (area[2] - area[0]), y = area[1] + r() * (area[3] - area[1]);
    if (avoid && avoid(x, y)) continue;
    const big = r() < 0.3, L = (big ? 0.16 : 0.1) * scale, Wd = L * 0.5, rot = r() < 0.5 ? 0 : Math.PI / 2;
    const list = r() < 0.55 ? body : dark;
    list.push([x, y, z + Wd * 0.3, rot, L * 0.7, Wd, Wd * 0.6]);
    const cx = Math.cos(rot) * L * 0.42, cy = Math.sin(rot) * L * 0.42;
    ends.push([x + cx, y + cy, z + Wd * 0.3, rot, L * 0.16, Wd * 1.02, Wd * 0.62], [x - cx, y - cy, z + Wd * 0.3, rot, L * 0.16, Wd * 1.02, Wd * 0.62]);
  }
  const g = new THREE.Group();
  const unit = boxG(1, 1, 1);
  if (body.length) instances(unit, mats.ceramic, body, g);
  if (dark.length) instances(unit, mats.chip, dark, g);
  if (ends.length) instances(unit, mats.solder, ends, g);
  if (parent) parent.add(g);
  return g;
}
// 電解電容(鋁殼 + 頂部十字刻痕):站在板面上(軸朝 +z)
export function capCans(list, { r = 0.3, h = 0.8, mats }, parent) {
  const g = new THREE.Group();
  const can = cylG(r, h, 20);
  const top = cached(`captop:${r}`, () => {
    const s = new THREE.Shape(); s.absarc(0, 0, r * 0.98, 0, Math.PI * 2);
    const geo = new THREE.ShapeGeometry(s, 20);
    return geo;
  });
  const rotX = Math.PI / 2;
  instances(can, mats.alu, list.map(([x, y, z]) => [x, y, z + h / 2, 0, 1, 1, 1, rotX]), g);
  instances(top, mats.steel, list.map(([x, y, z]) => [x, y, z + h + 0.002]), g);
  // 刻痕:兩條交叉的細槽
  const groove = boxG(r * 1.5, r * 0.08, 0.01);
  instances(groove, mats.rubber, list.flatMap(([x, y, z]) => [[x, y, z + h + 0.004, 0], [x, y, z + h + 0.004, Math.PI / 2]]), g);
  if (parent) parent.add(g);
  return g;
}
// 電感(方形鐵氧體 + 頂部的標記)
export function chokes(list, { s = 0.9, h = 0.55, mats }, parent) {
  const g = new THREE.Group();
  instances(rbox(s, s, h, 0.06), mats.ferrite, list.map(([x, y, z]) => [x, y, z + h / 2]), g);
  instances(boxG(s * 0.5, s * 0.1, 0.01), mats.steel, list.map(([x, y, z]) => [x, y + s * 0.2, z + h + 0.004]), g);
  if (parent) parent.add(g);
  return g;
}
// MOSFET(小方塊 + 散熱墊)
export function mosfets(list, { s = 0.5, mats }, parent) {
  const g = new THREE.Group();
  instances(rbox(s, s, 0.12, 0.02), mats.chip, list.map(([x, y, z]) => [x, y, z + 0.06]), g);
  instances(boxG(s * 0.9, s * 0.25, 0.02), mats.solder, list.map(([x, y, z]) => [x, y - s * 0.6, z + 0.01]), g);
  if (parent) parent.add(g);
  return g;
}
// 排針(黑色塑膠座 + 金色針)
export function pinHeader({ x, y, z, cols, rows = 2, pitch = 0.254, h = 0.6, mats }, parent) {
  const g = new THREE.Group();
  mesh(boxG(cols * pitch, rows * pitch, 0.25), mats.plastic, x, y, z + 0.125, g);
  const pins = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) pins.push([x - (cols - 1) * pitch / 2 + c * pitch, y - (rows - 1) * pitch / 2 + r * pitch, z + h / 2]);
  instances(boxG(0.064, 0.064, h), mats.gold, pins, g);
  if (parent) parent.add(g);
  return g;
}
// 螺絲孔(金屬環 + 黑洞)
export function screwHoles(list, { r = 0.35, mats }, parent) {
  const g = new THREE.Group();
  const ring = cached(`ring:${r}`, () => { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2); const h = new THREE.Path(); h.absarc(0, 0, r * 0.5, 0, Math.PI * 2, true); s.holes.push(h); return new THREE.ShapeGeometry(s, 24); });
  const hole = cached(`hole:${r}`, () => new THREE.CircleGeometry(r * 0.5, 20));
  instances(ring, mats.gold, list.map(([x, y, z]) => [x, y, z + 0.002]), g);
  instances(hole, mats.rubber, list.map(([x, y, z]) => [x, y, z + 0.001]), g);
  if (parent) parent.add(g);
  return g;
}
// QFP / QFN 晶片:本體 + 四邊的腳
export function qfp({ x, y, z, s = 1, pins = 12, mats }, parent) {
  const g = new THREE.Group();
  mesh(rbox(s, s, 0.14, 0.02), mats.chip, x, y, z + 0.07, g);
  const L = [];
  const step = (s * 0.8) / pins;
  for (let i = 0; i < pins; i++) {
    const t = -s * 0.4 + step * (i + 0.5);
    L.push([x + t, y + s / 2 + 0.05, z + 0.02, 0, 0.05, 0.12, 0.03], [x + t, y - s / 2 - 0.05, z + 0.02, 0, 0.05, 0.12, 0.03]);
    L.push([x + s / 2 + 0.05, y + t, z + 0.02, 0, 0.12, 0.05, 0.03], [x - s / 2 - 0.05, y + t, z + 0.02, 0, 0.12, 0.05, 0.03]);
  }
  instances(boxG(1, 1, 1), mats.solder, L, g);
  // 第一腳圓點
  mesh(cylG(s * 0.05, 0.01, 12), mats.plasticGray, x - s * 0.32, y + s * 0.32, z + 0.145, g).rotation.x = Math.PI / 2;
  if (parent) parent.add(g);
  return g;
}
// 散熱鰭片陣列(沿 x 排,片面朝 x)
export function finArray({ x, y, z, w, h, d, count, t = 0.05, mat }, parent) {
  const list = [];
  for (let i = 0; i < count; i++) list.push([x - w / 2 + (w / (count - 1)) * i, y, z]);
  return instances(boxG(t, h, d), mat, list, parent);
}
// 熱導管
export function heatpipe(points, { r = 0.3, mat }, parent) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, r, 12, false), mat);
  if (parent) parent.add(m);
  return m;
}
// 風扇葉片:彎曲的扇葉(擠出一段弧形),count 片繞著 z 軸
export const bladeGeo = (R, hub, count, thick) => cached(`blade:${R}:${hub}:${count}:${thick}`, () => {
    const s = new THREE.Shape();
    const a0 = 0, a1 = ((Math.PI * 2) / count) * 0.8;
    const P2 = (r, a) => new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
    s.moveTo(P2(hub, a0).x, P2(hub, a0).y);
    for (let i = 0; i <= 12; i++) { const u = i / 12; const p = P2(hub + (R - hub) * u, a0 + u * 0.55); s.lineTo(p.x, p.y); }
    for (let i = 0; i <= 12; i++) { const u = 1 - i / 12; const p = P2(hub + (R - hub) * u, a1 + u * 0.35); s.lineTo(p.x, p.y); }
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -thick / 2);
    return g;
  });
export function fanBlades({ R = 4, hub = 1.1, count = 9, thick = 0.06, mat }) {
  const geo = cached(`blade:${R}:${hub}:${count}`, () => {
    const s = new THREE.Shape();
    const a0 = 0, a1 = ((Math.PI * 2) / count) * 0.8;
    const P = (r, a) => new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
    s.moveTo(P(hub, a0).x, P(hub, a0).y);
    for (let i = 0; i <= 12; i++) { const u = i / 12; const p = P(hub + (R - hub) * u, a0 + u * 0.55); s.lineTo(p.x, p.y); }
    for (let i = 0; i <= 12; i++) { const u = 1 - i / 12; const p = P(hub + (R - hub) * u, a1 + u * 0.35); s.lineTo(p.x, p.y); }
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -thick / 2);
    return g;
  });
  const list = [];
  for (let i = 0; i < count; i++) list.push([0, 0, 0, (i / count) * Math.PI * 2]);
  return instances(geo, mat, list);
}
// 發光燈條(RGB):一段自發光的細長方塊
export function lightStrip(w, h, d, color) {
  return new THREE.Mesh(boxG(w, h, d), new THREE.MeshBasicMaterial({ color }));
}

// =====================================================================
// 06 章(主機、桌面)與 07 章(城市)用到的零件
// =====================================================================
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// 胡桃木紋(桌面)
export const woodTex = (rep = [1, 1]) => canvasTex('wood' + rep, 1024, 256, (x, w, h) => {
  const r = rng(29);
  x.fillStyle = '#3a2618'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 180; i++) {
    const y0 = r() * h, amp = 2 + r() * 6, f = 0.004 + r() * 0.01, ph = r() * 6;
    x.strokeStyle = `rgba(${20 + r() * 30},${12 + r() * 16},${6 + r() * 10},${0.25 + r() * 0.35})`;
    x.lineWidth = 0.6 + r() * 2.2;
    x.beginPath();
    for (let px = 0; px <= w; px += 8) x.lineTo(px, y0 + Math.sin(px * f + ph) * amp + Math.sin(px * f * 3.1) * amp * 0.3);
    x.stroke();
  }
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(90,60,35,${0.05 + r() * 0.08})`; x.fillRect(0, r() * h, w, 1 + r() * 3); }
}, { srgb: true, repeat: rep });
// 編織套管(線材):斜向交叉紋,當凹凸 + 粗糙度貼圖
export const braidTex = (rep = [1, 30]) => canvasTex('braid' + rep, 64, 64, (x, w, h) => {
  x.fillStyle = '#777'; x.fillRect(0, 0, w, h);
  for (let i = -h; i < w + h; i += 8) {
    x.strokeStyle = '#bbb'; x.lineWidth = 3; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke();
    x.strokeStyle = '#444'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(i + h, 0); x.lineTo(i, h); x.stroke();
  }
}, { repeat: rep });
// 玻璃上的反光(幾道斜的柔光帶,疊在玻璃上用加法混色)
export const glassStreakTex = () => canvasTex('glassStreak', 512, 512, (x, w, h) => {
  x.clearRect(0, 0, w, h);
  const band = (cx, width, a) => {
    const g = x.createLinearGradient(cx - width, 0, cx + width, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.save(); x.translate(w / 2, h / 2); x.rotate(-0.55); x.translate(-w / 2, -h / 2);
    x.fillStyle = g; x.fillRect(cx - width, -h, width * 2, h * 3); x.restore();
  };
  band(150, 60, 0.18); band(250, 18, 0.12); band(360, 90, 0.08);
  const v = x.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255,255,255,0.05)'); v.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = v; x.fillRect(0, 0, w, h);
}, { srgb: true });

// RGB 光環材質:沿著角度流動的漸層(兩個顏色之間),時間讓它轉
export function rgbMat(U, colA, colB, { speed = 0.6, int = 1.2 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uA: { value: colA }, uB: { value: colB }, uInt: { value: int }, uSpeed: { value: speed }, uOn: { value: 1 } },
    vertexShader: `varying vec3 vP;
      void main(){
        vP = position;
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: `uniform float uTime, uInt, uSpeed, uOn; uniform vec3 uA, uB; varying vec3 vP;
      void main(){
        float a = atan(vP.y, vP.x);
        float k = 0.5 + 0.5 * sin(a * 2.0 + uTime * uSpeed * 6.2831);
        gl_FragColor = vec4(mix(uA, uB, k) * uInt * uOn, 1.0);
      }`,
  });
}

// 機殼風扇(12cm):圓角方框 + 四角螺絲孔與防震墊 + 霧面扇葉 + 馬達支架 + 前面一圈 RGB
// 面朝 +z;回傳 { g, spin, ring }
export function pcFan({ size = 12, mats, ringMat, depth = 2.5 }) {
  const g = new THREE.Group();
  const frameGeo = cached(`fanframe:${size}:${depth}`, () => {
    const s = new THREE.Shape();
    const h = size / 2, r = size * 0.1;
    s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
    s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
    const hole = new THREE.Path(); hole.absarc(0, 0, size * 0.47, 0, Math.PI * 2, true); s.holes.push(hole);
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = new THREE.Path(); p.absarc(cx * size * 0.435, cy * size * 0.435, size * 0.022, 0, Math.PI * 2, true); s.holes.push(p); }
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 40 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  });
  mesh(frameGeo, mats.fanFrame || mats.plastic, 0, 0, 0, g);
  // 四角的橡膠防震墊
  instances(cylG(size * 0.045, 0.3, 14), mats.rubber, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([cx, cy]) => [cx * size * 0.435, cy * size * 0.435, depth / 2 + 0.1, 0, 1, 1, 1, Math.PI / 2]), g);
  // 背面的馬達支架(四根)
  const strut = boxG(size * 0.42, 0.28, 0.35);
  instances(strut, mats.fanFrame || mats.plastic, [0, 1, 2, 3].map((i) => { const a = Math.PI / 4 + (i * Math.PI) / 2; return [Math.cos(a) * size * 0.26, Math.sin(a) * size * 0.26, -depth / 2 + 0.2, a]; }), g);
  const hub = mesh(cylG(size * 0.16, depth * 0.72, 32), mats.fanFrame || mats.plastic, 0, 0, 0, g);
  hub.rotation.x = Math.PI / 2;
  const spin = new THREE.Group();
  g.add(spin);
  spin.add(fanBlades({ R: size * 0.455, hub: size * 0.16, count: 9, thick: 0.08, mat: mats.blade || mats.plastic }));
  const cap = mesh(cylG(size * 0.155, 0.08, 32), mats.hubCap || mats.aluDark, 0, 0, depth * 0.37, spin);
  cap.rotation.x = Math.PI / 2;
  // RGB:外圈一道扁環 + 輪轂一圈
  const ring = new THREE.Mesh(cached(`fanring:${size}`, () => new THREE.TorusGeometry(size * 0.475, size * 0.012, 6, 96)), ringMat);
  ring.position.z = depth / 2 + 0.05;
  g.add(ring);
  const ring2 = new THREE.Mesh(cached(`fanring2:${size}`, () => new THREE.TorusGeometry(size * 0.165, size * 0.008, 6, 48)), ringMat);
  ring2.position.z = depth * 0.38;
  spin.add(ring2);
  return { g, spin, ring };
}

// 一束線材(編織套管):沿著路徑排成扁平的兩排,合併成一個幾何(一次繪製)
// points:路徑控制點;count:幾條;r:單條半徑
export function cableBundle(points, { count = 8, r = 0.16, rows = 2, mat, segs = 48 }) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3);
  const frames = curve.computeFrenetFrames(segs, false);
  const perRow = Math.ceil(count / rows);
  const geos = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow), col = i % perRow;
    const a = (col - (perRow - 1) / 2) * r * 2.1, b = (row - (rows - 1) / 2) * r * 2.1;
    const pts = [];
    for (let k = 0; k <= segs; k++) {
      const p = curve.getPointAt(k / segs);
      pts.push(p.clone().addScaledVector(frames.normals[k], b).addScaledVector(frames.binormals[k], a));
    }
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, r, 6, false));
  }
  const m = new THREE.Mesh(mergeGeometries(geos), mat);
  geos.forEach((g) => g.dispose());
  m.userData.curve = curve;
  return m;
}

// 一整組機殼風扇(同一種 12cm 風扇 × N 顆):框、墊片、支架、輪轂、燈環、扇葉各自一個 InstancedMesh,
// 十顆風扇也只要七次繪製。扇葉每幀依角度重算矩陣。poses:[{ p: Vector3, q: Quaternion }]
export function fanBank({ poses, size = 12, depth = 2.5, mats, ringMat }) {
  const g = new THREE.Group();
  const n = poses.length, h = size / 2, BL = 9;
  const frameGeo = cached(`fanframe:${size}:${depth}`, () => {
    const s = new THREE.Shape();
    const r = size * 0.1;
    s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
    s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
    const hole = new THREE.Path(); hole.absarc(0, 0, size * 0.47, 0, Math.PI * 2, true); s.holes.push(hole);
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = new THREE.Path(); p.absarc(cx * size * 0.435, cy * size * 0.435, size * 0.022, 0, Math.PI * 2, true); s.holes.push(p); }
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 40 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  });
  const M4 = new THREE.Matrix4(), L = new THREE.Matrix4(), S1 = new THREE.Vector3(1, 1, 1);
  const base = poses.map((P) => new THREE.Matrix4().compose(P.p, P.q, S1));
  const inst = (geo, mat, locals) => {
    const im = new THREE.InstancedMesh(geo, mat, n * locals.length);
    let k = 0;
    for (const B of base) for (const Lm of locals) im.setMatrixAt(k++, M4.multiplyMatrices(B, Lm));
    g.add(im);
    return im;
  };
  const T = (x, y, z, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), S1);
  inst(frameGeo, mats.fanFrame || mats.plastic, [new THREE.Matrix4()]);
  inst(cylG(size * 0.045, 0.3, 14), mats.rubber, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([cx, cy]) => T(cx * size * 0.435, cy * size * 0.435, depth / 2 + 0.1, Math.PI / 2)));
  inst(boxG(size * 0.42, 0.28, 0.35), mats.fanFrame || mats.plastic, [0, 1, 2, 3].map((i) => { const a = Math.PI / 4 + (i * Math.PI) / 2; return T(Math.cos(a) * size * 0.26, Math.sin(a) * size * 0.26, -depth / 2 + 0.2, 0, a); }));
  inst(cylG(size * 0.16, depth * 0.72, 32), mats.fanFrame || mats.plastic, [T(0, 0, 0, Math.PI / 2)]);
  inst(cylG(size * 0.155, 0.08, 32), mats.hubCap || mats.aluDark, [T(0, 0, depth * 0.37, Math.PI / 2)]);
  inst(cached(`fanring:${size}`, () => new THREE.TorusGeometry(size * 0.475, size * 0.012, 6, 96)), ringMat, [T(0, 0, depth / 2 + 0.05)]);
  inst(cached(`fanring2:${size}`, () => new THREE.TorusGeometry(size * 0.165, size * 0.008, 6, 48)), ringMat, [T(0, 0, depth * 0.38)]);
  const blades = new THREE.InstancedMesh(bladeGeo(size * 0.455, size * 0.16, BL, 0.08), mats.blade || mats.plastic, n * BL);
  g.add(blades);
  let ang = 0;
  const spin = (da) => {
    ang += da;
    let k = 0;
    for (let f = 0; f < n; f++) for (let b = 0; b < BL; b++) {
      L.makeRotationZ(ang * (f % 2 ? 1 : 1.07) + (b / BL) * Math.PI * 2);
      blades.setMatrixAt(k++, M4.multiplyMatrices(base[f], L));
    }
    blades.instanceMatrix.needsUpdate = true;
  };
  spin(0);
  return { g, spin };
}

// =====================================================================
// 效能:靜態合批
// =====================================================================
// 一個群組裡「之後不會再動」的網格,依材質合併成一個網格 —— 幾百次繪製變成十幾次,畫面完全一樣。
// 不會合併:InstancedMesh(本來就是一次繪製)、自訂著色器(刻字、RGB 光環:材質各自獨立)、
// 半透明材質(合併會改變排序)、鏡像(負縮放會翻面)、exclude() 指定的物件與它底下的東西(會動的零件)。
export function bakeStatic(root, { exclude = () => false } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];
  const excluded = (o) => { for (let p = o; p && p !== root; p = p.parent) if (exclude(p)) return true; return false; };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.visible || Array.isArray(o.material)) return;
    const m = o.material;
    if (m.isShaderMaterial || m.transparent || o.userData.etch || o.renderOrder) return;
    if (excluded(o)) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    if (rel.determinant() < 0) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    g.applyMatrix4(rel);
    if (!buckets.has(m.uuid)) buckets.set(m.uuid, { m, geos: [] });
    buckets.get(m.uuid).geos.push(g);
    victims.push(o);
  });
  for (const o of victims) o.parent.remove(o);
  let meshes = 0;
  for (const { m, geos } of buckets.values()) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (geos.length > 1) geos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, m);
    mesh.name = 'baked';
    root.add(mesh);
    meshes++;
  }
  return { merged: victims.length, into: meshes };
}
