// 00 開場 + 01 關於 —— 一顆 CPU。
//
// 開場:一團原始雜訊(粒子)聚合成這顆 CPU,雷射在頂蓋上刻出名字、頭像、數據與連結。
// 關於:晶片躺平、雷射從中間切開、前半塊掉出畫面 —— 剖面上刻著自我介紹;
//       接著各層往上分離(爆炸圖),每一層旁邊標著時間線。
// 之後鏡頭鑽進晶粒的剖面(02 歷程),再從晶粒表面鑽出來(03 AI 城市)。
//
// 座標:CPU 本地座標,頂蓋朝 +Y,底面中心在原點,單位公分。切面是 z = 0。
// 後半塊(z<0)是主角:它的切面朝 +z。

import * as THREE from 'three';
import { t } from '../../i18n.js';
import { era, eraSoft, metal, WHITE } from '../era.js';
import { makeSwarm } from '../particles.js';
import { TIMELINE } from '../../../data/world.js';
import * as P from '../parts.js';

// 各層高度(為了剖面讀得到字,比真的晶片厚)
const Y = { sub0: 0, sub1: 0.3, bump1: 0.36, die1: 0.62, tim1: 0.68, ihs1: 1.38 };
export const CPU_DIE_TOP = Y.die1;
const IHS_HALF = 1.7;
const DIES = [
  { x0: -0.85, x1: 0.85, z0: -0.62, z1: 0.62, main: true }, // 主晶粒:03 章的城市就蓋在它上面
  { x0: -1.55, x1: -1.05, z0: -0.5, z1: 0.5 },
  { x0: 1.05, x1: 1.55, z0: -0.5, z1: 0.5 },
];
// 爆炸圖:後半塊各層往上抬的距離
const EXPLODE = { bump: 0.12, die: 0.3, tim: 0.62, ihs: 1.0 };

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

// ---------- 頂蓋外形:圓角方形 + 左右兩個 AM5 式缺口,用多邊形表示 ----------
function ihsOutline() {
  const pts = [];
  const H = IHS_HALF, r = 0.22;
  const corner = (cx, cz, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } };
  // 逆時針:從右下角開始(x 右、z 前)
  corner(H - r, H - r, 0);            // 右前
  corner(-H + r, H - r, Math.PI / 2); // 左前
  // 左邊兩個缺口
  const notchL = (zc) => { pts.push([-H, zc + 0.28], [-H + 0.26, zc + 0.28], [-H + 0.26, zc - 0.28], [-H, zc - 0.28]); };
  notchL(0.95);
  notchL(-0.95);
  corner(-H + r, -H + r, Math.PI);    // 左後
  corner(H - r, -H + r, Math.PI * 1.5); // 右後
  const notchR = (zc) => { pts.push([H, zc - 0.28], [H - 0.26, zc - 0.28], [H - 0.26, zc + 0.28], [H, zc + 0.28]); };
  notchR(-0.95);
  notchR(0.95);
  // 左邊缺口的順序要跟著逆時針:上面 corner 左前 → 缺口(z 由大到小)→ 左後,已符合
  return pts;
}
// Sutherland–Hodgman:用 z<=0(back)或 z>=0(front)裁多邊形
function clipZ(poly, keepBack) {
  const inside = (p) => (keepBack ? p[1] <= 0 : p[1] >= 0);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) { const tt = a[1] / (a[1] - b[1]); out.push([a[0] + (b[0] - a[0]) * tt, 0]); }
  }
  return out;
}
// 多邊形(x,z)→ 往 +Y 擠出 height 的幾何
function extrudeXZ(poly, height, bevel = 0.02) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: height - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); // 形狀平面 → XZ,擠出方向 → +Y
  g.translate(0, bevel, 0);
  g.computeVertexNormals();
  return g;
}

// ---------- 剖面貼圖(canvas):每一層的材料長得不一樣 ----------
function sectionTexture(kind, wUnits, hUnits) {
  const res = 700;
  const W = Math.max(8, Math.round(wUnits * res)), H = Math.max(8, Math.round(hUnits * res));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  let s = kind.length * 97 + W;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const E = document.createElement('canvas'); // 自發光層:金屬線在剖面上微微發光
  E.width = W; E.height = H;
  const e = E.getContext('2d');
  if (kind === 'ihs') {
    // 鍍鎳銅:銅芯 + 上下兩道鎳皮 + 拉絲紋
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#3a2418'); gr.addColorStop(0.5, '#2c1a12'); gr.addColorStop(1, '#3a2418');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { x.globalAlpha = 0.05 + r() * 0.06; x.fillStyle = r() > 0.5 ? '#6b4430' : '#1a0f0a'; x.fillRect(0, r() * H, W, 1 + r() * 2); }
    x.globalAlpha = 1;
    x.fillStyle = '#9aa1ab'; x.fillRect(0, 0, W, Math.max(2, H * 0.03)); x.fillRect(0, H - Math.max(2, H * 0.03), W, Math.max(2, H * 0.03));
  } else if (kind === 'tim') {
    x.fillStyle = '#6d7078'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < W * 0.6; i++) { x.fillStyle = r() > 0.5 ? '#a9adb6' : '#474a52'; x.fillRect(r() * W, r() * H, 2, 2); }
  } else if (kind === 'die') {
    // 矽:深灰藍 + 頂端的金屬層(後面 02 章會鑽進這裡)
    x.fillStyle = '#10131c'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < W * 2; i++) { x.globalAlpha = 0.25; x.fillStyle = r() > 0.5 ? '#1c2233' : '#0a0c12'; x.fillRect(r() * W, r() * H, 1, 1); }
    x.globalAlpha = 1;
    const top = H * 0.16;
    for (let k = 0; k < 6; k++) {
      const yy = top * (0.12 + k * 0.15);
      e.fillStyle = `rgba(255,255,255,${0.35 - k * 0.04})`;
      for (let xx = 0; xx < W; xx += 4 + k * 2) e.fillRect(xx, yy, 2 + k, Math.max(1, top * 0.07));
      x.fillStyle = '#6a4a35';
      for (let xx = 0; xx < W; xx += 4 + k * 2) x.fillRect(xx, yy, 2 + k, Math.max(1, top * 0.07));
    }
  } else if (kind === 'bump') {
    x.fillStyle = '#0b0c10'; x.fillRect(0, 0, W, H);
    const pitch = H * 1.3;
    for (let xx = pitch / 2; xx < W; xx += pitch) { x.fillStyle = '#a58a4a'; x.beginPath(); x.arc(xx, H / 2, H * 0.42, 0, Math.PI * 2); x.fill(); }
  } else {
    // 基板:玻纖 + 銅層 + 導通孔
    x.fillStyle = '#0a1510'; x.fillRect(0, 0, W, H);
    for (let k = 1; k < 8; k++) { x.fillStyle = k % 2 ? '#5a3c28' : '#3a2a1e'; x.fillRect(0, (k / 8) * H, W, Math.max(1, H * 0.018)); }
    for (let i = 0; i < W / 40; i++) { const xx = r() * W; x.fillStyle = '#6b4a33'; x.fillRect(xx, H * 0.12, Math.max(2, W * 0.002), H * 0.76); }
    for (let i = 0; i < 400; i++) { x.globalAlpha = 0.08; x.fillStyle = '#1e3b2c'; x.fillRect(r() * W, r() * H, 3, 1); }
    x.globalAlpha = 1;
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const emap = new THREE.CanvasTexture(E);
  return { map, emap };
}

export function buildCpu(ctx) {
  const { etch, assets, mobile, recolor } = ctx;
  const root = new THREE.Group();
  root.name = 'cpu';
  const back = new THREE.Group(), front = new THREE.Group();
  root.add(back, front);

  // ---------- 材質 ----------
  // 頂蓋:偏暗的鍍鎳金屬 —— 太亮的話,刻在上面的自發光字會被反光吃掉
  const brushed = P.brushedTex([3, 3]);
  const ihsMat = new THREE.MeshStandardMaterial({ color: 0x5f656d, metalness: 1, roughness: 0.56, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.0015, envMapIntensity: 0.38 });
  const PM = P.materials();
  const subMat = new THREE.MeshStandardMaterial({ color: 0x0e2318, metalness: 0.15, roughness: 0.62 });
  const dieMat = new THREE.MeshStandardMaterial({ color: 0x1a1f2e, metalness: 0.7, roughness: 0.22 });
  const timMat = new THREE.MeshStandardMaterial({ color: 0x7c818b, metalness: 1, roughness: 0.6, envMapIntensity: 0.5 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a64a, metalness: 1, roughness: 0.3 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x6b5a45, metalness: 0.3, roughness: 0.5 });
  const capEndMat = new THREE.MeshStandardMaterial({ color: 0xd8dde4, metalness: 1, roughness: 0.3 });
  recolor.push(() => goldMat.color.copy(metal()).multiplyScalar(0.9));

  const sections = []; // 剖面貼片,02 章之後要讓金屬層發光
  function section(kind, parent, x0, x1, y0, y1, z) {
    const { map, emap } = sectionTexture(kind, x1 - x0, y1 - y0);
    const m = new THREE.MeshStandardMaterial({
      map, emissiveMap: emap, emissive: new THREE.Color(0, 0, 0),
      metalness: kind === 'ihs' || kind === 'tim' ? 0.85 : 0.2, roughness: kind === 'ihs' ? 0.35 : 0.5,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), m);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
    parent.add(mesh);
    sections.push({ kind, mesh, mat: m });
    return mesh;
  }

  // ---------- 一半 ----------
  function half(isBack) {
    const g = isBack ? back : front;
    const sign = isBack ? -1 : 1;
    const layers = {};
    const mk = (name) => { const l = new THREE.Group(); l.name = name; g.add(l); layers[name] = l; return l; };
    // 基板
    const sub = mk('sub');
    const sm = new THREE.Mesh(new THREE.BoxGeometry(4, Y.sub1, 2), subMat);
    sm.position.set(0, Y.sub1 / 2, sign);
    sub.add(sm);
    // 邊緣金手指 + 底面接點
    // 底面的 LGA 接點:細密的金色小方塊陣列(中間留一塊空的,像真的 AM5)
    const padList = [];
    const m4 = new THREE.Matrix4();
    for (let x = -1.9; x <= 1.9; x += (mobile ? 0.16 : 0.1)) for (let z = 0.06; z <= 1.9; z += (mobile ? 0.16 : 0.1)) {
      if (Math.abs(x) < 0.7 && z < 0.7) continue;
      padList.push([x, -0.004, sign * z]);
    }
    const pads = P.instances(P.boxG(0.055, 0.01, 0.055), goldMat, padList, sub);
    // 基板頂面、頂蓋外圍的一圈小電容(0402)
    P.smdField({ area: [-1.95, 0.06, 1.95, 1.95], z: 0, count: mobile ? 60 : 160, seed: isBack ? 3 : 4, scale: 0.55, mats: PM,
      avoid: (x, zz) => Math.abs(x) < 1.78 && zz < 1.78 }, (() => { const gg = new THREE.Group(); gg.rotation.x = -Math.PI / 2; gg.scale.z = isBack ? 1 : 1; gg.position.y = Y.sub1; if (!isBack) gg.scale.y = -1; sub.add(gg); return gg; })());
    void pads;
    // 頂面的小電容(在頂蓋缺口那邊,像 AM5)
    const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), capMat, 16);
    const capEnds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.062, 0.052), capEndMat, 32);
    let cn = 0, en = 0;
    for (const sx of [-1, 1]) for (const zc of [0.95 * sign]) for (let k = 0; k < 8; k++) {
      const x = sx * 1.58, z = zc - 0.21 + (k % 4) * 0.14, xx = x + (k < 4 ? -0.07 : 0.07) * sx;
      m4.makeTranslation(xx, Y.sub1 + 0.03, z); caps.setMatrixAt(cn++, m4);
      m4.makeTranslation(xx - 0.05, Y.sub1 + 0.031, z); capEnds.setMatrixAt(en++, m4);
      m4.makeTranslation(xx + 0.05, Y.sub1 + 0.031, z); capEnds.setMatrixAt(en++, m4);
    }
    sub.add(caps, capEnds);
    if (isBack) section('sub', sub, -2, 2, Y.sub0, Y.sub1, 0.0006);

    // 凸塊
    const bump = mk('bump');
    const bumpGeo = new THREE.SphereGeometry(0.028, 8, 6);
    const bumpsPer = [];
    for (const d of DIES) for (let x = d.x0 + 0.06; x < d.x1 - 0.03; x += 0.1) for (let z = 0.05; z < Math.abs(isBack ? d.z0 : d.z1) - 0.03; z += 0.1) bumpsPer.push([x, sign * z]);
    const bumps = new THREE.InstancedMesh(bumpGeo, goldMat, bumpsPer.length);
    bumpsPer.forEach(([x, z], i) => { m4.makeTranslation(x, Y.sub1 + 0.03, z); bumps.setMatrixAt(i, m4); });
    bump.add(bumps);
    if (isBack) for (const d of DIES) section('bump', bump, d.x0, d.x1, Y.sub1, Y.bump1, 0.0006);

    // 晶粒
    const dies = mk('dies');
    for (const d of DIES) {
      const zz = isBack ? d.z0 : d.z1;
      const m = new THREE.Mesh(new THREE.BoxGeometry(d.x1 - d.x0, Y.die1 - Y.bump1, Math.abs(zz)), dieMat);
      m.position.set((d.x0 + d.x1) / 2, (Y.bump1 + Y.die1) / 2, zz / 2);
      dies.add(m);
      if (isBack) section('die', dies, d.x0, d.x1, Y.bump1, Y.die1, 0.0006);
    }
    // 導熱層
    const tim = mk('tim');
    const tm = new THREE.Mesh(new THREE.BoxGeometry(3.2, Y.tim1 - Y.die1, 1.6), timMat);
    tm.position.set(0, (Y.die1 + Y.tim1) / 2, sign * 0.8);
    tim.add(tm);
    if (isBack) section('tim', tim, -1.6, 1.6, Y.die1, Y.tim1, 0.0006);
    // 頂蓋(裁在 ±倒角 的位置:倒角會把外形往外撐,兩半才剛好在 z=0 相接、不重疊)
    const ihs = mk('ihs');
    const poly = clipZ(ihsOutline().map(([x, z]) => [x, z + (isBack ? 0.025 : -0.025)]), isBack).map(([x, z]) => [x, z + (isBack ? -0.025 : 0.025)]);
    const im = new THREE.Mesh(extrudeXZ(poly, Y.ihs1 - Y.tim1, 0.025), ihsMat);
    im.position.y = Y.tim1;
    ihs.add(im);
    layers.ihsMesh = im;
    if (isBack) section('ihs', ihs, -IHS_HALF, IHS_HALF, Y.tim1, Y.ihs1, 0.0008);
    return layers;
  }
  const B = half(true), F = half(false);
  // 完整(還沒切開)的頂蓋:開場用它,兩半之間才不會先看到一條縫
  const ihsWhole = new THREE.Mesh(extrudeXZ(ihsOutline(), Y.ihs1 - Y.tim1, 0.025), ihsMat);
  ihsWhole.position.y = Y.tim1;
  root.add(ihsWhole);

  // 03 章的城市錨點:主晶粒頂面中心(在切面上)
  const dieAnchor = new THREE.Object3D();
  dieAnchor.position.set(0, Y.die1, 0);
  B.dies.add(dieAnchor);

  // ---------- 頂蓋刻字(00 開場)----------
  const heroCol = new THREE.Color();
  const avatar = assets.img('/images/avatar-v2.webp');
  const lid = etch.block({
    name: 'lid', w: 3.4, h: 3.4, res: 620, color: heroCol, intensity: 1.15,
    draw(g) {
      // 頭像不畫在這裡(加法混色會把它染色、洗白)—— 它是另外一片「琺瑯徽章」,只畫外框
      g.rect(0.2, 0.18, 1.02, 1.02, { stroke: '#fff', lw: 0.012, r: 0.15, alpha: 0.55 });
      g.text(t('hero.eyebrow'), 1.4, 0.44, { size: 0.12, weight: 500, alpha: 0.75, maxW: 1.8 });
      g.text('Tunai', 1.34, 1.1, { font: 'serif', size: 0.66, weight: 700, maxW: 1.9 });
      g.text(t('hero.tagline'), 0.22, 1.52, { size: 0.145, weight: 700, spacing: 0.02, maxW: 2.96 });
      g.wrap(t('hero.sub'), 0.22, 1.8, 2.96, { font: 'body', size: 0.1, lh: 1.6, alpha: 0.82 });
      g.rule(0.22, 2.4, 2.96, { alpha: 0.35 });
      const stats = [['7+', t('stats.repos')], ['5', t('stats.certs')], ['3', t('stats.langs')]];
      stats.forEach(([n, l], i) => {
        const x = 0.22 + i * 1.0;
        g.text(n, x, 2.72, { font: 'serif', size: 0.27, weight: 700 });
        g.text(l, x + g.measure(n, { font: 'serif', size: 0.27, weight: 700 }) + 0.06, 2.7, { size: 0.08, alpha: 0.7, maxW: 0.7 });
      });
      // 連結:刻在頂蓋上的兩顆「按鈕」
      const btn = (x, w, label, href) => {
        g.rect(x, 2.86, w, 0.26, { stroke: '#fff', lw: 0.012, r: 0.05, alpha: 0.9 });
        g.text(label, x + w / 2, 3.03, { size: 0.1, weight: 700, align: 'center', spacing: 0.04, maxW: w - 0.12 });
        g.hot(x, 2.86, w, 0.26, href, label);
      };
      btn(0.22, 1.1, 'GitHub ↗', 'https://github.com/Tunai-0511');
      btn(1.44, 1.1, t('hero.cta2') + ' →', '#contact');
      g.text('TN-2026 · DIFFUSED IN TAICHUNG, TAIWAN', 0.22, 3.28, { font: 'mono', size: 0.058, alpha: 0.5, spacing: 0.08 });
      // 第一腳標記
      g.rect(3.02, 3.02, 0.16, 0.16, { fill: '#fff', alpha: 0.35, r: 0.02 });
    },
  });
  recolor.push(() => eraSoft(0, 0.5, heroCol));
  // 頭像徽章:原色、一般混色,像燒在頂蓋上的琺瑯
  const avTex = new THREE.Texture(avatar);
  avTex.colorSpace = THREE.SRGBColorSpace;
  avTex.anisotropy = 8;
  const onAvatar = () => { avTex.needsUpdate = true; };
  if (avatar.complete && avatar.naturalWidth) onAvatar(); else avatar.addEventListener('load', onAvatar);
  const avGeo = new THREE.ShapeGeometry((() => {
    const s = new THREE.Shape(), w = 0.98, r = 0.13;
    s.moveTo(-w / 2 + r, -w / 2); s.lineTo(w / 2 - r, -w / 2); s.quadraticCurveTo(w / 2, -w / 2, w / 2, -w / 2 + r);
    s.lineTo(w / 2, w / 2 - r); s.quadraticCurveTo(w / 2, w / 2, w / 2 - r, w / 2); s.lineTo(-w / 2 + r, w / 2);
    s.quadraticCurveTo(-w / 2, w / 2, -w / 2, w / 2 - r); s.lineTo(-w / 2, -w / 2 + r); s.quadraticCurveTo(-w / 2, -w / 2, -w / 2 + r, -w / 2);
    return s;
  })(), 6);
  { const uv = avGeo.attributes.uv, p = avGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 0.98 + 0.5, p.getY(i) / 0.98 + 0.5); }
  const avMat = new THREE.MeshStandardMaterial({ map: avTex, emissiveMap: avTex, emissive: new THREE.Color(0.55, 0.55, 0.55), roughness: 0.35, metalness: 0.1 });
  const avatarBadge = new THREE.Mesh(avGeo, avMat);
  avatarBadge.rotation.x = -Math.PI / 2;
  // 畫布座標(0.2+0.51, 0.18+0.51)→ 頂蓋本地 (x, z)
  avatarBadge.position.set(0.71 - 1.7, Y.ihs1 + 0.003, 0.69 - 1.7);
  B.ihs.add(avatarBadge);
  // 頂蓋被切成兩半 → 刻字也要切:同一張貼圖,兩片平面各取一半 UV
  function lidHalf(isBack) {
    const geo = new THREE.PlaneGeometry(3.4, 1.7);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, isBack ? 0.5 + uv.getY(i) * 0.5 : uv.getY(i) * 0.5);
    const m = new THREE.Mesh(geo, lid.mat);
    m.userData.etch = lid;
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, Y.ihs1 + 0.0015, isBack ? -0.85 : 0.85);
    m.renderOrder = 5;
    (isBack ? B.ihs : F.ihs).add(m);
    return m;
  }
  const lidB = lidHalf(true), lidF = lidHalf(false);
  // 完整的那片貼在完整頂蓋上
  lid.mesh.rotation.x = -Math.PI / 2;
  lid.mesh.position.set(0, Y.ihs1 + 0.0015, 0);
  root.add(lid.mesh);

  // ---------- 剖面刻字(01 關於):頂蓋剖面上的自我介紹 ----------
  const aboutCol = new THREE.Color();
  const about = etch.block({
    name: 'about', w: 3.24, h: 0.66, res: 1400, color: aboutCol, intensity: 1.3,
    draw(g) {
      g.text('01 · ' + t('about.eyebrow'), 0.04, 0.085, { font: 'mono', size: 0.036, spacing: 0.12, alpha: 0.7 });
      g.text(t('about.title'), 0.04, 0.2, { font: 'serif', size: 0.088, weight: 700, maxW: 3.15 });
      g.wrap(t('about.p1'), 0.04, 0.31, 1.52, { font: 'body', size: 0.043, lh: 1.62, alpha: 0.92 });
      g.wrap(t('about.p2'), 1.68, 0.31, 1.52, { font: 'body', size: 0.043, lh: 1.62, alpha: 0.92 });
    },
  });
  about.mesh.position.set(0, (Y.tim1 + Y.ihs1) / 2, 0.0016);
  B.ihs.add(about.mesh);
  recolor.push(() => eraSoft(1, 0.45, aboutCol));

  // ---------- 時間線:爆炸圖每一層旁邊的標註 ----------
  const tlCol = new THREE.Color();
  // 每一層的高度(層名 → 剖面中心 y);時間線的內容在 src/data/world.js
  const LAYER_Y = { ihs: (Y.tim1 + Y.ihs1) / 2, tim: (Y.die1 + Y.tim1) / 2, dies: (Y.bump1 + Y.die1) / 2, sub: Y.sub1 / 2 };
  const TL = TIMELINE.filter((L) => LAYER_Y[L.layer] != null).map((L) => ({ ...L, y: LAYER_Y[L.layer] }));
  const labels = TL.map((L) => {
    const b = etch.block({
      name: 'tl-' + L.layer, w: 2.3, h: L.major ? 0.46 : 0.26, res: 900, color: tlCol, intensity: 1.25,
      draw(g) {
        if (L.major) {
          g.text(t(L.date), 0.04, 0.09, { font: 'mono', size: 0.055, spacing: 0.08, weight: 700 });
          g.text(t(L.school), 0.04, 0.22, { font: 'serif', size: 0.1, weight: 700, maxW: 2.2 });
          g.wrap(t(L.dept), 0.04, 0.33, 2.2, { font: 'body', size: 0.06, alpha: 0.9 });
        } else {
          g.text(t(L.date), 0.04, 0.09, { font: 'mono', size: 0.055, spacing: 0.08, weight: 700 });
          g.wrap(t(L.text), 0.04, 0.19, 2.2, { font: 'body', size: 0.068, alpha: 0.92 });
        }
      },
    });
    b.mesh.position.set(2.62 + 1.15, L.y + (L.major ? -0.08 : 0.02), 0.05);
    B[L.layer].add(b.mesh);
    // 引線:從該層的右緣拉到標註
    const edgeX = { ihs: 1.7, tim: 1.6, dies: 1.55, sub: 2.0 }[L.layer];
    const len = 2.6 - edgeX;
    const lead = new THREE.Mesh(new THREE.BoxGeometry(1, 0.004, 0.004), new THREE.MeshBasicMaterial({ color: tlCol, transparent: true, opacity: 0.7 }));
    lead.position.set(edgeX, L.y, 0.05);
    lead.geometry.translate(0.5, 0, 0); // 從左端長出去
    B[L.layer].add(lead);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: tlCol }));
    dot.position.set(edgeX, L.y, 0.05);
    B[L.layer].add(dot);
    return { b, lead, dot, len };
  });
  recolor.push(() => eraSoft(1, 0.3, tlCol));

  // ---------- 雷射切割 ----------
  const laserCol = new THREE.Color(1, 0.9, 0.8);
  const laser = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3, 8, 1, true), new THREE.MeshBasicMaterial({ color: laserCol.clone().multiplyScalar(6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.y = 1.5;
  const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 12, 1, true), new THREE.MeshBasicMaterial({ color: laserCol.clone().multiplyScalar(1.2), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.y = 1.5;
  const hot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 6, 4) }));
  laser.add(beam, halo, hot);
  laser.visible = false;
  root.add(laser);
  // 切縫:雷射走過的地方留下一道熾熱的線
  const seam = new THREE.Mesh(new THREE.BoxGeometry(1, 0.012, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.2, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  seam.visible = false;
  root.add(seam);
  // 火花(CPU 端的簡單彈道)
  const SPN = mobile ? 90 : 180;
  const spPos = new Float32Array(SPN * 3), spVel = new Float32Array(SPN * 3), spLife = new Float32Array(SPN);
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: new THREE.Color(3, 2, 1.2), size: 0.035, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sparks.frustumCulled = false;
  root.add(sparks);
  let spI = 0;

  // ---------- 開場粒子:雜訊雲 → 聚成晶片 → 繞著晶片轉 ----------
  const swarmCol = new THREE.Color();
  const swarm = makeSwarm({ count: mobile ? 1600 : 3600, size: 0.035, color: swarmCol });
  swarm.setFrom((i, v, r) => {
    // 一團扁的雜訊雲,偏在晶片左後方(開場時它從那邊飄進來)
    const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 4.2;
    v.set(Math.cos(a) * rad - 1.2, 0.6 + (r() - 0.5) * 2.4, Math.sin(a) * rad * 0.8 - 0.4);
  });
  swarm.setTo((i, v, r) => {
    // 晶片表面:頂蓋 60%、邊與基板 40%
    if (r() < 0.6) v.set((r() - 0.5) * 3.3, Y.ihs1 + 0.01, (r() - 0.5) * 3.3);
    else { const side = Math.floor(r() * 4), u = (r() - 0.5) * 4; const yy = r() * Y.ihs1; v.set(side < 2 ? (side ? 2 : -2) : u, yy, side < 2 ? u : side === 2 ? 2 : -2); }
  });
  swarm.U.uOrbitC.value.set(0, 0.7, 0);
  swarm.U.uOrbitR.value.set(3.1, 0.8, 3.1);
  swarm.U.uCurR.value = 0.6;
  root.add(swarm.points);
  recolor.push(() => eraSoft(0, 0.2, swarmCol));

  // ---------- 姿態 ----------
  // hero:頂蓋朝向鏡頭(本地 +Y → 主空間 +Z);about:躺平(切面朝鏡頭);socket:插在主機板上
  const POSE = {
    hero: { p: new THREE.Vector3(0, 0, 0), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.1, -0.16, 0.05)) },
    about: { p: new THREE.Vector3(0, -0.4, 0), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0, 0)) },
    socket: { p: new THREE.Vector3(0, 0, 0), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)) },
  };
  // 插座的位置由主機板場景決定(buildBoard 之後由引擎填入)
  const socket = { p: new THREE.Vector3(0, 0, -30), q: POSE.socket.q.clone() };
  const tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3();
  const heroPos = new THREE.Vector3(0, 0, 0);

  let spawnAcc = 0;
  function update(st) {
    const { s, k, time, dt, tLoad } = st;
    // --- 開場聚合(跟時間走,不是捲動)---
    const U = swarm.U;
    U.uTime.value = time;
    U.uMix.value = smooth(0.2, 2.6, tLoad);
    U.uNoise.value = 0.22 * (1 - U.uMix.value * 0.7);
    const assembled = smooth(2.2, 2.7, tLoad);
    back.visible = front.visible = assembled > 0;
    U.uOrbit.value = smooth(2.7, 4.6, tLoad);
    U.uAlpha.value = (0.9 + assembled * (1 - smooth(2.7, 3.4, tLoad)) * 2.2) * (1 - smooth(k('about.cut') - 0.5, k('about.read'), s) * 0.85);
    U.uBurst.value *= Math.exp(-dt * 3.5);
    // 刻字:聚合完成之後,雷射把頂蓋上的字寫出來
    lid.mat.uniforms.uReveal.value = smooth(2.8, 4.6, tLoad);
    // --- 姿態 ---
    const pAbout = smooth(k('hero') + 0.1, k('about.cut') - 0.1, s);
    const pSocket = smooth(st.last('ai') + 0.25, k('proj.board') - 0.05, s);
    tmpP.copy(heroPos).lerp(POSE.about.p, pAbout);
    tmpQ.copy(POSE.hero.q).slerp(POSE.about.q, pAbout);
    if (pSocket > 0) { tmpP.lerp(socket.p, pSocket); tmpQ.slerp(socket.q, pSocket); }
    root.position.copy(tmpP);
    root.quaternion.copy(tmpQ);
    // 游標讓晶片微微轉向(只在開場)
    if (st.pointer.on > 0 && pAbout < 1) {
      const w = (1 - pAbout) * st.pointer.on;
      tmpQ.setFromEuler(new THREE.Euler(-st.pointer.y * 0.12 * w, st.pointer.x * 0.16 * w, 0));
      root.quaternion.multiply(tmpQ);
    }
    // --- 雷射切割 ---
    const cut = smooth(k('hero') + 0.35, k('about.cut'), s);
    const rejoin = smooth(st.last('ai') + 0.2, k('proj.board') - 0.3, s); // 03 → 04:切開的兩半合回去
    laser.visible = cut > 0.001 && cut < 0.999;
    // 還沒切(或已經合回去):顯示完整的頂蓋與刻字;一開始切就換成兩半
    const whole = (cut < 0.001 || rejoin > 0.999) && back.visible;
    ihsWhole.visible = lid.mesh.visible = whole;
    B.ihsMesh.visible = F.ihsMesh.visible = lidB.visible = lidF.visible = !whole;
    const lx = -2.1 + cut * 4.2;
    laser.position.set(lx, Y.ihs1, 0);
    seam.visible = cut > 0.001 && rejoin < 0.5;
    seam.scale.x = Math.max(0.001, cut * 4.2);
    seam.position.set(-2.1 + (cut * 4.2) / 2, Y.ihs1 + 0.002, 0);
    seam.material.opacity = (1 - smooth(k('about.cut'), k('about.read'), s)) * 0.9;
    // 火花
    if (laser.visible && dt > 0) {
      spawnAcc += dt * 260;
      while (spawnAcc > 1) {
        spawnAcc -= 1;
        const i = spI++ % SPN;
        spPos.set([lx, Y.ihs1 + 0.02, (Math.random() - 0.5) * 0.04], i * 3);
        const a = Math.random() * Math.PI * 2;
        spVel.set([Math.cos(a) * 0.9 - 0.6, 1.2 + Math.random() * 1.6, Math.sin(a) * 0.9], i * 3);
        spLife[i] = 0.5 + Math.random() * 0.5;
      }
    }
    for (let i = 0; i < SPN; i++) {
      if (spLife[i] <= 0) { spPos[i * 3 + 1] = -99; continue; }
      spLife[i] -= dt;
      spVel[i * 3 + 1] -= 6 * dt;
      spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt;
    }
    spGeo.attributes.position.needsUpdate = true;
    // --- 前半塊掉出畫面 ---
    const sep = smooth(k('about.cut') - 0.05, k('about.cut') + 0.55, s) * (1 - rejoin);
    front.position.set(0, -sep * 2.6, sep * 4.2);
    front.rotation.set(sep * 0.5, 0, sep * 0.15);
    front.visible = back.visible && sep < 0.98;
    // --- 爆炸圖 ---
    const ex = smooth(k('about.read') + 0.15, k('about.layers') - 0.1, s) * (1 - rejoin);
    B.bump.position.y = EXPLODE.bump * ex;
    B.dies.position.y = EXPLODE.die * ex;
    B.tim.position.y = EXPLODE.tim * ex;
    B.ihs.position.y = EXPLODE.ihs * ex;
    // 03 章在城市裡時,頂蓋與導熱層抬得更高,別壓在城市上空
    const lift = smooth(k('about.layers') + 0.3, st.first('ai') - 0.5, s) * (1 - rejoin);
    B.tim.position.y += lift * 1.6;
    B.ihs.position.y += lift * 2.6;
    // 剖面刻字
    about.mat.uniforms.uReveal.value = smooth(k('about.cut') + 0.2, k('about.read') - 0.05, s);
    const tlOn = smooth(k('about.read') + 0.3, k('about.layers') - 0.05, s) * (1 - lift);
    for (const L of labels) {
      L.b.mat.uniforms.uReveal.value = tlOn;
      L.lead.visible = L.dot.visible = tlOn > 0.02;
      L.lead.scale.x = Math.max(0.001, tlOn * L.len);
    }
    // 晶粒剖面的金屬層:鏡頭要鑽進去之前亮起來(指引視線)
    const glow = smooth(k('about.layers') - 0.2, k('about.layers') + 0.4, s);
    for (const S of sections) if (S.kind === 'die') S.mat.emissive.copy(era(2)).multiplyScalar(glow * 1.6);
  }

  function post(st) {
    const k = st.scaleOf('main');
    swarm.U.uSpace.value = k;
    swarm.U.uViewH.value = innerHeight;
    sparks.material.size = 0.035 * k;
    // 游標射線換到 CPU 本地座標,給粒子閃開用
    if (st.pointer.on > 0.01) {
      root.updateMatrixWorld();
      const invM = new THREE.Matrix4().copy(root.matrixWorld).invert();
      st.ray.setFromCamera(st.pointer.ndc, st.camera);
      swarm.U.uCurO.value.copy(st.ray.ray.origin).applyMatrix4(invM);
      swarm.U.uCurD.value.copy(st.ray.ray.direction).transformDirection(invM);
      swarm.U.uCurK.value = st.pointer.on;
    } else swarm.U.uCurK.value = 0;
  }

  return {
    root, update, post, dieAnchor, swarm, lid, socket,
    hotMeshes: [lidB, lidF],
    burst() { swarm.U.uBurst.value = 1; },
    marks: {
      lidCenter: new THREE.Vector3(0, Y.ihs1, 0),
    },
  };
}
