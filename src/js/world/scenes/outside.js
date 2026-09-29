// 07 訊號送出 —— 飛出窗外:台中的夜景,訊號射向天空,重組成聯絡方式。
//
// 房間(主空間)在一棟大樓的十樓,窗戶朝向市區。鏡頭從桌前穿過窗戶飛出去,眼前是一整座城:
//   - 七期那一帶是玻璃帷幕高樓:樓層燈帶、鋁框分隔、樓頂有燈飾和尖塔、航空障礙燈在閃
//   - 中間是住宅大樓:陽台一層一層,窗戶冷暖不一,偶爾有電視的藍光在閃
//   - 近處是透天店面:一樓招牌燈、鐵窗、頂樓加蓋與水塔、冷氣外機,外牆掛著直立的中文霓虹招牌
//   - 路面有車道線、斑馬線與一圈一圈的鈉燈光暈;汽車頭燈尾燈與一大片機車燈在流動,台灣大道斜斜穿過去
//   - 高架的捷運綠線有列車在跑,一條河反射著燈光,公園有樹與步道燈,還有一座像歌劇院的地標
//   - 天空:城市光害、被照亮的低雲、月亮、閃燈的飛機;東邊是山
// 主機的訊號變成一道光粒子從窗戶射出去,在天空中重組成「一起做點什麼吧。」和兩個可以點的連結。
//
// 座標:outside 空間(公尺)。大樓立面在 z = 0,市區在 -z 方向。

import * as THREE from 'three';
import { t } from '../../i18n.js';
import { CONTACT } from '../../../data/world.js';
import { era, eraSoft, WHITE } from '../era.js';
import { makeSwarm } from '../particles.js';
import * as P from '../parts.js';
import { DESK_Y } from './room.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
// 房間在大樓十樓:主空間的地板(DESK_Y - 75 公分)落在 y = 30 公尺
const FLOOR_Y = 30;
export const ROOM_MATRIX = new THREE.Matrix4().makeTranslation(0.6, FLOOR_Y - (DESK_Y - 75) / 100, 0.8).multiply(new THREE.Matrix4().makeScale(0.01, 0.01, 0.01));
const SKY = { x: 0, y: 225, z: -330, w: 250, h: 116 }; // 高過天際線:字與按鈕不能疊在高樓上
const WIN_Y = FLOOR_Y + 1.5;

// ---------- 城市的格局 ----------
const BLOCK = 64;                                   // 街廓間距
const roadHalf = (i) => (i % 4 === 0 ? 13 : 7);     // 每四條一條大道
const CBD = new THREE.Vector2(120, -760);            // 七期(高樓區)
const PARK = { x: -380, z: -820, r: 150 };
const OPERA = { x: 230, z: -560, w: 110, d: 70, h: 38 };
// 台灣大道:一條斜的大路(z = BLVD.a * x + BLVD.b)
const BLVD = { a: -0.9, b: -240, half: 20 };
const blvdDist = (x, z) => Math.abs(z - (BLVD.a * x + BLVD.b)) / Math.hypot(1, BLVD.a);
// 河:沿著一條彎曲的路線
const RIVER = new THREE.CatmullRomCurve3([[-1300, -260], [-700, -420], [-250, -380], [150, -1060], [600, -1250], [1300, -1150]].map(([x, z]) => new THREE.Vector3(x, 0.15, z)));
const RIVER_PTS = RIVER.getSpacedPoints(160);
const riverDist = (x, z) => { let m = 1e9; for (const p of RIVER_PTS) m = Math.min(m, (p.x - x) ** 2 + (p.z - z) ** 2); return Math.sqrt(m); };
// 捷運綠線(高架)
const MRT = new THREE.CatmullRomCurve3([[-1300, -330], [-650, -500], [-120, -620], [420, -900], [1000, -1380], [1400, -1700]].map(([x, z]) => new THREE.Vector3(x, 13, z)));

function hash2(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }

// 直立霓虹招牌的字(直排)
const SIGNS = ['咖啡', '牙醫診所', '便利商店', '麻辣鍋', '補習班', '網咖', '旅店', '銀行', '藥局', '早餐店', '燒肉', 'KTV', '手搖飲', '眼鏡行', '夜市', '書店'];
const SIGN_COLS = ['#ff3b6b', '#35d7ff', '#ffd23b', '#7cff6b', '#ff8a2b', '#c77dff', '#ffffff', '#ff5ec4'];

// 鏡頭資料一開始就要有;整座城市延後到瀏覽器閒下來才建(populate)
export function buildOutside(ctx) {
  const root = new THREE.Group();
  root.name = 'outside';
  root.visible = false;
  const hot = [];
  let impl = null;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const keys = [
    { name: 'contact.out', space: 'main', T: V(-60, 46, -2600), O: V(0, 4, 2560), fog: [3, 30] },
    { name: 'contact.window', T: V(0, 26, -520), O: V(0, 38, 500), fog: [1.4, 9] },
    { name: 'contact.sky', T: V(SKY.x, SKY.y - 6, SKY.z), O: V(0, -64, 372), fog: [1.5, 10] },
  ];
  return {
    root, keys, hotMeshes: hot, roomMatrix: ROOM_MATRIX,
    get ready() { return !!impl; },
    populate() { if (!impl) impl = constructOutside(ctx, root, hot); return impl; },
    update(st) { if (impl) impl.update(st); else root.visible = false; },
    post(st) { impl?.post(st); },
    pulse(ray, st) { impl?.pulse(ray, st); },
  };
}

function constructOutside(ctx, root, hot) {
  const { etch, recolor, mobile, U: GU } = ctx;
  const r = P.rng(77);
  const M = P.materials();
  const dens = mobile ? 0.55 : 1;
  const extent = mobile ? 850 : 1150;

  // ---------- 天空:漸層 + 光害 + 星星 + 月亮 + 低雲 ----------
  const skyU = { uTop: { value: new THREE.Color(0x04030a) }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uTop, uHor, uGlow; varying vec3 vD;
      void main(){
        float h = clamp(vD.y, -0.2, 1.0);
        vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.5, h));
        c += uGlow * exp(-max(h, 0.0) * 12.0);           // 城市光害(貼著地平線)
        c += uGlow * 0.35 * exp(-max(h, 0.0) * 3.0);      // 往上漸淡的一層
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.renderOrder = -10;
  root.add(sky);
  const SN = mobile ? 700 : 1800;
  const sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) {
    const a = r() * Math.PI * 2, e = 0.18 + Math.pow(r(), 0.6) * 1.3;
    sp.set([Math.cos(a) * Math.cos(e) * 3500, Math.sin(e) * 3500, Math.sin(a) * Math.cos(e) * 3500], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  root.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xd8d4e8, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.6, depthWrite: false, fog: false })));
  // 月亮 + 月暈
  const soft = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  const moon = new THREE.Mesh(new THREE.CircleGeometry(42, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.55, 1.45), fog: false }));
  moon.position.set(-1500, 1150, -2600);
  moon.lookAt(0, 0, 0);
  root.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(0.35, 0.33, 0.4), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(520, 520, 1); halo.position.copy(moon.position); root.add(halo);
  // 低雲:幾片被城市從下面照亮的雲(雜訊透明度)
  const cloudTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    for (let i = 0; i < 70; i++) { const px = r() * 256, py = 70 + r() * 116, rr = 20 + r() * 50; const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
    return new THREE.CanvasTexture(c);
  })();
  const cloudCol = new THREE.Color();
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    // 自己寫著色器:亮度 = 顏色 × 貼圖透明度(明確控制),避免 canvas 貼圖的未預乘白色被加法混色放大成一整片白
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1800, 700), new THREE.ShaderMaterial({
      uniforms: { map: { value: cloudTex }, uCol: { value: cloudCol } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 uCol; varying vec2 vUv; void main(){ float a = texture2D(map, vUv).a; float edge = smoothstep(0.0, 0.2, vUv.x) * (1.0 - smoothstep(0.8, 1.0, vUv.x)); gl_FragColor = vec4(uCol * a * edge * 0.9, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(-900 + i * 520 + r() * 200, 520 + r() * 260, -1300 - r() * 900);
    root.add(m); clouds.push(m);
  }
  // 飛機:一顆會閃的燈慢慢橫過天空
  const plane = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.6, 0.5), fog: false }));
  root.add(plane);

  // ---------- 山(東邊的稜線)+ 山上零星的燈 ----------
  for (let layer = 0; layer < 3; layer++) {
    const pts = [];
    const z = -2300 - layer * 500, n = 140;
    for (let i = 0; i <= n; i++) {
      const x = -3200 + (6400 * i) / n;
      const y = 70 + layer * 55 + 180 * Math.pow(Math.abs(Math.sin(i * 0.11 + layer) * Math.sin(i * 0.037 + layer * 2)), 0.8) + 40 * Math.sin(i * 0.5 + layer);
      pts.push(x, y, z, x, -20, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const idx = [];
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.014 + layer * 0.005, 0.012 + layer * 0.005, 0.024 + layer * 0.007), fog: false }));
    m.renderOrder = -9 + layer;
    root.add(m);
  }
  const vl = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) vl.set([-2600 + r() * 5200, 40 + r() * 140, -2280 - r() * 60], i * 3);
  const vlg = new THREE.BufferGeometry(); vlg.setAttribute('position', new THREE.BufferAttribute(vl, 3));
  root.add(new THREE.Points(vlg, new THREE.PointsMaterial({ color: new THREE.Color(1, 0.75, 0.45), size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.6, depthWrite: false, fog: false })));

  // ---------- 建築:一個 InstancedMesh,類型寫在屬性裡,窗戶在著色器裡畫 ----------
  // 類型:0 玻璃帷幕高樓、1 住宅大樓、2 透天店面、3 裙樓(商場)、4 樓頂燈飾
  const B = [];
  const add = (x, y0, z, w, h, d, type) => B.push([x, y0, z, w, h, d, type, r()]);
  const signs = [], tanks = [], boxes = [], spires = [], acs = [];
  const nearView = (x, z) => Math.abs(x) < 170 && z > -320; // 窗前這一片只有透天厝,視線才不會被擋住
  const I0 = Math.floor(-extent / BLOCK), I1 = Math.ceil(extent / BLOCK), J0 = Math.floor(-2000 / BLOCK), J1 = -1;
  for (let i = I0; i < I1; i++) for (let j = J0; j < J1; j++) {
    // 街廓的範圍(扣掉道路)
    const x0 = i * BLOCK + roadHalf(i) + 3, x1 = (i + 1) * BLOCK - roadHalf(i + 1) - 3;
    const z0 = j * BLOCK + roadHalf(j) + 3, z1 = (j + 1) * BLOCK - roadHalf(j + 1) - 3;
    const bx = (x0 + x1) / 2, bz = (z0 + z1) / 2;
    if (bz > -40) continue;
    if (Math.abs(bx) < 30 && bz > -110) continue; // 自己這棟樓前面
    if (Math.hypot(bx - PARK.x, bz - PARK.z) < PARK.r) continue;
    if (Math.abs(bx - OPERA.x) < OPERA.w / 2 + 40 && Math.abs(bz - OPERA.z) < OPERA.d / 2 + 40) continue;
    const dC = Math.hypot(bx - CBD.x, bz - CBD.y);
    // 一個街廓切成 2×2 塊地
    const nx = 2, nz = 2;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      if (r() > 0.93 * dens + 0.05) continue;
      const lx0 = x0 + ((x1 - x0) * a) / nx, lx1 = x0 + ((x1 - x0) * (a + 1)) / nx;
      const lz0 = z0 + ((z1 - z0) * b) / nz, lz1 = z0 + ((z1 - z0) * (b + 1)) / nz;
      const cx = (lx0 + lx1) / 2, cz = (lz0 + lz1) / 2, lw = lx1 - lx0 - 2, ld = lz1 - lz0 - 2;
      if (blvdDist(cx, cz) < BLVD.half + 14 || riverDist(cx, cz) < 34) continue;
      const q = r();
      const near = nearView(cx, cz);
      let type;
      if (dC < 280 && !near) type = q < 0.72 ? 0 : 1;
      else if (dC < 700 && !near) type = q < 0.15 ? 0 : q < 0.6 ? 1 : 2;
      else type = q < 0.08 && !near ? 1 : 2;
      if (type === 0) {
        // 裙樓 + 塔樓 + 樓頂燈飾(+ 尖塔)
        const ph = 12 + r() * 10;
        add(cx, 0, cz, lw, ph, ld, 3);
        const tw = lw * (0.55 + r() * 0.25), td = ld * (0.55 + r() * 0.25);
        const th = 80 + Math.pow(r(), 1.6) * 160 * (1 - dC / 400);
        add(cx, ph, cz, tw, th, td, 0);
        const ch = 5 + r() * 6;
        add(cx, ph + th, cz, tw * 0.82, ch, td * 0.82, 4);
        if (r() < 0.45) spires.push([cx, ph + th + ch + 12, cz, 0, 1, 1, 1]);
      } else if (type === 1) {
        const h = 40 + Math.pow(r(), 1.3) * 80 * (dC < 700 ? 1 : 0.6);
        const w = lw * (0.6 + r() * 0.3), d = ld * (0.5 + r() * 0.3);
        add(cx, 0, cz, w, h, d, 1);
        if (cz > -1300) for (let k = 0; k < 2; k++) tanks.push([cx + (r() - 0.5) * w * 0.6, h + 1.4, cz + (r() - 0.5) * d * 0.6]);
        if (r() < 0.5) boxes.push([cx + (r() - 0.5) * w * 0.4, h + 1.6, cz + (r() - 0.5) * d * 0.4, 0, w * 0.3, 3.2, d * 0.3]);
      } else {
        // 透天店面:一排 3~5 間,面寬 4~5 公尺
        const n = 3 + Math.floor(r() * 3);
        const unit = lw / n;
        for (let k = 0; k < n; k++) {
          const ux = lx0 + 1 + unit * (k + 0.5), h = 9 + Math.floor(r() * 4) * 3.1;
          add(ux, 0, cz, unit - 0.25, h, ld, 2);
          if (r() < 0.45) boxes.push([ux + (r() - 0.5) * 1.5, h + 1.4, cz + (r() - 0.5) * ld * 0.4, 0, unit * 0.7, 2.8, ld * 0.45]); // 頂樓加蓋
          // 水塔、冷氣外機這種小東西只在近、中景放(遠處看不出來,只是浪費三角形)
          const nearish = cz > -1000;
          if (nearish && r() < 0.5) tanks.push([ux + (r() - 0.5) * 1.5, h + 1.1, cz - ld * 0.3]);
          if (cz > -600) for (let a2 = 0; a2 < 2; a2++) if (r() < 0.5) acs.push([ux + (r() - 0.5) * (unit - 1.5), 4 + r() * (h - 6), cz + ld / 2 + 0.35]);
          // 直立招牌:掛在朝向鏡頭(+z)的立面上
          if (r() < 0.55 && cz + ld / 2 > -1300) signs.push([ux + (r() - 0.5) * (unit - 1.6), 5 + r() * Math.max(0.5, h - 12), cz + ld / 2 + 0.3, Math.floor(r() * SIGNS.length), Math.floor(r() * SIGN_COLS.length)]);
        }
      }
    }
  }
  // 自己住的那棟樓
  add(0, 0, 12.5, 30, 62, 25, 1);
  // 歌劇院(地標):一個大量體,立面是有機的洞
  const NB = B.length;
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const aType = new Float32Array(NB), aSeed = new Float32Array(NB);
  // 夜裡沒亮的牆面要夠暗(窗戶才跳得出來):環境反射壓到幾乎沒有
  const bMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0f, metalness: 0.2, roughness: 0.7, envMapIntensity: 0.03 });
  const bIM = new THREE.InstancedMesh(bGeo, bMat, NB);
  const m4 = new THREE.Matrix4();
  B.forEach(([x, y0, z, w, h, d, type, s], k) => { m4.makeScale(w, h, d).setPosition(x, y0, z); bIM.setMatrixAt(k, m4); aType[k] = type; aSeed[k] = s * 91 + k * 0.37; });
  bGeo.setAttribute('aType', new THREE.InstancedBufferAttribute(aType, 1));
  bGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  const cityU = { uTime: GU.uTime, uWarm: { value: new THREE.Color(1, 0.74, 0.44) }, uCool: { value: new THREE.Color(0.62, 0.78, 1) }, uEra: { value: new THREE.Color() }, uEra2: { value: new THREE.Color() }, uOn: { value: 0 } };
  bMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, cityU);
    sh.vertexShader = 'attribute float aSeed; attribute float aType; varying float vSeed; varying float vType; varying vec3 vLP; varying vec3 vScale; varying vec3 vN2;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vSeed = aSeed; vType = aType; vLP = position; vN2 = normal;
      vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));`);
    sh.fragmentShader = `uniform float uTime, uOn; uniform vec3 uWarm, uCool, uEra, uEra2;
      varying float vSeed; varying float vType; varying vec3 vLP; varying vec3 vScale; varying vec3 vN2;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      ` + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float side = 1.0 - step(0.5, abs(vN2.y));
        // 立面座標(公尺):水平 u、高度 v
        float u = abs(vN2.x) > 0.5 ? vLP.z * vScale.z : vLP.x * vScale.x;
        float v = vLP.y * vScale.y;
        vec3 e = vec3(0.0);
        int T = int(vType + 0.5);
        if (T == 0) {
          // 玻璃帷幕:每層 3.8 公尺一條燈帶,有些樓層整層亮(辦公室),鋁框每 1.5 公尺
          float fl = floor(v / 3.8);
          float fr = fract(v / 3.8);
          float r0 = hh(vec2(fl, vSeed));
          float litF = step(0.62, r0);
          float band = step(0.22, fr) * step(fr, 0.86);
          float mull = step(0.08, fract(u / 1.5));
          // 同一層也不是整排都亮:每一格(1.5 公尺)各自開關,亮度也不同
          float cellR = hh(vec2(floor(u / 1.5), fl) + vSeed);
          float cellOn = step(0.3, cellR) * (0.5 + 0.5 * cellR);
          vec3 wc = mix(uCool, vec3(1.0, 0.93, 0.84), step(0.55, hh(vec2(fl * 1.3, vSeed))));
          e += wc * band * mull * litF * cellOn * 0.26;
          // 沒亮的樓層:玻璃映著一點天光(很淡的藍紫漸層)
          e += vec3(0.018, 0.024, 0.045) * band * (0.6 + 0.4 * sin(u * 0.25 + v * 0.015 + vSeed));
        } else if (T == 1) {
          // 住宅:3.2 × 3.0 一格窗,冷暖不一;每層一道陽台的暗帶;少數窗是電視藍光在閃
          vec2 cell = floor(vec2(u / 3.2, v / 3.0));
          vec2 fr = fract(vec2(u / 3.2, v / 3.0));
          float win = step(0.2, fr.x) * step(fr.x, 0.8) * step(0.3, fr.y) * step(fr.y, 0.82);
          float rr = hh(cell + vSeed);
          float lit = step(0.6, rr) * win;
          // 每扇窗亮度不同:有的拉了窗簾(暗一點)、有的只開小燈
          float lvl = 0.35 + 0.65 * hh(cell * 2.9 + vSeed);
          lit *= lvl;
          vec3 wc = mix(uWarm, uCool, step(0.78, hh(cell * 1.7 + vSeed)));
          wc = mix(wc, vec3(1.0, 0.55, 0.3), step(0.9, hh(cell * 5.1 + vSeed)));
          float tv = step(0.965, hh(cell * 3.3 + vSeed)) * (0.6 + 0.4 * sin(uTime * (7.0 + rr * 9.0) + rr * 30.0));
          e += (wc * lit * 0.55 + vec3(0.35, 0.55, 1.0) * tv * win * 0.6) * (1.0 - step(fr.y, 0.12) * 0.8);
        } else if (T == 2) {
          // 透天店面:一樓店面燈(亮、有顏色)、樓上鐵窗
          float shop = 1.0 - step(3.8, v);
          float rs = hh(vec2(floor(u / 4.5), vSeed));
          vec3 sc = rs < 0.35 ? vec3(1.0, 0.95, 0.85) : rs < 0.6 ? uWarm : rs < 0.8 ? vec3(0.8, 1.0, 0.9) : uEra2;
          e += sc * shop * step(0.6, v) * step(0.12, rs) * 0.42;
          vec2 cell = floor(vec2(u / 3.0, (v - 4.0) / 3.1));
          vec2 fr = fract(vec2(u / 3.0, (v - 4.0) / 3.1));
          float win = step(0.18, fr.x) * step(fr.x, 0.82) * step(0.28, fr.y) * step(fr.y, 0.85) * step(4.0, v);
          float grill = 0.75 + 0.25 * step(0.5, fract(fr.x * 6.0));
          e += uWarm * win * step(0.55, hh(cell + vSeed)) * 0.45 * grill;
        } else if (T == 3) {
          // 裙樓(商場):幾道發光的水平燈帶 + 一樓大片玻璃
          float bands = step(0.94, fract(v / 4.0 + 0.03));
          e += uEra * bands * 0.9 + vec3(1.0, 0.92, 0.8) * (1.0 - step(5.0, v)) * step(0.8, v) * 0.5;
        } else {
          // 樓頂燈飾:一圈亮帶 + 豎條
          float stripes = step(0.8, fract(u / 1.6));
          float topBand = step(vScale.y - 0.8, v);
          e += mix(uEra, vec3(1.0), 0.25) * (0.12 + 0.4 * stripes + 0.6 * topBand) * (0.85 + 0.15 * sin(uTime * 0.8 + vSeed));
        }
        e *= side;
        // 頂樓的紅色航空障礙燈(高樓才有)
        float roof = step(0.5, vN2.y) * step(70.0, vScale.y);
        e += vec3(1.0, 0.1, 0.06) * roof * exp(-dot(vLP.xz * vScale.xz, vLP.xz * vScale.xz) / 6.0) * step(0.0, sin(uTime * 3.0 + vSeed)) * 5.0;
        totalEmissiveRadiance += e * uOn;
      }`);
  };
  bIM.frustumCulled = false;
  root.add(bIM);
  // 樓頂的東西:水塔、頂樓加蓋、冷氣外機、尖塔
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1b20, metalness: 0.3, roughness: 0.7 });
  if (tanks.length) P.instances(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 7), new THREE.MeshStandardMaterial({ color: 0x3a3d45, metalness: 0.8, roughness: 0.4 }), tanks, root);
  if (boxes.length) P.instances(P.boxG(1, 1, 1), roofMat, boxes, root);
  if (acs.length) P.instances(P.boxG(0.9, 0.7, 0.5), new THREE.MeshStandardMaterial({ color: 0x8c8f96, roughness: 0.6 }), acs, root);
  const spireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color() });
  if (spires.length) P.instances(new THREE.CylinderGeometry(0.2, 0.9, 24, 8), spireMat, spires, root);

  // 歌劇院:大量體 + 立面一個個有機的洞(發光)
  const opCan = document.createElement('canvas'); opCan.width = 1024; opCan.height = 384;
  { const x = opCan.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 384);
    for (let i = 0; i < 26; i++) { const cx = 20 + r() * 984, cy = 30 + r() * 320, rx = 30 + r() * 70, ry = 25 + r() * 60; const g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry)); g.addColorStop(0, 'rgba(255,214,160,1)'); g.addColorStop(0.75, 'rgba(255,180,110,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); } }
  const opTex = new THREE.CanvasTexture(opCan); opTex.colorSpace = THREE.SRGBColorSpace;
  const opera = P.mesh(P.rbox(OPERA.w, OPERA.h, OPERA.d, 6), new THREE.MeshStandardMaterial({ color: 0x1b1a20, roughness: 0.8, emissiveMap: opTex, emissive: new THREE.Color(0, 0, 0) }), OPERA.x, OPERA.h / 2, OPERA.z, root);

  // 直立霓虹招牌:一張字卡圖集,每塊招牌取其中一格;有些會閃
  const SW = 128, SH = 480;
  const atlas = document.createElement('canvas'); atlas.width = SW * 8; atlas.height = SH * 2;
  { const x = atlas.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, atlas.width, atlas.height);
    SIGNS.forEach((txt, i) => {
      const ox = (i % 8) * SW, oy = Math.floor(i / 8) * SH, col = SIGN_COLS[i % SIGN_COLS.length];
      x.fillStyle = '#0a0a0e'; x.fillRect(ox + 8, oy + 8, SW - 16, SH - 16);
      x.strokeStyle = col; x.lineWidth = 7; x.strokeRect(ox + 14, oy + 14, SW - 28, SH - 28);
      x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
      const chars = [...txt];
      const fs = Math.min(88, (SH - 70) / chars.length);
      x.font = `900 ${fs}px 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif`;
      chars.forEach((ch, k) => x.fillText(ch, ox + SW / 2, oy + 40 + fs * (k + 0.5) + (SH - 80 - fs * chars.length) / 2));
    }); }
  const atlasTex = new THREE.CanvasTexture(atlas); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 4;
  let signMesh = null;
  if (signs.length) {
    const sg = new THREE.PlaneGeometry(1.3, 4.9);
    const cellA = new Float32Array(signs.length * 2), flick = new Float32Array(signs.length);
    signs.forEach((S, i) => { cellA.set([S[3] % 8, Math.floor(S[3] / 8)], i * 2); flick[i] = r(); });
    sg.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellA, 2));
    sg.setAttribute('aFlick', new THREE.InstancedBufferAttribute(flick, 1));
    const sm = new THREE.MeshBasicMaterial({ map: atlasTex, color: new THREE.Color(1.35, 1.35, 1.35), fog: true });
    const signU = { uTime: GU.uTime, uOn: { value: 0 } };
    sm.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, signU);
      // 圖集 8 × 2 格;canvas 上面那排在貼圖的 v = 0.5..1
      sh.vertexShader = 'attribute vec2 aCell; attribute float aFlick; varying float vFlick;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = vec2((uv.x + aCell.x) / 8.0, (uv.y + 1.0 - aCell.y) / 2.0); vFlick = aFlick;');
      sh.fragmentShader = 'uniform float uTime, uOn; varying float vFlick;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n float fk = vFlick > 0.9 ? step(0.2, fract(sin(floor(uTime * 9.0 + vFlick * 50.0)) * 437.5)) : 1.0;\n diffuseColor.rgb *= uOn * fk;');
    };
    signMesh = P.instances(sg, sm, signs.map(([x, y, z]) => [x, y, z]), root);
    signMesh.userData.U = signU;
  }

  // ---------- 地面:路、人行道、車道線、斑馬線、鈉燈光暈(全部在著色器裡算)----------
  const ground = P.mesh(new THREE.PlaneGeometry(5200, 3600), new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uOn: { value: 0 }, uSodium: { value: new THREE.Color(1, 0.62, 0.28) } }]),
    // 平面轉平之後:本地 (x, y) → 城市座標 (x, -y - 1300)。用城市座標算,不用 modelMatrix(它含空間換算)
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vW = vec3(position.x, 0.0, -position.y - 1300.0); vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uOn; uniform vec3 uSodium; varying vec3 vW;
      #include <fog_pars_fragment>
      float roadHalf(float i){ return mod(i, 4.0) < 0.5 ? 13.0 : 7.0; }
      void main(){
        vec2 p = vW.xz;
        float B = ${BLOCK.toFixed(1)};
        float ix = floor(p.x / B + 0.5), iz = floor(p.y / B + 0.5);
        float dx = abs(p.x - ix * B), dz = abs(p.y - iz * B);
        float hx = roadHalf(abs(ix)), hz = roadHalf(abs(iz));
        // 台灣大道
        float bd = abs(p.y - (${BLVD.a.toFixed(3)} * p.x + ${BLVD.b.toFixed(1)})) / ${Math.hypot(1, BLVD.a).toFixed(4)};
        float onX = step(dx, hx), onZ = step(dz, hz), onB = step(bd, ${BLVD.half.toFixed(1)});
        float road = max(max(onX, onZ), onB);
        float walk = max(step(dx, hx + 3.0), step(dz, hz + 3.0)) * (1.0 - road);
        vec3 col = vec3(0.008, 0.008, 0.011);
        col = mix(col, vec3(0.02, 0.02, 0.025), walk);
        col = mix(col, vec3(0.011, 0.011, 0.014), road);
        // 車道線:中線(黃)、分隔線虛線(白)
        float midX = onX * (1.0 - onZ) * step(dx, 0.18);
        float midZ = onZ * (1.0 - onX) * step(dz, 0.18);
        float dashX = onX * (1.0 - onZ) * step(abs(dx - hx * 0.5), 0.12) * step(0.5, fract(p.y / 6.0));
        float dashZ = onZ * (1.0 - onX) * step(abs(dz - hz * 0.5), 0.12) * step(0.5, fract(p.x / 6.0));
        // 斑馬線:路口外側
        float zebra = onX * step(hz, dz) * step(dz, hz + 3.0) * step(0.5, fract(p.x / 0.9)) + onZ * step(hx, dx) * step(dx, hx + 3.0) * step(0.5, fract(p.y / 0.9));
        vec3 paint = vec3(0.16) * (dashX + dashZ + zebra * 0.8) + vec3(0.2, 0.15, 0.02) * (midX + midZ);
        // 鈉燈光暈:路燈在路邊每 32 公尺一盞
        float lx = onX + walk * step(dx, hx + 3.0);
        float poolX = exp(-pow(dx - hx - 1.0, 2.0) / 30.0) * exp(-pow(fract(p.y / 32.0) - 0.5, 2.0) * 60.0);
        float poolZ = exp(-pow(dz - hz - 1.0, 2.0) / 30.0) * exp(-pow(fract(p.x / 32.0) - 0.5, 2.0) * 60.0);
        float poolB = exp(-pow(bd - ${(BLVD.half - 2).toFixed(1)}, 2.0) / 40.0) * 0.8;
        float pool = max(max(poolX, poolZ), poolB);
        col += paint * (0.2 + pool * 0.7) + uSodium * pool * 0.075;
        gl_FragColor = vec4(col * (0.3 + 0.7 * uOn), 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  }), 0, 0, -1300, root);
  ground.rotation.x = -Math.PI / 2;

  // 路燈:桿子 + 燈頭的光點(沿著大道與一般道路)
  const poles = [], lampPts = [];
  for (let i = I0; i <= I1; i++) {
    const x = i * BLOCK, hw = roadHalf(Math.abs(i));
    for (let z = -2000; z < -40; z += 32) {
      if (Math.hypot(x - PARK.x, z - PARK.z) < PARK.r - 10) continue;
      if (z < -900 && hw < 10) continue; // 遠處的小路只畫光點,不畫桿子
      for (const sgn of [-1, 1]) { const px = x + sgn * (hw + 1.2); poles.push([px, 4.2, z, 0]); lampPts.push(px - sgn * 1.4, 8.3, z); }
    }
  }
  for (let j = Math.floor(-2000 / BLOCK); j <= -1; j++) {
    const z = j * BLOCK, hw = roadHalf(Math.abs(j));
    for (let x = -extent; x < extent; x += 32) {
      if (Math.abs(x) < 26 && z > -60) continue;
      for (const sgn of [-1, 1]) { const pz = z + sgn * (hw + 1.2); poles.push([x, 4.2, pz, 0]); lampPts.push(x, 8.3, pz - sgn * 1.4); }
    }
  }
  const poleStep = mobile ? 4 : 2;
  const polesUse = poles.filter((_, i) => i % poleStep === 0);
  P.instances(new THREE.CylinderGeometry(0.12, 0.16, 8.4, 5, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a2c31, metalness: 0.7, roughness: 0.5 }), polesUse, root);
  const lampGeo = new THREE.BufferGeometry();
  lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(lampPts.filter((_, i) => Math.floor(i / 3) % poleStep === 0), 3));
  const lampMat = new THREE.PointsMaterial({ color: new THREE.Color(1, 0.66, 0.32), size: 2.4, map: soft, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  const lamps = new THREE.Points(lampGeo, lampMat);
  lamps.frustumCulled = false;
  root.add(lamps);

  // ---------- 車流:汽車(一對頭燈 / 一對尾燈)+ 機車(單燈,很多)----------
  const lanes = [];
  for (let i = I0; i <= I1; i++) { const hw = roadHalf(Math.abs(i)); lanes.push({ x0: i * BLOCK, z0: -2000, dx: 0, dz: 1960, hw, w: hw > 10 ? 3 : 1 }); }
  for (let j = Math.floor(-2000 / BLOCK); j <= -1; j++) { const hw = roadHalf(Math.abs(j)); lanes.push({ x0: -extent, z0: j * BLOCK, dx: extent * 2, dz: 0, hw, w: hw > 10 ? 3 : 1 }); }
  { const xA = (-40 - BLVD.b) / BLVD.a, xB = (-2000 - BLVD.b) / BLVD.a; lanes.push({ x0: xA, z0: -40, dx: xB - xA, dz: -1960, hw: BLVD.half, w: 5 }); }
  const CN = mobile ? 2600 : 7000;
  const wsum = lanes.reduce((s, L) => s + L.w * Math.hypot(L.dx, L.dz), 0);
  const cAttr = new Float32Array(CN * 4), cLane = new Float32Array(CN * 4), cKind = new Float32Array(CN);
  let ci = 0;
  for (const L of lanes) {
    const n = Math.round((CN * L.w * Math.hypot(L.dx, L.dz)) / wsum);
    for (let k = 0; k < n && ci < CN - 1; k++) {
      const dir = r() < 0.5 ? 1 : -1, ph = r(), sp = 0.4 + r() * 0.7;
      const scooter = r() < 0.55;
      const lane = (scooter ? L.hw - 1.2 : 1.8 + r() * (L.hw - 3.5)) * dir;
      if (scooter) { cLane.set([L.x0, L.z0, L.dx, L.dz], ci * 4); cAttr.set([ph, dir, sp * 0.8, lane], ci * 4); cKind[ci++] = 2; }
      else for (const off of [-0.75, 0.75]) { if (ci >= CN) break; cLane.set([L.x0, L.z0, L.dx, L.dz], ci * 4); cAttr.set([ph, dir, sp, lane + off], ci * 4); cKind[ci++] = 0; }
    }
  }
  const carGeo = new THREE.BufferGeometry();
  carGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ci * 3), 3));
  carGeo.setAttribute('aP', new THREE.BufferAttribute(cAttr.slice(0, ci * 4), 4));
  carGeo.setAttribute('aLane', new THREE.BufferAttribute(cLane.slice(0, ci * 4), 4));
  carGeo.setAttribute('aKind', new THREE.BufferAttribute(cKind.slice(0, ci), 1));
  const carMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uOn: { value: 0 }, uScale: { value: 1 }, uViewH: { value: innerHeight }, uCamZ: { value: 0 } }]),
    vertexShader: `attribute vec4 aP; attribute vec4 aLane; attribute float aKind; uniform float uTime, uScale, uViewH; varying vec3 vC;
      #include <fog_pars_vertex>
      void main(){
        float dir = aP.y;
        float len = length(aLane.zw);
        float u = fract(aP.x + uTime * aP.z * 9.0 / len * dir);
        vec2 t = aLane.zw / len, n = vec2(-t.y, t.x);
        vec3 p = vec3(aLane.x + aLane.z * u + n.x * aP.w, aKind > 1.5 ? 1.0 : 0.75, aLane.y + aLane.w * u + n.y * aP.w);
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float sz = aKind > 1.5 ? 1.3 : 1.7;
        gl_PointSize = clamp(sz * uScale * projectionMatrix[1][1] * uViewH * 0.5 / max(-mvPosition.z, 1e-3), 1.0, 6.0);
        // 往鏡頭開(z 增加)的看到頭燈,離開的看到尾燈
        float toward = dir * sign(aLane.w + 1e-4) > 0.0 ? 1.0 : 0.0;
        if (abs(aLane.w) < 1e-3) toward = step(0.5, fract(aP.x * 7.0));
        vC = aKind > 1.5 ? (toward > 0.5 ? vec3(1.0, 0.93, 0.7) : vec3(1.0, 0.25, 0.15)) * 0.8 : (toward > 0.5 ? vec3(1.0, 0.95, 0.85) : vec3(1.0, 0.12, 0.08));
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uOn; varying vec3 vC;
      #include <fog_pars_fragment>
      void main(){ float d = length(gl_PointCoord - 0.5); float a = 1.0 - smoothstep(0.0, 0.5, d); gl_FragColor = vec4(vC * a * 1.5 * uOn, a);
      #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
  });
  carMat.uniforms.uTime = GU.uTime;
  const cars = new THREE.Points(carGeo, carMat);
  cars.frustumCulled = false;
  root.add(cars);

  // ---------- 捷運綠線:高架橋 + 橋墩 + 一列車 ----------
  const mrt = new THREE.Group();
  root.add(mrt);
  const SEG = 90, beams = [], piers = [];
  for (let i = 0; i < SEG; i++) {
    const a = MRT.getPointAt(i / SEG), b = MRT.getPointAt((i + 1) / SEG);
    const mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
    const ang = Math.atan2(b.x - a.x, b.z - a.z);
    beams.push([mid.x, mid.y, mid.z, 0, 9, 2.2, len + 0.2, 0, ang]);
    if (i % 2 === 0) piers.push([a.x, (a.y - 1.1) / 2, a.z, 0, 1, a.y - 1.1, 1]);
  }
  const concrete = new THREE.MeshStandardMaterial({ color: 0x2b2c31, roughness: 0.85, metalness: 0.05 });
  P.instances(P.boxG(1, 1, 1), concrete, beams, mrt);
  P.instances(new THREE.CylinderGeometry(1.4, 1.6, 1, 10), concrete, piers, mrt);
  // 橋上的一道燈帶(軌道邊的燈)
  const railGlow = new THREE.Mesh(new THREE.TubeGeometry(MRT, 400, 0.18, 4, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(), fog: true }));
  railGlow.position.y = 1.3;
  mrt.add(railGlow);
  // 車站
  const stP = MRT.getPointAt(0.42), stT = MRT.getTangentAt(0.42);
  const station = new THREE.Group(); station.position.copy(stP).add(new THREE.Vector3(0, 3, 0)); station.rotation.y = Math.atan2(stT.x, stT.z); mrt.add(station);
  P.mesh(P.rbox(22, 7, 95, 2), new THREE.MeshStandardMaterial({ color: 0x1e2026, roughness: 0.5, metalness: 0.4, emissive: new THREE.Color(0.35, 0.33, 0.3), emissiveIntensity: 0.25 }), 0, 0, 0, station);
  P.mesh(P.boxG(22.2, 0.5, 95.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1, 0.9), fog: true }), 0, -1, 0, station);
  // 列車:六節,窗戶一條亮帶
  const trainCars = [];
  const tcMat = new THREE.MeshStandardMaterial({ color: 0xd6d8dc, metalness: 0.6, roughness: 0.35, emissive: new THREE.Color(0, 0, 0) });
  const twMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.25, 1.1), fog: true });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    P.mesh(P.rbox(3.2, 3.6, 19, 0.8), tcMat, 0, 0, 0, g);
    P.mesh(P.boxG(3.25, 0.9, 17), twMat, 0, 0.6, 0, g);
    P.mesh(P.boxG(3.25, 0.25, 19), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.2, 0.5), fog: true }), 0, -0.9, 0, g);
    mrt.add(g); trainCars.push(g);
  }
  const headLight = P.mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.8, 3.2) }), 0, 0, 0, mrt);

  // ---------- 河:暗的水面,上面有城市燈光的倒影(閃爍的直條)----------
  const riverGeo = (() => {
    const N = 300, W = 36, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const p = RIVER.getPointAt(i / N), tg = RIVER.getTangentAt(i / N), n = new THREE.Vector3(-tg.z, 0, tg.x);
      const a = p.clone().addScaledVector(n, -W / 2), b = p.clone().addScaledVector(n, W / 2);
      pos.push(a.x, 0.2, a.z, b.x, 0.2, b.z); uv.push(0, i / N * 60, 1, i / N * 60);
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  })();
  const riverMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uOn: { value: 0 }, uWarm: { value: new THREE.Color(1, 0.7, 0.4) }, uEra: { value: new THREE.Color() } }]),
    vertexShader: `varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime, uOn; uniform vec3 uWarm, uEra; varying vec2 vUv;
      #include <fog_pars_fragment>
      float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        // 倒影:沿著河岸方向拉長的光條,隨時間抖動
        vec2 g = vec2(floor(vUv.x * 14.0), floor(vUv.y * 6.0));
        float r0 = hh(g);
        float streak = step(0.72, r0) * (0.5 + 0.5 * sin(uTime * (1.0 + r0 * 3.0) + vUv.y * 40.0 + r0 * 20.0));
        float ripple = 0.5 + 0.5 * sin(vUv.y * 180.0 + uTime * 1.5 + sin(vUv.x * 20.0) * 2.0);
        vec3 c = vec3(0.01, 0.012, 0.02) + mix(uWarm, uEra, step(0.85, r0)) * streak * ripple * 0.35;
        c *= 0.3 + 0.7 * uOn;
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  riverMat.uniforms.uTime = GU.uTime;
  root.add(new THREE.Mesh(riverGeo, riverMat));

  // ---------- 公園:樹 + 步道燈 ----------
  const trees = [], trunks = [], plights = [];
  for (let i = 0; i < (mobile ? 260 : 620); i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (PARK.r - 8);
    const x = PARK.x + Math.cos(a) * d, z = PARK.z + Math.sin(a) * d, h = 6 + r() * 7;
    trees.push([x, h, z, 0, 3 + r() * 2.5, 3 + r() * 2.5, 3 + r() * 2.5]);
    trunks.push([x, h / 2 - 1, z, 0, 1, h - 2, 1]);
  }
  for (let i = 0; i < 80; i++) { const a = (i / 80) * Math.PI * 2; plights.push(PARK.x + Math.cos(a) * (PARK.r * 0.62), 3, PARK.z + Math.sin(a) * (PARK.r * 0.62)); }
  P.instances(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x0c1a10, roughness: 0.9, flatShading: true }), trees, root);
  P.instances(new THREE.CylinderGeometry(0.25, 0.35, 1, 6), new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.9 }), trunks, root);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(plights, 3));
  root.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: new THREE.Color(1, 0.85, 0.6), size: 2, map: soft, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true })));
  P.mesh(new THREE.CircleGeometry(PARK.r, 64), new THREE.MeshStandardMaterial({ color: 0x07100a, roughness: 1 }), PARK.x, 0.1, PARK.z, root).rotation.x = -Math.PI / 2;

  // 城市上空的一層低霧(光害的顏色):貼著地面的巨大透明面,讓遠處自然融進夜色
  const hazeCol = new THREE.Color();
  for (let i = 0; i < 3; i++) {
    const h = P.mesh(new THREE.PlaneGeometry(5000, 3000), new THREE.MeshBasicMaterial({ color: hazeCol, transparent: true, opacity: 0.025, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 0, 25 + i * 30, -1300, root);
    h.rotation.x = -Math.PI / 2;
  }

  // ---------- 天上的聯絡方式:粒子重組 + 清楚的刻字(可以點)----------
  const skyCol = new THREE.Color();
  const skyText = etch.block({
    name: 'contact-sky', w: SKY.w, h: SKY.h, res: 7.2, color: skyCol, intensity: 1.0,
    draw(g) {
      g.text('07 · ' + t('ct.eyebrow'), SKY.w / 2, 12, { font: 'mono', size: 5.2, spacing: 0.2, alpha: 0.7, align: 'center' });
      g.text(t('ct.title'), SKY.w / 2, 42, { font: 'serif', size: 22, weight: 700, align: 'center', maxW: SKY.w - 10 });
      g.text(t('ct.sub'), SKY.w / 2, 60, { font: 'body', size: 7, alpha: 0.85, align: 'center', maxW: SKY.w - 10 });
      const btn = (x, w, label, href) => {
        g.rect(x, 71, w, 17, { stroke: '#fff', lw: 0.8, r: 8.5, alpha: 0.95 });
        g.text(label, x + w / 2, 82.5, { font: 'sans', size: 6.6, weight: 700, align: 'center', spacing: 0.04 });
        g.hot(x, 71, w, 17, href, label);
      };
      btn(SKY.w / 2 - 66, 62, t('ct.mail') + ' →', CONTACT.mail);
      btn(SKY.w / 2 + 4, 62, 'GitHub ↗', CONTACT.github);
      g.text(CONTACT.site + ' · © 2026', SKY.w / 2, 104, { font: 'mono', size: 4.2, alpha: 0.55, align: 'center', spacing: 0.14 });
      g.hot(SKY.w / 2 - 40, 98, 80, 9, 'https://github.com/Tunai-0511/tun9i-site', t('ft.src'));
    },
  });
  skyText.mesh.position.set(SKY.x, SKY.y, SKY.z);
  root.add(skyText.mesh);
  const PN = mobile ? 3000 : 7000;
  const swarmCol = new THREE.Color();
  const swarm = makeSwarm({ count: PN, size: 0.55, color: swarmCol });
  const sample = (() => {
    const c = document.createElement('canvas');
    const S = 3;
    c.width = SKY.w * S; c.height = SKY.h * S;
    const x = c.getContext('2d');
    return () => {
      x.clearRect(0, 0, c.width, c.height);
      x.fillStyle = '#fff'; x.textAlign = 'center';
      x.font = `700 ${22 * S}px 'Playfair Display', 'Songti TC', serif`;
      x.fillText(t('ct.title'), c.width / 2, 42 * S);
      x.lineWidth = 0.8 * S; x.strokeStyle = '#fff';
      for (const bx of [SKY.w / 2 - 66, SKY.w / 2 + 4]) { x.beginPath(); if (x.roundRect) x.roundRect(bx * S, 71 * S, 62 * S, 17 * S, 8.5 * S); else x.rect(bx * S, 71 * S, 62 * S, 17 * S); x.stroke(); }
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const pts = [];
      for (let yy = 0; yy < c.height; yy += 1) for (let xx = 0; xx < c.width; xx += 1) if (d[(yy * c.width + xx) * 4 + 3] > 140) pts.push([xx / S - SKY.w / 2, SKY.h / 2 - yy / S]);
      return pts;
    };
  })();
  const fillTargets = () => {
    const pts = sample();
    swarm.setTo((i, v, rr) => {
      if (!pts.length) { v.set(SKY.x, SKY.y, SKY.z); return; }
      const p = pts[Math.floor(rr() * pts.length)];
      v.set(SKY.x + p[0], SKY.y + p[1], SKY.z + 0.5 + (rr() - 0.5) * 2);
    });
  };
  swarm.setFrom((i, v, rr) => v.set((rr() - 0.5) * 1.2, WIN_Y + (rr() - 0.5) * 0.8, -1.5 - rr() * 6));
  fillTargets();
  document.fonts?.ready.then(fillTargets);
  addEventListener('langchange', () => requestAnimationFrame(fillTargets));
  swarm.U.uOrbitC.value.set(SKY.x, SKY.y, SKY.z);
  swarm.U.uOrbitR.value.set(150, 60, 20);
  swarm.U.uNoise.value = 0.6;
  swarm.U.uCurR.value = 10;
  root.add(swarm.points);
  const beamCol = new THREE.Color();
  const beamGeo = new THREE.CylinderGeometry(0.06, 0.3, 1, 12, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: beamCol, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(0, WIN_Y, -1);
  root.add(beam);
  const bdir = new THREE.Vector3(SKY.x, SKY.y - SKY.h * 0.2, SKY.z).sub(beam.position);
  beam.scale.set(1, bdir.length(), 1);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bdir.clone().normalize());

  recolor.push(() => {
    eraSoft(7, 0.35, skyCol);
    eraSoft(7, 0.3, swarmCol).multiplyScalar(1.4);
    era(7, beamCol).multiplyScalar(1.2);
    eraSoft(7, 0.3, cityU.uEra.value);
    era(5, cityU.uEra2.value);
    era(7, skyU.uGlow.value).multiplyScalar(0.08).add(new THREE.Color(0.06, 0.04, 0.025));
    skyU.uHor.value.set(0.03, 0.024, 0.045);
    era(7, cloudCol).multiplyScalar(0.05).add(new THREE.Color(0.08, 0.05, 0.03));
    era(7, hazeCol).multiplyScalar(0.25).add(new THREE.Color(0.25, 0.15, 0.08));
    eraSoft(7, 0.3, spireMat.color).multiplyScalar(1.5);
    era(3, railGlow.material.color).multiplyScalar(0.6);
    era(7, riverMat.uniforms.uEra.value);
  });

  const tmpV = new THREE.Vector3(), tmpT = new THREE.Vector3();
  function update(st) {
    const { s, k, time, dt } = st;
    // 06 章拍機殼時窗外不必畫(看不到,又很貴);拉遠到桌面時才出現在窗外
    root.visible = s > k('setup.pc') + 0.25;
    // 拍桌面時窗外的城市就已經亮著(桌子後面是一整片夜景)
    const on = smooth(k('setup.pc') + 0.25, k('setup.desk') - 0.2, s);
    cityU.uOn.value = on;
    carMat.uniforms.uOn.value = on;
    ground.material.uniforms.uOn.value = on;
    riverMat.uniforms.uOn.value = on;
    if (signMesh) signMesh.userData.U.uOn.value = on;
    opera.material.emissive.setRGB(1, 1, 1).multiplyScalar(0.9 * on);
    lampMat.opacity = on;
    // 捷運列車沿著高架橋跑
    const tt = (time * 0.012) % 1;
    trainCars.forEach((c, i) => {
      const u = (tt - i * 0.0105 + 1) % 1;
      MRT.getPointAt(u, tmpV); MRT.getTangentAt(u, tmpT);
      c.position.copy(tmpV).add(new THREE.Vector3(0, 3.1, 0));
      c.rotation.y = Math.atan2(tmpT.x, tmpT.z);
    });
    headLight.position.copy(trainCars[0].position).addScaledVector(MRT.getTangentAt(tt, tmpT), 9.8);
    // 飛機
    const pa = (time * 0.01) % 1;
    plane.position.set(-2600 + pa * 5200, 780 + Math.sin(pa * 6) * 40, -1800);
    plane.visible = Math.sin(time * 5) > 0.2;
    clouds.forEach((c, i) => { c.position.x += dt * (1.5 + i * 0.4); if (c.position.x > 2200) c.position.x = -2200; });
    // 粒子與光束
    const fly = smooth(k('contact.window') - 0.1, k('contact.sky') - 0.15, s);
    const U = swarm.U;
    U.uTime.value = time;
    U.uMix.value = fly;
    U.uNoise.value = 0.6 * (1 - fly * 0.8);
    U.uOrbit.value = 0;
    U.uAlpha.value = smooth(0.02, 0.25, fly) * (1 - smooth(k('contact.sky') - 0.1, k('contact.sky') + 0.1, s) * 0.8);
    swarm.points.visible = U.uAlpha.value > 0.01;
    U.uBurst.value *= Math.exp(-dt * 3);
    beam.material.opacity = 0.22 * Math.sin(Math.PI * clamp(fly * 1.2));
    beam.visible = beam.material.opacity > 0.005;
    skyText.mat.uniforms.uReveal.value = smooth(k('contact.sky') - 0.35, k('contact.sky') - 0.02, s);
    // 窗外的夜景是暖紫色的霧,不是房間裡的黑
    st.fogColor.lerp(fogNight, smooth(k('setup.desk') + 0.6, k('contact.window') - 0.2, s));
  }
  const fogNight = new THREE.Color(0x0d0a12);
  function post(st) {
    const kk = st.scaleOf('outside');
    swarm.U.uSpace.value = kk;
    swarm.U.uViewH.value = innerHeight;
    carMat.uniforms.uScale.value = kk;
    carMat.uniforms.uViewH.value = innerHeight;
    lampMat.size = 2.4 * kk;
    if (st.pointer.on > 0.01 && swarm.points.visible) {
      const invM = new THREE.Matrix4().copy(root.parent.matrixWorld).invert();
      st.ray.setFromCamera(st.pointer.ndc, st.camera);
      swarm.U.uCurO.value.copy(st.ray.ray.origin).applyMatrix4(invM);
      swarm.U.uCurD.value.copy(st.ray.ray.direction).transformDirection(invM);
      swarm.U.uCurK.value = st.pointer.on;
    } else swarm.U.uCurK.value = 0;
  }
  function pulse(ray, st) { if (st.i >= st.last('contact') - 1) swarm.U.uBurst.value = 1; }

  hot.push(skyText.mesh);
  return { update, post, pulse, count: NB };
}
