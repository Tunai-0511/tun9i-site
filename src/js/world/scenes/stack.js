// 02 歷程 —— 鑽進晶粒的剖面:一層金屬導線 = 一張證照。
//
// 真的晶片裡,電晶體(FinFET)上面疊著好幾層銅導線:最下面最細最密,越往上越粗越疏,
// 層與層之間用導通孔接起來,每條銅線外面包著一層阻障層,層與層之間有蝕刻停止層。
// 這裡一層一張證照,照時間由下往上疊(src/data/world.js 的 CERTS):多一張證照就多一層。
// 訊號(光點)從電晶體沿著導通孔往上爬,爬到哪一層、那一層就亮。
// 最上面幾層還在「沉積中」:那是正在學的東西(LEARNING)。再往上就是晶粒表面 → 03 章的城市。
//
// 座標:y = 0 是晶粒表面,整個結構在它下面;z = 0 是切面(朝 +z),結構往 -z 延伸。單位約 1 µm。

import * as THREE from 'three';
import { t } from '../../i18n.js';
import { CERTS, LEARNING } from '../../../data/world.js';
import { era, eraSoft } from '../era.js';
import * as P from '../parts.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const WIRE_X0 = -1.9, WIRE_X1 = 16, DEPTH = 12, WIDE = 34;
const TEXT_X0 = -13.1; // 刻字區的左緣(切面左側,導線不長到這裡)

// ---------- 版面:依證照數量算出每一層的高度、厚度、間距 ----------
function layout() {
  const N = CERTS.length;
  const layers = CERTS.map((c, i) => {
    const u = N > 1 ? i / (N - 1) : 1;
    const th = 0.36 + 0.85 * Math.pow(u, 1.3);
    const w = th * 0.85;
    return { ...c, i, th, w, pitch: w * 2 + 0.22, dir: i % 2 ? 'x' : 'z', gap: 0.9 + 0.5 * u };
  });
  // 從電晶體的接觸層往上疊;兩層中心至少差 1.8(旁邊的刻字才不會重疊)
  let y = 0;
  layers.forEach((L, i) => {
    if (i === 0) y = L.th / 2;
    else { const prev = layers[i - 1]; y = prev.y + Math.max(prev.th / 2 + L.gap + L.th / 2, 1.8); }
    L.y = y;
  });
  const learn = LEARNING.map((l, i) => ({ ...l, i, th: Math.max(0.4, 0.8 - i * 0.12) }));
  let top = layers[layers.length - 1].y + layers[layers.length - 1].th / 2;
  learn.forEach((l) => { l.y = top + 0.9 + l.th / 2; top = l.y + l.th / 2; });
  const surface = top + 0.8;
  // 整體往下平移:晶粒表面在 y = 0
  const off = -surface;
  layers.forEach((L) => { L.y += off; });
  learn.forEach((l) => { l.y += off; });
  return { layers, learn, fe: off - 0.6 /* 電晶體層頂 */ };
}

export function buildStack(ctx) {
  const { etch, recolor, mobile, U: GU } = ctx;
  const root = new THREE.Group();
  root.name = 'stack';
  const { layers: LAY, learn: LEARN, fe: FE } = layout();
  const detail = mobile ? 0.5 : 1;

  // ---------- 矽基板 + FinFET ----------
  const siMat = new THREE.MeshStandardMaterial({ color: 0x141926, metalness: 0.5, roughness: 0.32 });
  P.mesh(P.boxG(WIDE, 3, DEPTH), siMat, 0, FE - 2.1, -DEPTH / 2, root);
  const finMat = new THREE.MeshStandardMaterial({ color: 0x2b3653, metalness: 0.55, roughness: 0.3, emissive: new THREE.Color(0, 0, 0) });
  const finN = Math.round(56 * detail);
  const fins = [];
  for (let i = 0; i < finN; i++) fins.push([WIRE_X0 + 0.25 + i * ((WIRE_X1 - WIRE_X0 - 0.5) / finN), FE - 0.35, -DEPTH / 2]);
  P.instances(P.boxG(0.12, 0.62, DEPTH), finMat, fins, root);
  // 閘極:沿 x 橫跨鰭,外面一圈側壁(spacer)
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x6d7588, metalness: 0.9, roughness: 0.28, emissive: new THREE.Color(0, 0, 0) });
  const gates = [], spacers = [];
  for (let i = 0; i < 15; i++) { const z = -0.35 - i * 0.78; gates.push([(WIRE_X0 + WIRE_X1) / 2, FE - 0.2, z]); spacers.push([(WIRE_X0 + WIRE_X1) / 2, FE - 0.22, z]); }
  P.instances(P.boxG(WIRE_X1 - WIRE_X0, 0.62, 0.16), gateMat, gates, root);
  P.instances(P.boxG(WIRE_X1 - WIRE_X0, 0.58, 0.3), new THREE.MeshStandardMaterial({ color: 0x3b4a6a, transparent: true, opacity: 0.35, depthWrite: false }), spacers, root);
  // 源極/汲極的磊晶(鑽石形)+ 鎢接觸柱
  const epi = [], contacts = [];
  for (let i = 0; i < finN; i += 2) for (let j = 0; j < 14; j++) {
    const x = fins[i][0], z = -0.74 - j * 0.78;
    epi.push([x, FE - 0.28, z, Math.PI / 4, 0.26, 0.26, 0.2]);
    if ((i + j) % 5 === 0) contacts.push([x, FE + 0.3, z]);
  }
  P.instances(P.boxG(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x4c5a78, metalness: 0.5, roughness: 0.35 }), epi, root);
  P.instances(P.cylG(0.07, 0.75, 8), new THREE.MeshStandardMaterial({ color: 0x9aa1ad, metalness: 1, roughness: 0.3 }), contacts, root);

  // ---------- 介電層(玻璃)+ 每一層之間的蝕刻停止層 ----------
  const ildTop = LAY[LAY.length - 1].y + LAY[LAY.length - 1].th / 2 + 0.4;
  const ild = P.mesh(P.boxG(WIDE, ildTop - FE, DEPTH), new THREE.MeshStandardMaterial({ color: 0x1a2340, transparent: true, opacity: 0.1, roughness: 0.08, metalness: 0, depthWrite: false }), 0, (ildTop + FE) / 2, -DEPTH / 2, root);
  ild.renderOrder = 2;
  const esMat = new THREE.MeshStandardMaterial({ color: 0x3a4b7a, transparent: true, opacity: 0.28, roughness: 0.2, metalness: 0.2, depthWrite: false });
  LAY.forEach((L) => { const e = P.mesh(P.boxG(WIDE, 0.05, DEPTH), esMat, 0, L.y + L.th / 2 + 0.06, -DEPTH / 2, root); e.renderOrder = 2; });

  // ---------- 每一層金屬:銅線 + 阻障層 + 往上一層的導通孔 ----------
  const linerMat = new THREE.MeshStandardMaterial({ color: 0x3b3230, metalness: 0.8, roughness: 0.5 });
  const layers = LAY.map((L, li) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0xb4602a, metalness: 1, roughness: 0.4, envMapIntensity: 0.45, emissive: new THREE.Color(0, 0, 0) });
    const list = [];
    if (L.dir === 'z') {
      const n = Math.floor((WIRE_X1 - WIRE_X0) / L.pitch);
      for (let i = 0; i < n; i++) list.push([WIRE_X0 + L.pitch / 2 + i * L.pitch, L.y, -DEPTH / 2]);
      P.instances(P.boxG(L.w, L.th, DEPTH), mat, list, root);
      P.instances(P.boxG(L.w + 0.06, L.th + 0.04, DEPTH - 0.02), linerMat, list.map((p) => [p[0], p[1] - 0.005, p[2] - 0.02]), root);
    } else {
      const n = Math.floor(DEPTH / L.pitch);
      for (let i = 0; i < n; i++) list.push([(WIRE_X0 + WIRE_X1) / 2, L.y, -L.w / 2 - 0.05 - i * L.pitch]);
      P.instances(P.boxG(WIRE_X1 - WIRE_X0, L.th, L.w), mat, list, root);
      P.instances(P.boxG(WIRE_X1 - WIRE_X0 - 0.02, L.th + 0.04, L.w + 0.06), linerMat, list.map((p) => [p[0], p[1] - 0.005, p[2] - 0.001]), root);
    }
    const up = LAY[li + 1];
    if (up) {
      const vh = up.y - up.th / 2 - (L.y + L.th / 2);
      const vias = [];
      for (let i = 0; i < 16; i++) vias.push([WIRE_X0 + 0.6 + ((i * 7) % 16) * ((WIRE_X1 - WIRE_X0 - 1.2) / 16), L.y + L.th / 2 + vh / 2, -0.4 - ((i * 5) % 7) * (DEPTH / 8)]);
      P.instances(P.cylG(L.w * 0.32, vh, 12), mat, vias, root);
    }
    return { ...L, mat };
  });

  // ---------- 證照刻字:刻在切面左側 ----------
  const labCol = LAY.map(() => new THREE.Color());
  const labels = LAY.map((L, i) => {
    const b = etch.block({
      name: 'cert-' + L.id, w: 10.6, h: L.major ? 2.1 : 1.55, res: 150, color: labCol[i], intensity: 1.25,
      draw(g) {
        const H = g.h;
        g.text(`M${i + 1}`, 0.05, H / 2 - 0.1, { font: 'mono', size: 0.36, weight: 700, alpha: 0.55 });
        g.text(L.date, 0.05, H / 2 + 0.36, { font: 'mono', size: 0.3, spacing: 0.06 });
        g.wrap(t(L.name), 1.7, L.major ? 0.72 : 0.62, 8.7, { font: L.major ? 'serif' : 'sans', size: L.major ? 0.62 : 0.5, weight: 700, lh: 1.2 });
        g.wrap(t(L.org), 1.7, L.major ? 1.45 : 1.15, 8.7, { font: 'body', size: 0.27, alpha: 0.72 });
        g.rule(1.7, H - 0.12, 8.6, { alpha: 0.25, t: 0.03 });
      },
    });
    b.mesh.position.set(TEXT_X0 + 5.3, L.y + (L.major ? 0.05 : 0.02), 0.03);
    root.add(b.mesh);
    return b;
  });
  const titleCol = new THREE.Color();
  const title = etch.block({
    name: 'journey-title', w: 13, h: 2.6, res: 140, color: titleCol, intensity: 1.2,
    draw(g) {
      g.text('02 · ' + t('jr.eyebrow'), 0.05, 0.5, { font: 'mono', size: 0.34, spacing: 0.14, alpha: 0.75 });
      g.text(t('jr.title'), 0.05, 1.45, { font: 'serif', size: 0.8, weight: 700, maxW: 12.8 });
      g.text(`${t('jr.certs')} · ${CERTS.length}`, 0.05, 2.2, { font: 'sans', size: 0.34, alpha: 0.7, spacing: 0.04 });
    },
  });
  title.mesh.position.set(TEXT_X0 + 6.5, FE - 2.1, 0.03);
  root.add(title.mesh);

  // ---------- 正在學的:還在沉積中的層 ----------
  const depMat = LEARN.map(() => new THREE.ShaderMaterial({
    uniforms: { uTime: GU.uTime, uColor: { value: new THREE.Color() }, uProg: { value: 0 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uProg; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){
        float ln = length(vN); vec3 n = ln > 1e-5 ? vN / ln : vec3(0.0, 0.0, 1.0);
        float fr = pow(clamp(1.0 - abs(dot(n, normalize(vV))), 0.0, 1.0), 2.0);
        float scan = exp(-pow(fract(vP.x * 0.05 - uTime * 0.18) - 0.5, 2.0) * 900.0);
        float grid = step(0.92, fract(vP.x * 1.4)) + step(0.94, fract(vP.z * 1.2));
        float grown = 1.0 - smoothstep(uProg * 34.0 - 18.0, uProg * 34.0 - 17.0, vP.x);
        float a = (0.05 + fr * 0.22 + grid * 0.07 * grown + scan * 0.35) * (0.35 + 0.65 * grown);
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  const learnLabels = LEARN.map((L, i) => {
    const slab = P.mesh(P.boxG(WIDE, L.th, DEPTH), depMat[i], 0, L.y, -DEPTH / 2, root);
    slab.renderOrder = 3;
    const col = new THREE.Color();
    const b = etch.block({
      name: 'learn-' + i, w: 16, h: 1.5, res: 130, color: col, intensity: 1.2,
      draw(g) {
        if (i === 0) g.text(t('jr.learning').toUpperCase() + ' · IN PROGRESS', 0.05, 0.28, { font: 'mono', size: 0.22, spacing: 0.12, alpha: 0.6 });
        g.text(t(L.title), 0.05, i === 0 ? 0.78 : 0.55, { font: 'sans', size: 0.44, weight: 700, maxW: 15.8 });
        g.wrap(t(L.desc), 0.05, i === 0 ? 1.18 : 0.98, 15.8, { font: 'body', size: 0.24, alpha: 0.8, maxLines: 2 });
      },
    });
    b.mesh.position.set(TEXT_X0 + 8, L.y + (i === 0 ? 0.35 : 0.3), 0.06);
    root.add(b.mesh);
    recolor.push(() => { eraSoft(2.6, 0.25, col); era(2.8, depMat[i].uniforms.uColor.value); });
    return { b, slab };
  });
  const RN = mobile ? 220 : 500;
  const rain = new Float32Array(RN * 3), rainV = new Float32Array(RN);
  const rTop = LEARN.length ? LEARN[LEARN.length - 1].y + 4 : 2;
  for (let i = 0; i < RN; i++) { rain.set([-16 + Math.random() * 32, rTop - Math.random() * 6, -Math.random() * DEPTH], i * 3); rainV[i] = 0.6 + Math.random() * 1.4; }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rain, 3));
  const rainCol = new THREE.Color();
  const rainPts = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: rainCol, size: 0.07, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  rainPts.frustumCulled = false;
  root.add(rainPts);
  const rainFloor = LEARN.length ? LEARN[0].y - LEARN[0].th : -2;
  // 晶粒表面(鈍化層)
  P.mesh(P.boxG(WIDE, 0.12, DEPTH), new THREE.MeshStandardMaterial({ color: 0x2a3150, transparent: true, opacity: 0.25, metalness: 0.2, roughness: 0.1, depthWrite: false }), 0, -0.06, -DEPTH / 2, root);

  // ---------- 訊號:光點沿著導通孔往上爬 ----------
  const paths = [];
  for (let p = 0; p < 7; p++) {
    const pts = [];
    let x = WIRE_X0 + 1 + p * 2.2;
    const z = -0.6 - (p % 3) * 1.6;
    pts.push(new THREE.Vector3(x, FE, z));
    for (const L of LAY) {
      pts.push(new THREE.Vector3(x, L.y, z));
      x = clamp(x + (p % 2 ? 1 : -1) * L.pitch * 2.2, WIRE_X0 + 0.5, WIRE_X1 - 0.5);
      pts.push(new THREE.Vector3(x, L.y, z));
    }
    pts.push(new THREE.Vector3(x, 0.4, z));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    paths.push({ pts, cum, len: cum[cum.length - 1] });
  }
  const SN = mobile ? 180 : 360;
  const sig = new Float32Array(SN * 3), sigSeed = new Float32Array(SN);
  for (let i = 0; i < SN; i++) sigSeed[i] = Math.random();
  const sigGeo = new THREE.BufferGeometry();
  sigGeo.setAttribute('position', new THREE.BufferAttribute(sig, 3));
  const sigCol = new THREE.Color();
  const sigPts = new THREE.Points(sigGeo, new THREE.PointsMaterial({ color: sigCol, size: 0.16, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sigPts.frustumCulled = false;
  root.add(sigPts);
  const at = (Pth, d, out) => {
    const { pts, cum } = Pth;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const u = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return out.copy(pts[i - 1]).lerp(pts[i], clamp(u));
  };
  const v3 = new THREE.Vector3();

  recolor.push(() => {
    LAY.forEach((_, i) => eraSoft(2 + i * 0.1, 0.3, labCol[i]));
    eraSoft(2, 0.3, titleCol);
    eraSoft(2.4, 0.5, sigCol).multiplyScalar(2.2);
    eraSoft(2.8, 0.3, rainCol);
  });

  // ---------- 鏡頭:每兩層一個鏡頭,最後一個看沉積中的層 ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const groups = [];
  for (let i = 0; i < LAY.length; i += 2) groups.push(LAY.slice(i, i + 2));
  const keys = groups.map((G, gi) => {
    let y = G.reduce((a, L) => a + L.y, 0) / G.length;
    if (gi === 0) y -= 0.7; // 第一個鏡頭也要看到章節標題
    return { name: 'journey.' + gi, T: V(-4.4, y, -1), O: V(2.4, 1.7, G.some((L) => L.major) ? 16 : 17.5), hold: gi === 0 ? 0.12 : 0.14, layers: G.map((L) => L.i) };
  });
  if (LEARN.length) keys.push({ name: 'journey.learn', T: V(-4, (LEARN[0].y + LEARN[LEARN.length - 1].y) / 2, -1), O: V(2.2, 3, 17.5) });
  // 每一層在哪個鏡頭亮起來(鏡頭在第幾個 key、在那一組裡排第幾)
  const climbAt = LAY.map((L) => { const gi = keys.findIndex((K) => K.layers?.includes(L.i)); return { gi, sub: keys[gi].layers.indexOf(L.i) }; });

  function update(st) {
    const { s, k, dt, time } = st;
    const first = st.first('journey'), last = st.last('journey');
    layers.forEach((L, i) => {
      // 鏡頭停下來之前,這一組的字要已經刻完(同一組第二層稍晚一點點)
      const c = first + climbAt[i].gi - 0.5 + climbAt[i].sub * 0.2;
      const on = smooth(c - 0.3, c + 0.15, s);
      const pulse = 0.5 + 0.5 * Math.sin(time * 3 + i);
      L.mat.emissive.copy(era(2 + i * 0.1)).multiplyScalar(on * (0.14 + (L.major ? 0.3 : 0.1) * pulse));
      labels[i].mat.uniforms.uReveal.value = smooth(c - 0.25, c + 0.25, s);
    });
    title.mat.uniforms.uReveal.value = smooth(k('about.layers') + 0.5, first - 0.05, s);
    const fOn = smooth(k('about.layers') + 0.6, first, s);
    finMat.emissive.copy(era(2)).multiplyScalar(0.25 * fOn);
    gateMat.emissive.copy(era(2)).multiplyScalar(0.12 * fOn);
    const lp = LEARN.length ? smooth(last - 1 + 0.2, last - 0.05, s) : 0;
    LEARN.forEach((L, i) => {
      depMat[i].uniforms.uProg.value = lp * Math.max(0.2, 0.62 - i * 0.2) + Math.sin(time * 0.4 + i) * 0.02;
      learnLabels[i].b.mat.uniforms.uReveal.value = smooth(last - 1 + 0.4 + i * 0.1, last - 0.05, s);
    });
    rainPts.visible = lp > 0.01;
    for (let i = 0; i < RN; i++) {
      rain[i * 3 + 1] -= rainV[i] * dt * 1.5;
      if (rain[i * 3 + 1] < rainFloor) rain[i * 3 + 1] = rTop + Math.random() * 2;
    }
    rainGeo.attributes.position.needsUpdate = true;
    rainPts.material.opacity = 0.8 * lp;
    const reach = smooth(k('about.layers') + 0.5, last, s);
    for (let i = 0; i < SN; i++) {
      const Pth = paths[i % paths.length];
      const ph = (sigSeed[i] + time * 0.08) % 1;
      at(Pth, ph * Pth.len * (0.25 + 0.75 * reach), v3);
      sig[i * 3] = v3.x; sig[i * 3 + 1] = v3.y; sig[i * 3 + 2] = v3.z;
    }
    sigGeo.attributes.position.needsUpdate = true;
  }
  // 點的大小是世界單位 → 要乘上這個空間目前的縮放(轉場時基準空間會換)
  function post(st) {
    const kk = st.scaleOf('stack');
    rainPts.material.size = 0.07 * kk;
    sigPts.material.size = 0.16 * kk;
  }

  return { root, update, post, keys, hotMeshes: [] };
}
