// 03 AI 工作流 —— 晶粒表面是一座城市。
//
// 從金屬層往上鑽出來,就站在晶粒的切口(懸崖)邊上:眼前是後半塊晶粒,
// 上面長滿了電晶體方塊 —— 有一格一格整齊的 SRAM 陣列、一排一排的標準元件、零星的高塔,
// 街道是發光的走線,頭頂架著粗粗的電源網格。城中央一條環狀大道,上面的廣場 = 每天在用的 AI 工具
// (src/data/world.js 的 AI_TOOLS,數量多少就排幾個),名字、logo 與用法刻在廣場的地面上。
// 鏡頭繞著環道轉,一次看兩個廣場。訊號沿著中央大道進城,走到哪個廣場,那一區就亮(累積)。
//
// 城市的光全部在著色器裡算:方塊是一個 InstancedMesh、一次 draw call。
// 座標:die 空間(1 單位 ≈ 100 µm),y = 0 是晶粒表面,z = 0 是切口,城市在 z < 0。

import * as THREE from 'three';
import { t } from '../../i18n.js';
import { BRAND } from '../../brand-icons.js';
import { AI_TOOLS } from '../../../data/world.js';
import { era, eraSoft, WHITE } from '../era.js';
import * as P from '../parts.js';

export const MAX_PULSES = 6;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

const X0 = -85, X1 = 85, Z0 = -62, Z1 = -0.6;
const C = new THREE.Vector3(0, 0, -30), R = 20;
const NT = AI_TOOLS.length;
const ZONES = NT + 1; // 最後一區 = 進城大道
// 廣場沿著環道排開;正前方(+z,朝切口的那一段)留給進城的大道
const TOOLS = AI_TOOLS.map((T, i) => {
  const deg = NT > 1 ? 125 + (i * 290) / (NT - 1) : 270;
  const a = (deg * Math.PI) / 180;
  const u = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  return { ...T, i, deg, u, p: C.clone().addScaledVector(u, R) };
});

const LIGHT_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uZone[${ZONES}];
  uniform float uFocus[${ZONES}];
  uniform vec3 uZoneCol[${ZONES}];
  uniform vec2 uCursor;
  uniform float uCursorOn;
  uniform vec4 uPulse[${MAX_PULSES}];
  uniform vec3 uEra;
  float cityHash(float n) { return fract(sin(n) * 43758.5453); }
  float cityCursor(vec2 p) { vec2 d = p - uCursor; return uCursorOn * exp(-dot(d, d) / 30.0); }
  float cityPulse(vec2 p) {
    float s = 0.0;
    for (int i = 0; i < ${MAX_PULSES}; i++) {
      vec4 q = uPulse[i];
      float age = uTime - q.z;
      if (age > 0.0 && age < 3.0) {
        float d = length(p - q.xy) - age * 22.0;
        s += exp(-d * d / 1.4) * (1.0 - age / 3.0) * q.w;
      }
    }
    return s;
  }
  void zoneOf(float z, out float lit, out float foc, out vec3 zc) {
    int zi = int(z + 0.5);
    lit = 0.0; foc = 0.0; zc = uEra;
    for (int i = 0; i < ${ZONES}; i++) if (i == zi) { lit = uZone[i]; foc = uFocus[i]; zc = uZoneCol[i]; }
  }
`;

function clearAt(x, z) {
  if (Math.abs(x) < 3.2 && z > C.z) return true;
  if (Math.abs(x) < 17 && z > -12.8) return true; // 進城處的章節標題
  const dx = x - C.x, dz = z - C.z, r = Math.hypot(dx, dz);
  if (Math.abs(r - R) < 2.2) return true;
  if (r < 7) return true;
  for (const T of TOOLS) if (Math.hypot(x - T.p.x, z - T.p.z) < 7.4) return true;
  const a = Math.atan2(dz, dx);
  for (const T of TOOLS) {
    const ta = (T.deg * Math.PI) / 180;
    let da = Math.abs(a - ta); da = Math.min(da, Math.PI * 2 - da);
    if (r < R && da * r < 1.6) return true;
  }
  return false;
}
function hash2(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function zoneOf(x, z) {
  let best = NT, bd = 1e9;
  for (const T of TOOLS) { const d = Math.hypot(x - T.p.x, z - T.p.z); if (d < bd) { bd = d; best = T.i; } }
  return bd < 26 ? best : NT;
}
// 城裡的「街區類型」:SRAM 陣列(整齊的小方塊)、標準元件列(長條)、一般(雜訊高度)
function districtOf(x, z) {
  const n = vnoise(x * 0.035 + 7, z * 0.035 - 3);
  return n < 0.33 ? 'sram' : n < 0.62 ? 'rows' : 'mixed';
}

export function buildDie(ctx) {
  const { etch, assets, recolor, mobile, U: GU } = ctx;
  const M = P.materials();
  const root = new THREE.Group();
  root.name = 'die';

  const U = {
    uTime: GU.uTime,
    uZone: { value: new Array(ZONES).fill(0) },
    uFocus: { value: new Array(ZONES).fill(0) },
    uZoneCol: { value: [...TOOLS.map((T) => new THREE.Color(T.color)), new THREE.Color()] },
    uCursor: { value: new THREE.Vector2(-999, -999) },
    uCursorOn: { value: 0 },
    uPulse: { value: Array.from({ length: MAX_PULSES }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uEra: { value: new THREE.Color() },
  };
  recolor.push(() => { era(3, U.uEra.value); era(3, U.uZoneCol.value[NT]); });

  // ---------- 方塊:依街區類型長成不同的樣子 ----------
  const S = mobile ? 1.9 : 1.35;
  const nx = Math.floor((X1 - X0) / S), nz = Math.floor((Z1 - Z0) / S);
  const cells = [];
  const push = (x, z, w, d, h, r) => cells.push([x, z, w, d, Math.max(0.1, h), r, zoneOf(x, z)]);
  for (let i = 0; i < nx; i++) {
    if (i % 9 === 0) continue;
    for (let j = 0; j < nz; j++) {
      if (j % 7 === 0) continue;
      const x = X0 + (i + 0.5) * S, z = Z0 + (j + 0.5) * S;
      if (clearAt(x, z)) continue;
      const r = hash2(i * 1.3, j * 2.7);
      let near = 1e9;
      for (const T of TOOLS) near = Math.min(near, Math.hypot(x - T.p.x, z - T.p.z));
      const damp = (0.3 + 0.7 * clamp((near - 7) / 9)) * (0.35 + 0.65 * clamp(-z / 10));
      const kind = districtOf(x, z);
      if (kind === 'sram' && !mobile) {
        // 一格切成 2×2 顆一樣高的小方塊:SRAM 陣列的整齊感
        const q = S / 4, h = (0.35 + 0.1 * r) * damp;
        for (const [ox, oz] of [[-q, -q], [q, -q], [-q, q], [q, q]]) push(x + ox, z + oz, S * 0.38, S * 0.38, h, r);
      } else if (kind === 'rows') {
        // 標準元件:沿 x 拉長的一條,高度差不多
        push(x, z, S * 0.94, S * 0.42, (0.3 + 0.35 * r) * damp, r);
      } else {
        let h = 0.2 + 1.7 * Math.pow(vnoise(x * 0.07, z * 0.07), 2.2) + 0.3 * r;
        if (hash2(i * 7.1, j * 3.3) < 0.03) h = 2.6 + hash2(j, i) * 3.6; // 零星的高塔
        const w = S * (0.6 + 0.24 * hash2(i * 5.7, j * 1.9));
        push(x, z, w, w, h * damp, r);
      }
    }
  }
  const N = cells.length;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const seed = new Float32Array(N), zone = new Float32Array(N);
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x15121c, metalness: 0.6, roughness: 0.4 });
  const blocks = new THREE.InstancedMesh(box, blockMat, N);
  const m4 = new THREE.Matrix4();
  cells.forEach(([x, z, w, d, h, r, zn], k) => {
    m4.makeScale(w, h, d).setPosition(x, h / 2, z);
    blocks.setMatrixAt(k, m4);
    seed[k] = r * 97.0 + k * 0.013;
    zone[k] = zn;
  });
  box.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  box.setAttribute('aZone', new THREE.InstancedBufferAttribute(zone, 1));
  blockMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = `attribute float aSeed; attribute float aZone;
      varying float vSeed; varying float vZone; varying vec3 vCityW; varying float vTopN; varying float vLocalY; varying vec2 vFaceUv;
      ` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vSeed = aSeed; vZone = aZone; vTopN = normal.y; vLocalY = position.y + 0.5; vFaceUv = uv;
        vCityW = (instanceMatrix * vec4(position, 1.0)).xyz;`);
    sh.fragmentShader = `varying float vSeed; varying float vZone; varying vec3 vCityW; varying float vTopN; varying float vLocalY; varying vec2 vFaceUv;
      ${LIGHT_GLSL}
      ` + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float lit, foc; vec3 zc;
          zoneOf(vZone, lit, foc, zc);
          vec3 tint = mix(uEra, zc, 0.55);
          float cur = cityCursor(vCityW.xz), pls = cityPulse(vCityW.xz);
          vec2 e = min(vFaceUv, 1.0 - vFaceUv);
          float edge = min(e.x, e.y);
          float rim = 1.0 - smoothstep(0.05, 0.1, edge);
          float core = smoothstep(0.2, 0.24, edge) * step(0.45, cityHash(vSeed * 3.1));
          float top = step(0.5, vTopN);
          float tick = floor(uTime * (0.8 + fract(vSeed) * 2.5) + vSeed);
          float busy = step(0.8, cityHash(vSeed + tick * 7.13));
          // 側面:一格一格的「窗」(像樓層),亮的時候才看得到
          float win = step(0.55, fract(vLocalY * 6.0)) * step(0.3, fract((vCityW.x + vCityW.z) * 2.1)) * step(0.5, cityHash(floor(vLocalY * 6.0) + vSeed));
          float g = top * (rim * (0.04 + lit * 0.45 + foc * 0.35) + core * (lit * (0.18 + 0.8 * busy) + foc * 0.4))
                  + top * (cur * 1.0 + pls * 1.0) * (0.3 + rim + core)
                  + (1.0 - top) * (vLocalY * (lit * 0.04 + foc * 0.1 + cur * 0.2 + pls * 0.3) + win * lit * 0.22);
          totalEmissiveRadiance += tint * g;
        }`);
  };
  blocks.frustumCulled = false;
  root.add(blocks);

  // ---------- 電源網格:架在城市上方的粗金屬帶(頂層金屬)----------
  // 一段一段鋪,環道範圍與進城處的標題上方不鋪(不擋字)
  const straps = [];
  const open = (x, z) => Math.hypot(x - C.x, z - C.z) > R + 10 && !(Math.abs(x) < 20 && z > -16);
  for (let x = X0 + 14; x < X1; x += 24) for (let z = Z0; z < Z1 - 6; z += 6) if (open(x, z + 3)) straps.push([x, 3.4, z + 3, 0, 0.8, 0.22, 6.02]);
  for (let z = Z0 + 8; z < Z1 - 6; z += 20) for (let x = X0; x < X1; x += 6) if (open(x + 3, z)) straps.push([x + 3, 3.9, z, 0, 6.02, 0.22, 0.8]);
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x8a5a36, metalness: 1, roughness: 0.35, transparent: true, opacity: 0.55, emissive: new THREE.Color(0, 0, 0), depthWrite: false });
  const strapMesh = P.instances(P.boxG(1, 1, 1), strapMat, straps, root);
  strapMesh.renderOrder = 3;
  // 網格交叉點的導通孔柱
  const pillars = [];
  for (let x = X0 + 14; x < X1; x += 24) for (let z = Z0 + 8; z < Z1 - 6; z += 20) if (!clearAt(x, z) && open(x, z)) pillars.push([x, 1.85, z]);
  P.instances(P.cylG(0.35, 3.7, 10), strapMat, pillars, root);

  // ---------- 走線 ----------
  const lp = [], lz = [];
  const seg = (ax, az, bx, bz, zn) => { lp.push(ax, 0.03, az, bx, 0.03, bz); lz.push(zn, zn); };
  for (let i = 0; i <= nx; i += 9) { const x = X0 + i * S; seg(x, Z0, x, Z1, zoneOf(x, (Z0 + Z1) / 2)); }
  for (let j = 0; j <= nz; j += 7) { const z = Z0 + j * S; seg(X0, z, X1, z, NT); }
  const RING = 120;
  for (let i = 0; i < RING; i++) {
    const a = (i / RING) * Math.PI * 2, b = ((i + 1) / RING) * Math.PI * 2;
    for (const rr of [R - 1.6, R + 1.6]) {
      const ax = C.x + Math.cos(a) * rr, az = C.z + Math.sin(a) * rr;
      seg(ax, az, C.x + Math.cos(b) * rr, C.z + Math.sin(b) * rr, zoneOf(ax, az));
    }
  }
  for (const T of TOOLS) for (const off of [-0.9, 0.9]) {
    const px = -T.u.z * off, pz = T.u.x * off;
    seg(C.x + T.u.x * 7 + px, C.z + T.u.z * 7 + pz, T.p.x - T.u.x * 7.4 + px, T.p.z - T.u.z * 7.4 + pz, T.i);
  }
  for (const x of [-2.2, 2.2]) seg(x, Z1, x, C.z + 7, NT);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  lineGeo.setAttribute('aZone', new THREE.Float32BufferAttribute(lz, 1));
  const traceMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: `attribute float aZone; varying vec3 vW; varying float vZone;
      #include <fog_pars_vertex>
      void main(){ vW = position; vZone = aZone; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `varying vec3 vW; varying float vZone;
      ${LIGHT_GLSL}
      #include <fog_pars_fragment>
      void main(){
        float lit, foc; vec3 zc;
        zoneOf(vZone, lit, foc, zc);
        float along = vW.x * 0.7 - vW.z * 0.9;
        float packet = pow(max(0.0, sin(along * 0.8 - uTime * 7.0)), 16.0) * lit;
        float g = 0.05 + lit * 0.3 + foc * 0.4 + packet * 1.8 + cityCursor(vW.xz) * 1.0 + cityPulse(vW.xz) * 1.4;
        gl_FragColor = vec4(mix(uEra, zc, 0.6) * g, 1.0);
        #include <fog_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  Object.assign(traceMat.uniforms, U);
  root.add(new THREE.LineSegments(lineGeo, traceMat));
  // 路口的導通孔焊墊
  const pads = [];
  for (let i = 0; i <= nx; i += 9) for (let j = 0; j <= nz; j += 7) { const x = X0 + i * S, z = Z0 + j * S; if (!clearAt(x, z)) pads.push([x, 0.04, z, 0, 0.5, 0.06, 0.5]); }
  P.instances(P.boxG(1, 1, 1), M.gold, pads, root);

  // ---------- 地面(晶粒表面):細格線 ----------
  const groundGeo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0);
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate((X0 + X1) / 2, 0.02, (Z0 + Z1) / 2); // 比主空間那塊晶粒的頂面高一點點,避免 z-fighting
  const groundMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vW = position; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `varying vec3 vW;
      ${LIGHT_GLSL}
      #include <fog_pars_fragment>
      float gridLine(vec2 p, float s, float w){ vec2 g = abs(fract(p / s - 0.5) - 0.5) * s; return 1.0 - smoothstep(0.0, w, min(g.x, g.y)); }
      void main(){
        float fine = gridLine(vW.xz, 0.675, 0.02) * 0.5 + gridLine(vW.xz, 3.375, 0.04);
        float light = 0.06 + cityCursor(vW.xz) * 0.6 + cityPulse(vW.xz) * 0.55;
        vec3 col = vec3(0.02, 0.018, 0.028) + uEra * fine * light;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  Object.assign(groundMat.uniforms, U);
  root.add(new THREE.Mesh(groundGeo, groundMat));

  // ---------- 廣場:階梯式平台 + 光環 + 旋轉的全像環 + 地面刻字 ----------
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0x0d0b12, metalness: 0.75, roughness: 0.3, roughnessMap: P.brushedTex([2, 2]) });
  const plazas = TOOLS.map((T) => {
    const g = new THREE.Group();
    g.position.copy(T.p);
    g.rotation.y = -Math.atan2(T.u.z, T.u.x) - Math.PI / 2; // 刻字的「上」朝外:從城中心往外看是正的
    root.add(g);
    for (const [r0, h] of [[7, 0.16], [6.6, 0.3]]) P.mesh(new THREE.CylinderGeometry(r0, r0 + 0.15, h, 64), plazaMat, 0, h / 2, 0, g);
    const ringCol = new THREE.Color(T.color);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.75, 0.07, 6, 128), new THREE.MeshBasicMaterial({ color: ringCol.clone() }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.31;
    g.add(ring);
    // 核心:一座六角柱塔 + 兩圈浮環(遠處也認得出每一區)
    const pylon = new THREE.Group();
    pylon.position.set(0, 0.3, -4.6);
    g.add(pylon);
    const shaft = P.mesh(new THREE.CylinderGeometry(0.34, 0.52, 1, 6), new THREE.MeshStandardMaterial({ color: 0x15121c, emissive: ringCol.clone(), emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.35 }), 0, 0.5, 0, pylon);
    const halos = [0.9, 1.3].map((r0) => { const h = new THREE.Mesh(new THREE.TorusGeometry(r0, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: ringCol.clone() })); h.rotation.x = Math.PI / 2; pylon.add(h); return h; });
    const logoImg = T.logo.brand ? assets.svg(BRAND[T.logo.brand], T.logo.mono) : assets.img(T.logo.img);
    const lt = new THREE.Texture(logoImg);
    lt.colorSpace = THREE.SRGBColorSpace;
    const upd = () => { lt.needsUpdate = true; };
    if (logoImg?.complete && logoImg.naturalWidth) upd(); else logoImg?.addEventListener('load', upd);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false, color: new THREE.Color(1.15, 1.15, 1.15) }));
    logo.rotation.x = -Math.PI / 2;
    logo.position.set(-3.6, 0.32, -2.2);
    logo.renderOrder = 4;
    g.add(logo);
    const col = new THREE.Color();
    const b = etch.block({
      name: 'ai-' + T.id, w: 12.6, h: 9.2, res: 90, color: col, intensity: 1.3,
      draw(gg) {
        gg.text(String(T.i + 1).padStart(2, '0'), 5.2, 1.2, { font: 'mono', size: 0.55, alpha: 0.6, spacing: 0.1 });
        gg.text(T.name, 5.2, 2.75, { font: 'serif', size: 1.35, weight: 700, maxW: 7.1 });
        gg.rule(0.3, 4.2, 12, { alpha: 0.35, t: 0.05 });
        gg.wrap(t(T.desc), 0.3, 5.4, 12, { font: 'body', size: 0.72, lh: 1.5, alpha: 0.95, maxLines: 4 });
      },
    });
    b.mesh.rotation.x = -Math.PI / 2;
    b.mesh.position.set(0, 0.32, 0.6);
    g.add(b.mesh);
    recolor.push(() => col.set(T.color).lerp(WHITE, 0.45));
    return { T, g, ring, shaft, pylon, halos, b, logo };
  });

  // 章節標題:刻在進城大道的地面上,就在切口後面
  const titleCol = new THREE.Color();
  const title = etch.block({
    name: 'ai-title', w: 30, h: 8.4, res: 60, color: titleCol, intensity: 1.25,
    draw(g) {
      g.text('03 · ' + t('ai.eyebrow'), 15, 1.2, { font: 'mono', size: 0.8, spacing: 0.16, alpha: 0.75, align: 'center' });
      g.text(t('ai.title'), 15, 4.1, { font: 'serif', size: 2.4, weight: 700, align: 'center', maxW: 28 });
      g.wrap(t('ai.sub'), 1.5, 6.2, 27, { font: 'body', size: 0.85, alpha: 0.85, maxLines: 2 });
    },
  });
  title.mesh.rotation.x = -Math.PI / 2;
  title.mesh.position.set(0, 0.04, -7.2);
  root.add(title.mesh);
  recolor.push(() => eraSoft(3, 0.4, titleCol));

  // 中央樞紐:階梯式的塔 + 一圈會轉的環
  const hub = new THREE.Group();
  hub.position.copy(C);
  root.add(hub);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x14111b, metalness: 0.75, roughness: 0.3, emissive: new THREE.Color(0, 0, 0), roughnessMap: P.brushedTex([1, 2]) });
  [[3.6, 1.4, 0], [2.8, 1.8, 1.4], [2.0, 2.4, 3.2], [1.1, 2.2, 5.6]].forEach(([r0, h, y]) => P.mesh(new THREE.CylinderGeometry(r0 * 0.92, r0, h, 6), hubMat, 0, y + h / 2, 0, hub));
  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.1, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color() }));
  hubRing.rotation.x = Math.PI / 2;
  hubRing.position.y = 0.3;
  hub.add(hubRing);
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.05, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color() }));
  orbit.position.y = 6.2;
  hub.add(orbit);
  recolor.push(() => { eraSoft(3, 0.3, hubRing.material.color).multiplyScalar(2); era(3, hubMat.emissive).multiplyScalar(0.22); eraSoft(3, 0.4, orbit.material.color).multiplyScalar(2.4); era(3, strapMat.emissive).multiplyScalar(0.12); });

  // ---------- 鏡頭:進城一個,之後每兩個廣場一個 ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const groupKey = (G, name) => {
    const um = G.reduce((a, T) => a.add(T.u), new THREE.Vector3()).normalize();
    const Mp = C.clone().addScaledVector(um, R);
    const cam = C.clone().addScaledVector(um, G.length > 1 ? -9 : -4).add(V(0, G.length > 1 ? 31 : 24, 0));
    return { name, T: Mp.clone().addScaledVector(um, 1.5), O: cam.sub(Mp), fog: [2.5, 12], tools: G.map((T) => T.i) };
  };
  const keys = [{ name: 'ai.plaza', T: V(0, 0, -8), O: V(0, 11, 17), fog: [3, 14], tools: [] }];
  for (let i = 0; i < NT; i += 2) keys.push(groupKey(TOOLS.slice(i, i + 2), 'ai.' + i / 2));

  // ---------- 互動:游標 + 脈衝 ----------
  let pulseSlot = 0;
  const invM = new THREE.Matrix4(), lray = new THREE.Ray(), gp = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function groundHit(ray, g) { invM.copy(g.matrixWorld).invert(); lray.copy(ray.ray).applyMatrix4(invM); return lray.intersectPlane(gp, hit); }
  let spaceG = null;
  // 每個廣場在哪個鏡頭點亮:該鏡頭前一點點(同一組的第二個稍晚)
  const litAt = TOOLS.map((T) => { const ki = keys.findIndex((K) => K.tools.includes(T.i)); return { ki, sub: keys[ki].tools.indexOf(T.i) }; });

  function update(st) {
    const { s, k, time, dt } = st;
    const first = st.first('ai');
    // 頂蓋蓋著的時候(切開之前、04 章合回去之後)晶粒上的城市看不到,整座不畫;開場晶片還沒聚合出來時照畫
    root.visible = st.tLoad < 2.7 || (s > k('about.cut') - 0.2 && s < st.first('projects') - 0.3);
    const near = (idx) => Math.exp(-Math.pow((s - idx) / 0.45, 2));
    U.uZone.value[NT] = smooth(first - 0.6, first, s);
    U.uFocus.value[NT] = near(first);
    plazas.forEach((Pz, i) => {
      const at = first + litAt[i].ki - 0.6 + litAt[i].sub * 0.15;
      const on = smooth(at - 0.3, at + 0.2, s);
      U.uZone.value[i] = on;
      U.uFocus.value[i] = near(first + litAt[i].ki);
      Pz.b.mat.uniforms.uReveal.value = smooth(at - 0.2, at + 0.4, s);
      Pz.ring.material.color.set(Pz.T.color).multiplyScalar(0.4 + on * 2.2 + U.uFocus.value[i] * 1.2);
      Pz.shaft.material.emissiveIntensity = 0.3 + on * 1.4;
      Pz.shaft.scale.y = 1 + on * 3.5;
      Pz.shaft.position.y = Pz.shaft.scale.y / 2;
      Pz.halos.forEach((h, j) => { h.position.y = 1.2 + on * (2.2 + j * 1.3) + Math.sin(time * 1.4 + j) * 0.15; h.rotation.z += dt * (0.6 + j * 0.4); h.material.color.set(Pz.T.color).multiplyScalar(on * 2); });
      Pz.logo.material.opacity = 0.35 + on * 0.65;
    });
    title.mat.uniforms.uReveal.value = smooth(first - 0.45, first - 0.05, s);
    orbit.rotation.x = Math.PI / 2 + Math.sin(time * 0.5) * 0.25;
    orbit.rotation.z += dt * 0.5;
    const lit = U.uZone.value[NT];
    strapMat.opacity = 0.25 + lit * 0.35;
  }
  function post(st, SP) {
    spaceG = SP.die.g;
    if (!SP.die.g.visible) return;
    SP.die.g.updateMatrixWorld();
    if (st.pointer.on > 0.01) {
      st.ray.setFromCamera(st.pointer.ndc, st.camera);
      if (groundHit(st.ray, SP.die.g)) U.uCursor.value.set(hit.x, hit.z);
    }
    U.uCursorOn.value = st.pointer.on;
  }
  function pulse(ray, st) {
    if (!spaceG || !spaceG.visible || st.i < st.first('ai') - 1 || st.i > st.last('ai')) return;
    if (!groundHit(ray, spaceG)) return;
    U.uPulse.value[pulseSlot].set(hit.x, hit.z, st.time, 1);
    pulseSlot = (pulseSlot + 1) % MAX_PULSES;
  }

  return { root, update, post, pulse, keys, hotMeshes: [], count: N };
}
