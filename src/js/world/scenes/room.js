// 06 配備 —— 整台主機、桌面、房間。
//
// 顯示卡插回去之後,鏡頭拉遠:主機板裝在一台雙面玻璃的展示型機殼裡 ——
// 鋁框、網孔頂蓋、七個擴充槽擋板、托盤上的銅柱與橡膠理線孔;360 冷排與九顆 RGB 風扇、
// 帶 LCD 的水冷頭、編織套管的 24-pin / EPS / 顯卡供電(有線梳)、顯卡支撐架、前置 I/O。
// 機殼裡有真的補光打在零件上。每個零件旁邊標著規格(SPECS)。
// 再拉遠是整張桌子:兩台螢幕(主螢幕是這一章的標題與 Windows 11 工作列,副螢幕跑 neofetch)、
// 每顆鍵帽都有字的 75% 鍵盤、滑鼠、耳機架、麥克風、螢幕掛燈與幾樣日常小東西(GEAR)。
// 桌子後面是窗戶,07 章從那裡飛出去。
//
// 座標:main 空間(公分)。主機板在 z = BZ,桌面在 y = DESK_Y,後牆(有窗)在 z = WALL_Z。

import * as THREE from 'three';
import { t } from '../../i18n.js';
import { SPECS, GEAR } from '../../../data/world.js';
import { era, eraSoft, WHITE } from '../era.js';
import * as P from '../parts.js';
import { BZ } from './board.js';

export const DESK_Y = -34, WALL_Z = -82;
export const WINDOW = { x0: -130, x1: 6, y0: -2, y1: 96 }; // 窗框開口(主空間座標)
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

// 機殼:x 是前後(前玻璃在 +x)、y 上下、z 是寬(側玻璃在 +z)
const CASE = { x0: -20, x1: 30, y0: DESK_Y + 1.6, y1: 27.5, z0: BZ - 3, z1: BZ + 25 };
const TRAY_Z = BZ - 0.9;

// 鏡頭資料一開始就要有;整個房間(機殼、桌面、牆)延後到瀏覽器閒下來才建(populate)
export function buildRoom(ctx) {
  const root = new THREE.Group();
  root.name = 'room';
  root.visible = false;
  const hot = [];
  let impl = null;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const keys = [
    { name: 'setup.pc', T: V(10, -3, BZ + 10), O: V(7, 9, 124), fog: [2, 7] },
    { name: 'setup.desk', T: V(-64, 6, BZ + 16), O: V(16, 44, 272), fog: [1.6, 6] },
  ];
  return {
    root, keys, hotMeshes: hot, marks: { CASE },
    get ready() { return !!impl; },
    populate() { if (!impl) impl = constructRoom(ctx, root, hot); return impl; },
    update(st) { if (impl) impl.update(st); else root.visible = false; },
    post(st) { impl?.post(st); },
  };
}

function constructRoom(ctx, root, hot) {
  const { etch, recolor, mobile, U: GU, board } = ctx;
  const M = P.materials();
  const detail = mobile ? 0.5 : 1;
  const lights = []; // { light, dist, int }:距離要跟著空間縮放

  // ---------- 材質 ----------
  const anod = new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.85, roughness: 0.34, roughnessMap: P.brushedTex([4, 4]), envMapIntensity: 0.6 }); // 陽極處理鋁
  const powder = new THREE.MeshStandardMaterial({ color: 0x121317, metalness: 0.3, roughness: 0.78 }); // 內部烤漆鋼板
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a4a, metalness: 1, roughness: 0.35 });
  const fanFrame = new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.15, roughness: 0.45 });
  const blade = new THREE.MeshStandardMaterial({ color: 0x2c2e34, metalness: 0.05, roughness: 0.35, transparent: true, opacity: 0.88 });
  const braid = P.braidTex([1, 40]);
  const sleeveBlack = new THREE.MeshStandardMaterial({ color: 0x1c1d22, roughness: 0.6, metalness: 0.1, bumpMap: braid, bumpScale: 0.015, roughnessMap: braid });
  const sleeveLight = new THREE.MeshStandardMaterial({ color: 0xb9bcc4, roughness: 0.55, metalness: 0.05, bumpMap: braid, bumpScale: 0.015, roughnessMap: braid });
  const rgbA = new THREE.Color(), rgbB = new THREE.Color();
  const ringMat = P.rgbMat(GU, rgbA, rgbB, { speed: 0.12, int: 1.0 });
  const fanMats = { ...M, fanFrame, blade, hubCap: anod };

  // ---------- 機殼 ----------
  const cs = new THREE.Group();
  root.add(cs);
  const cx = (CASE.x0 + CASE.x1) / 2, cy = (CASE.y0 + CASE.y1) / 2, cz = (CASE.z0 + CASE.z1) / 2;
  const W = CASE.x1 - CASE.x0, H = CASE.y1 - CASE.y0, D = CASE.z1 - CASE.z0;
  // 頂蓋:鋁框 + 網孔(六角孔)
  P.mesh(P.rbox(W + 0.6, 0.9, D + 0.6, 0.35), anod, cx, CASE.y1 + 0.45, cz, cs);
  const topMesh = P.mesh(new THREE.PlaneGeometry(W - 8, D - 6), new THREE.MeshStandardMaterial({ color: 0x08090b, metalness: 0.6, roughness: 0.5, alphaMap: P.ventTex([10, 6]), transparent: true, depthWrite: false }), cx - 2, CASE.y1 + 0.92, cz, cs);
  topMesh.rotation.x = -Math.PI / 2;
  // 底板 + 腳
  P.mesh(P.rbox(W + 0.6, 1, D + 0.6, 0.35), anod, cx, CASE.y0 - 0.5, cz, cs);
  for (const [x, z] of [[CASE.x0 + 5, CASE.z0 + 4], [CASE.x1 - 5, CASE.z0 + 4], [CASE.x0 + 5, CASE.z1 - 4], [CASE.x1 - 5, CASE.z1 - 4]]) {
    P.mesh(new THREE.CylinderGeometry(1.9, 2.2, 1.2, 32), anod, x, DESK_Y + 0.6, z, cs);
    P.mesh(P.cylG(2.2, 0.15, 32), M.rubber, x, DESK_Y + 0.08, z, cs);
  }
  // 背面外殼 + 主機板托盤(烤漆鋼板)+ 橡膠理線孔 + 銅柱
  P.mesh(P.boxG(W, H, 0.5), anod, cx, cy, CASE.z0, cs);
  P.mesh(P.boxG(W - 2, H - 1, 0.25), powder, cx, cy, TRAY_Z - 0.12, cs);
  const grommet = (x, y, w, h) => {
    const g = new THREE.Group(); g.position.set(x, y, TRAY_Z + 0.02); cs.add(g);
    P.mesh(P.rbox(w, h, 0.3, Math.min(w, h) * 0.45), M.rubber, 0, 0, 0, g);
    P.mesh(P.rbox(w - 0.5, h - 0.5, 0.32, Math.min(w, h) * 0.35), new THREE.MeshBasicMaterial({ color: 0x020203 }), 0, 0, 0.02, g);
  };
  for (const y of [12, 3, -6, -14]) grommet(18.8, y, 2.2, 5.2);
  grommet(-11, 20.6, 6, 1.8);
  grommet(4, 20.6, 6, 1.8);
  grommet(-4, -21, 8, 2);
  const standoffs = [[-15, 17], [-2, 17], [14.8, 17], [-15, 1.6], [14.8, 1.6], [-15, -17], [0, -17.2], [14.8, -17], [7, 10]];
  P.instances(new THREE.CylinderGeometry(0.28, 0.28, 0.8, 6), brass, standoffs.map(([x, y]) => [x, y, BZ - 0.5, 0, 1, 1, 1, Math.PI / 2]), cs);
  // 後面板(I/O 那一側):七個擴充槽擋板(有散熱縫)
  const rear = new THREE.Group();
  rear.position.set(CASE.x0, 0, 0);
  cs.add(rear);
  P.mesh(P.boxG(0.6, H, D), anod, 0, cy, cz, rear);
  const covers = [], slits = [];
  for (let i = 0; i < 7; i++) {
    const y = 0.6 - i * 2.03;
    covers.push([0.4, y, BZ + 6.5]);
    for (let k = 0; k < 6; k++) slits.push([0.42, y, BZ + 2.2 + k * 1.7]);
  }
  P.instances(P.boxG(0.12, 1.85, 11), M.steel, covers, rear);
  P.instances(P.boxG(0.14, 0.18, 1.3), new THREE.MeshBasicMaterial({ color: 0x030304 }), slits, rear);
  // 前置 I/O(頂蓋前緣):電源鍵(一圈燈)、兩個 USB-A、一個 USB-C、耳機孔
  const io = new THREE.Group();
  io.position.set(CASE.x1 - 3.2, CASE.y1 + 0.92, CASE.z1 - 8);
  cs.add(io);
  P.mesh(P.cylG(0.8, 0.25, 32), anod, 0, 0.12, 0, io);
  const pwrRing = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color() }));
  pwrRing.rotation.x = Math.PI / 2; pwrRing.position.y = 0.26; io.add(pwrRing);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x050507 });
  for (const z of [-2.6, -4.3]) P.mesh(P.rbox(0.5, 0.06, 1.3, 0.05), holeMat, 0, 0.02, z, io);
  P.mesh(P.rbox(0.28, 0.06, 0.9, 0.12), holeMat, 0, 0.02, -5.8, io);
  P.mesh(P.cylG(0.18, 0.06, 16), holeMat, 0, 0.02, -7, io);
  // 玻璃:前面 + 側面(無柱轉角),邊緣一圈黑色絲印 + 幾道反光
  const glassBorder = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 512);
    x.fillStyle = '#000'; x.fillRect(22, 22, 468, 468);
    return new THREE.CanvasTexture(c);
  })();
  const glass = (w, h) => {
    const g = new THREE.Group();
    P.mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x0b0d12, metalness: 1, roughness: 0.03, transparent: true, opacity: 0.1, envMapIntensity: 1.8, depthWrite: false }), 0, 0, 0, g).renderOrder = 9;
    P.mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x020203, alphaMap: glassBorder, transparent: true, opacity: 0.92, depthWrite: false }), 0, 0, 0.01, g).renderOrder = 9;
    const s = P.mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: P.glassStreakTex(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0, 0.02, g);
    s.renderOrder = 10;
    return g;
  };
  const side = glass(W, H);
  side.position.set(cx, cy, CASE.z1);
  cs.add(side);
  const frontG = glass(D, H);
  frontG.position.set(CASE.x1, cy, cz);
  frontG.rotation.y = Math.PI / 2;
  cs.add(frontG);
  // 後側的鋁柱(前面那個轉角是無柱的)
  P.mesh(P.rbox(1.2, H + 1, 1.2, 0.4), anod, CASE.x0 + 0.3, cy, CASE.z1 - 0.3, cs);
  const brandCol = new THREE.Color();
  const brand = etch.block({ name: 'case-brand', w: 10, h: 1.2, res: 90, color: brandCol, intensity: 0.8, draw(g) { g.text('TUN9I · O-SERIES', 5, 0.85, { font: 'mono', size: 0.55, align: 'center', spacing: 0.22, alpha: 0.8 }); } });
  brand.mesh.position.set(cx, CASE.y0 + 1.2, CASE.z1 + 0.05);
  cs.add(brand.mesh);

  // ---------- 散熱:360 冷排 + 九顆風扇 ----------
  const fanPoses = [];
  const addFan = (x, y, z, rx, ry) => fanPoses.push({ p: new THREE.Vector3(x, y, z), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)) });
  const RAD_Y = CASE.y1 - 1.9, RAD_Z = BZ + 12.5, RAD_X = cx + 1;
  const rad = new THREE.Group();
  rad.position.set(RAD_X, RAD_Y, RAD_Z);
  cs.add(rad);
  P.mesh(P.rbox(36, 2.7, 12, 0.15), new THREE.MeshStandardMaterial({ color: 0x14151a, metalness: 0.6, roughness: 0.5 }), 0, 0, 0, rad);
  P.finArray({ x: 0, y: -1.39, z: 0, w: 35, h: 0.05, d: 11.6, count: Math.round(160 * detail) + 30, t: 0.035, mat: M.aluDark }, rad);
  for (const x of [-19.2, 19.2]) P.mesh(P.rbox(2.6, 3.2, 12.4, 0.35), anod, x, 0, 0, rad);
  for (const z of [-2.2, 2.2]) P.mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 24), anod, 19.2, -2, z, rad);
  for (const x of [-12.4, 0, 12.4]) addFan(RAD_X + x, RAD_Y - 2.65, RAD_Z, Math.PI / 2, 0);
  for (const y of [14.5, 1.5, -11.5]) addFan(CASE.x1 - 1.9, y, BZ + 12.5, 0, -Math.PI / 2);
  for (const x of [-8, 5, 18]) addFan(x, CASE.y0 + 1.35, BZ + 12.5, -Math.PI / 2, 0);
  addFan(CASE.x0 + 1.9, 12.5, BZ + 13.5, 0, Math.PI / 2);
  const fans = P.fanBank({ poses: fanPoses, size: 12, mats: fanMats, ringMat });
  cs.add(fans.g);

  // ---------- 水冷頭(壓在 CPU 上):圓角方塊 + 圓形 LCD + 接頭 + 編織水管 ----------
  const pump = new THREE.Group();
  pump.position.set(-2, 10, BZ + 0.35);
  cs.add(pump);
  P.mesh(P.rbox(7, 7, 3.6, 0.9), anod, 0, 0, 1.8, pump);
  P.mesh(new THREE.CylinderGeometry(3.25, 3.25, 0.25, 64), new THREE.MeshStandardMaterial({ color: 0x050507, metalness: 0.2, roughness: 0.15 }), 0, 0, 3.66, pump).rotation.x = Math.PI / 2;
  const pumpCol = new THREE.Color();
  const pumpRing = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.07, 8, 96), ringMat);
  pumpRing.position.z = 3.8;
  pump.add(pumpRing);
  const lcd = etch.block({
    name: 'pump-lcd', w: 6.2, h: 6.2, res: 170, color: pumpCol, intensity: 1.1,
    draw(g) {
      g.circle(3.1, 3.1, 2.95, { stroke: '#fff', lw: 0.05, alpha: 0.35 });
      g.text('Tunai', 3.1, 2.75, { font: 'serif', size: 1.0, weight: 700, align: 'center' });
      g.text('9950X3D', 3.1, 3.55, { font: 'mono', size: 0.38, align: 'center', alpha: 0.85, spacing: 0.1 });
      g.text('42°C · 16C/32T', 3.1, 4.25, { font: 'mono', size: 0.3, align: 'center', alpha: 0.6 });
    },
  });
  lcd.mesh.position.z = 3.8;
  pump.add(lcd.mesh);
  for (const y of [1.2, -1.2]) P.mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.4, 24), anod, 3.9, y + 1.6, 2.2, pump).rotation.z = Math.PI / 2;
  for (const off of [0, 1.7]) {
    P.heatpipe([
      new THREE.Vector3(2.6, 12.8 + off * 0.3, BZ + 2.6), new THREE.Vector3(5.5, 16.5 + off * 0.2, BZ + 5 + off),
      new THREE.Vector3(14, 20.5, RAD_Z - 2 + off * 1.2), new THREE.Vector3(RAD_X + 19.2, RAD_Y - 2.4, RAD_Z - 2.2 + off * 2.6),
    ], { r: 0.62, mat: sleeveBlack }, cs);
  }

  // ---------- 線材(編織套管 + 線梳)----------
  const comb = (curveMesh, ts, w, h) => ts.forEach((tt) => {
    const c = curveMesh.userData.curve, p = c.getPointAt(tt), tg = c.getTangentAt(tt);
    const m = P.mesh(P.rbox(w, h, 0.5, 0.15), M.plastic, p.x, p.y, p.z, cs);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
  });
  const atx = P.cableBundle([new THREE.Vector3(15.4, 6.2, BZ + 1.7), new THREE.Vector3(16.8, 6.2, BZ + 2.6), new THREE.Vector3(18.2, 6.2, BZ + 1.2), new THREE.Vector3(18.8, 6.2, TRAY_Z - 0.6)], { count: 24, r: 0.13, rows: 2, mat: sleeveLight, segs: 40 });
  cs.add(atx);
  comb(atx, [0.45], 4.2, 0.9);
  const eps = P.cableBundle([new THREE.Vector3(-12, 17.9, BZ + 1.3), new THREE.Vector3(-12, 19.4, BZ + 2.3), new THREE.Vector3(-11.2, 20.6, BZ + 0.8), new THREE.Vector3(-11, 20.6, TRAY_Z - 0.6)], { count: 8, r: 0.13, rows: 2, mat: sleeveLight, segs: 30 });
  cs.add(eps);
  const gpuPwr = P.cableBundle([new THREE.Vector3(7.8, 0.4, BZ + 13.6), new THREE.Vector3(8.5, 0.2, BZ + 15.6), new THREE.Vector3(15.5, -2, BZ + 13.5), new THREE.Vector3(18.4, -5.5, BZ + 4), new THREE.Vector3(18.8, -6, TRAY_Z - 0.6)], { count: 12, r: 0.13, rows: 2, mat: sleeveLight, segs: 60 });
  cs.add(gpuPwr);
  comb(gpuPwr, [0.3, 0.65], 1.9, 0.8);
  // 顯卡支撐架
  P.mesh(P.cylG(0.45, 28.6, 16), anod, 12.5, CASE.y0 + 14.2, BZ + 8, cs);
  P.mesh(P.rbox(3, 0.5, 3, 0.2), anod, 12.5, CASE.y0 + 0.25, BZ + 8, cs);
  P.mesh(P.rbox(2.4, 0.3, 2.4, 0.15), M.rubber, 12.5, -2.95, BZ + 8, cs);
  // 機殼內的補光:頂部前緣一盞白光 + 底部風扇的一點色光
  const interior = new THREE.PointLight(0xf2eee8, 0, 1, 0);
  interior.position.set(18, 21, BZ + 16);
  cs.add(interior);
  lights.push({ light: interior, dist: 85, int: 3.2 });
  // 左上再補一盞(照到記憶體、供電散熱片的金屬面)
  const fill = new THREE.PointLight(0xe8ecf4, 0, 1, 0); fill.position.set(-6, 22, BZ + 18); cs.add(fill);
  lights.push({ light: fill, dist: 55, int: 1.6 });
  // 風扇打出來的色光(前側一盞、頂部一盞):RGB 風扇真的會把零件染色
  for (const [x, y, z] of [[CASE.x1 - 6, 2, BZ + 12], [cx, CASE.y1 - 8, BZ + 12]]) {
    const L = new THREE.PointLight(0xffffff, 0, 1, 0); L.position.set(x, y, z); cs.add(L);
    lights.push({ light: L, dist: 34, int: 1.1, era: true });
  }
  const floorGlow = new THREE.PointLight(0xffffff, 0, 1, 0);
  floorGlow.position.set(5, CASE.y0 + 7, BZ + 13);
  cs.add(floorGlow);
  lights.push({ light: floorGlow, dist: 38, int: 0.9, era: true });

  // ---------- 規格標註:排在機殼右側,細線指到零件 ----------
  const specCol = new THREE.Color();
  const anchors = { ...board.anchors, cpu: new THREE.Vector3(-2, 10, BZ + 4.2), os: null };
  const specLabels = SPECS.map((S, i) => {
    const b = etch.block({
      name: 'spec-' + S.anchor, w: 17, h: 4.4, res: 70, color: specCol, intensity: 1.2,
      draw(g) {
        g.text(t(S.label).toUpperCase(), 0.1, 0.9, { font: 'mono', size: 0.72, spacing: 0.14, alpha: 0.7 });
        g.text(S.value, 0.1, 2.35, { font: 'sans', size: 1.2, weight: 700, maxW: 16.8 });
        if (S.note) g.text(t(S.note), 0.1, 3.6, { font: 'body', size: 0.8, alpha: 0.75, maxW: 16.8 });
      },
    });
    const x = CASE.x1 + 12, y = 22 - i * (52 / Math.max(1, SPECS.length - 1));
    b.mesh.position.set(x, y, CASE.z1 + 2);
    root.add(b.mesh);
    const a = anchors[S.anchor];
    const from = new THREE.Vector3(x - 8.8, y, CASE.z1 + 2);
    const lead = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, a || from]), new THREE.LineBasicMaterial({ color: specCol, transparent: true, opacity: 0.6 }));
    root.add(lead);
    const dot = P.mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: specCol }), 0, 0, 0, root);
    if (a) dot.position.copy(a); else dot.visible = false;
    return { b, lead, dot, S, from, has: !!a, baseInt: b.mat.uniforms.uInt.value };
  });

  // ---------- 桌子 ----------
  const desk = new THREE.Group();
  root.add(desk);
  const wood = new THREE.MeshStandardMaterial({ map: P.woodTex([2, 1]), roughness: 0.62, metalness: 0, envMapIntensity: 0.35 });
  P.mesh(P.rbox(232, 3, 86, 1.4), wood, -64, DESK_Y - 1.5, BZ + 20, desk);
  for (const x of [-170, 42]) {
    P.mesh(P.rbox(6, 68, 6, 0.8), anod, x, DESK_Y - 37, BZ + 20, desk);
    P.mesh(P.rbox(7, 3, 72, 1.2), anod, x, DESK_Y - 72.5, BZ + 20, desk);
  }
  P.mesh(P.rbox(208, 4, 4, 1), anod, -64, DESK_Y - 8, BZ + 8, desk);
  P.mesh(P.rbox(104, 0.3, 44, 1), new THREE.MeshStandardMaterial({ color: 0x0c0d11, roughness: 0.95 }), -58, DESK_Y + 0.15, BZ + 46, desk);
  const stitch = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(102.6, 0.32, 42.6)), new THREE.LineBasicMaterial({ color: 0x2a2c33 }));
  stitch.position.set(-58, DESK_Y + 0.16, BZ + 46);
  desk.add(stitch);

  // ---------- 週邊(依 GEAR 清單排;沒有專屬模型的用通用外形)----------
  const gearCol = new THREE.Color(), gearGlow = new THREE.Color(), screenCol = new THREE.Color();
  const monitors = GEAR.filter((G) => G.model === 'monitor').sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0));
  const others = GEAR.filter((G) => G.model !== 'monitor');
  const gearItems = [];
  // 螢幕:超窄邊框、後殼、V 型底座;主螢幕上夾一盞掛燈
  monitors.forEach((G, i) => {
    const x = i === 0 ? -64 : -64 - i * 68;
    const g = new THREE.Group();
    g.position.set(x, DESK_Y, BZ + 6);
    g.rotation.y = i === 0 ? 0 : 0.2;
    desk.add(g);
    for (const s of [-1, 1]) { const leg = P.mesh(P.rbox(3.2, 1, 17, 1), anod, s * 5.5, 0.5, 4, g); leg.rotation.y = s * 0.55; }
    P.mesh(new THREE.CylinderGeometry(2.4, 2.8, 1.4, 32), anod, 0, 0.7, -1.6, g);
    P.mesh(P.rbox(4.4, 27, 2.4, 0.9), anod, 0, 14, -2.6, g);
    P.mesh(P.rbox(58, 31.5, 3.4, 1.8), M.plastic, 0, 40.5, -1.8, g);
    P.mesh(P.rbox(61.6, 35.8, 0.9, 0.35), M.plastic, 0, 41, 0, g);
    P.mesh(P.rbox(61.6, 1.8, 1, 0.3), anod, 0, 23.2, 0.05, g);
    P.mesh(P.rbox(40, 0.3, 0.3, 0.1), new THREE.MeshBasicMaterial({ color: screenCol }), 0, 40, -3.6, g);
    if (i === 0) {
      const bar = new THREE.Group(); bar.position.set(0, 59.4, -0.4); g.add(bar);
      P.mesh(new THREE.CylinderGeometry(0.9, 0.9, 45, 24), anod, 0, 0, 0, bar).rotation.z = Math.PI / 2;
      P.mesh(P.rbox(40, 0.2, 1.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff4e6 }), 0, -0.85, 0.6, bar);
      P.mesh(P.rbox(4, 3.2, 3, 0.6), anod, 0, -1.4, -1.4, bar);
      const lamp = new THREE.PointLight(0xfff0dc, 0, 1, 0);
      lamp.position.set(x, DESK_Y + 55, BZ + 22);
      root.add(lamp);
      lights.push({ light: lamp, dist: 95, int: 1.1, desk: true });
    }
    gearItems.push({ G, g, anchor: new THREE.Vector3(x, DESK_Y + 60, BZ + 8), i });
  });
  const scrCol = new THREE.Color();
  const mainScreen = etch.block({
    name: 'screen-main', w: 60.4, h: 34.2, res: 34, color: scrCol, intensity: 0.85, tint: 0.35,
    draw(g) {
      g.rect(0, 0, 60.4, 34.2, { fill: '#0b0a10' });
      g.text('06 · ' + t('setup.eyebrow'), 4, 8, { font: 'mono', size: 1.2, spacing: 0.16, alpha: 0.7 });
      g.text(t('setup.title'), 4, 15.5, { font: 'serif', size: 4.2, weight: 700, maxW: 52 });
      g.wrap(t('setup.sub'), 4, 20.5, 52, { font: 'body', size: 1.6, alpha: 0.85 });
      g.rect(0, 31.6, 60.4, 2.6, { fill: '#1a1c24', alpha: 0.95 });
      for (let i = 0; i < 6; i++) g.rect(24 + i * 2.2, 32.2, 1.5, 1.5, { fill: '#fff', alpha: i === 0 ? 0.9 : 0.35, r: 0.3 });
      g.text('Windows 11', 58.8, 33.4, { font: 'sans', size: 0.9, align: 'right', alpha: 0.7 });
    },
  });
  const termScreen = etch.block({
    name: 'screen-term', w: 60.4, h: 34.2, res: 30, color: scrCol, intensity: 1.0, tint: 0.5,
    draw(g) {
      g.rect(0, 0, 60.4, 34.2, { fill: '#07080b' });
      g.text('tunai@tun9i ~ % neofetch', 2.5, 3.5, { font: 'mono', size: 1.1 });
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if ((i + j) % 2 === 0 || i === 2) g.rect(3 + i * 2, 7 + j * 2, 1.6, 1.6, { fill: '#fff', alpha: 0.6 });
      g.text('tunai@tun9i', 18, 7.6, { font: 'mono', size: 1.1, weight: 700 });
      g.rule(18, 8.4, 12, { alpha: 0.5, t: 0.08 });
      SPECS.forEach((S, i) => {
        g.text(t(S.label) + ':', 18, 10.6 + i * 1.9, { font: 'mono', size: 0.95, weight: 700 });
        g.text(S.value, 26.5, 10.6 + i * 1.9, { font: 'mono', size: 0.95, alpha: 0.85, maxW: 32 });
      });
      g.text('tunai@tun9i ~ % █', 2.5, 31.5, { font: 'mono', size: 1.1, alpha: 0.9 });
    },
  });
  gearItems.forEach((I, i) => {
    const b = i === 0 ? mainScreen : termScreen;
    b.mesh.position.set(0, 41, 0.47);
    I.g.add(b.mesh);
    hot.push(b.mesh);
  });

  // 鍵盤(75%、84 鍵)的配列
  const U1 = 1.9;
  const LAYOUT = [
    [['Esc', 1], ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1], ['F9', 1], ['F10', 1], ['F11', 1], ['F12', 1], ['Del', 1], ['', 1, 'knob']],
    [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['⌫', 2], ['Home', 1]],
    [['Tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1.5], ['PgUp', 1]],
    [['Caps', 1.75], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1], ['L', 1], [';', 1], ["'", 1], ['Enter', 2.25], ['PgDn', 1]],
    [['Shift', 2.25], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], [',', 1], ['.', 1], ['/', 1], ['Shift', 1.75], ['↑', 1], ['End', 1]],
    [['Ctrl', 1.25], ['Win', 1.25], ['Alt', 1.25], ['', 6.25], ['Alt', 1], ['Fn', 1], ['Ctrl', 1], ['←', 1], ['↓', 1], ['→', 1]],
  ];
  const ACCENT = new Set(['Esc', 'Enter']);
  const keys = [];
  LAYOUT.forEach((row, r) => { let x = 0; row.forEach(([label, w, kind]) => { keys.push({ label, w, kind, cx: x + w / 2, r }); x += w; }); });

  const placeOther = { keyboard: [-64, BZ + 40], mouse: [-26, BZ + 44], headset: [-158, BZ + 30], mic: [-104, BZ + 28] };
  let gx = 10;
  others.forEach((G) => {
    const [x, z] = placeOther[G.model] || [(gx -= 16), BZ + 30];
    const g = new THREE.Group();
    g.position.set(x, DESK_Y, z);
    desk.add(g);
    let top = 6;
    if (G.model === 'keyboard') {
      g.rotation.y = 0.02;
      const KW = 16 * U1 + 1.6, KD = 6 * U1 + 1.6;
      P.mesh(P.rbox(KW, 2.2, KD, 0.7), anod, 0, 1.1, 0, g);
      P.mesh(P.rbox(KW - 1.2, 0.3, KD - 1.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.8 }), 0, 2.25, 0, g);
      const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.02 });
      const caps = new THREE.InstancedMesh(P.rbox(1, 0.95, 1, 0.16), capMat, keys.length);
      const mm = new THREE.Matrix4(), cc = new THREE.Color();
      const paintCaps = () => keys.forEach((K, i) => caps.setColorAt(i, ACCENT.has(K.label) ? era(6, cc).multiplyScalar(0.8) : cc.setHex(0x1f2127)));
      keys.forEach((K, i) => {
        const px = -KW / 2 + 0.8 + K.cx * U1, pz = -KD / 2 + 0.8 + (K.r + 0.5) * U1;
        if (K.kind === 'knob') mm.makeScale(0.001, 0.001, 0.001); else mm.makeScale(K.w * U1 - 0.22, 1, U1 - 0.22).setPosition(px, 2.9, pz);
        caps.setMatrixAt(i, mm);
      });
      paintCaps();
      recolor.push(() => { paintCaps(); if (caps.instanceColor) caps.instanceColor.needsUpdate = true; });
      g.add(caps);
      const knobK = keys.find((K) => K.kind === 'knob');
      P.mesh(new THREE.CylinderGeometry(0.75, 0.8, 1.4, 28), anod, -KW / 2 + 0.8 + knobK.cx * U1, 3.1, -KD / 2 + 0.8 + 0.5 * U1, g);
      const legCol = new THREE.Color();
      const leg = etch.block({
        name: 'kb-legends', w: 16 * U1, h: 6 * U1, res: 60, color: legCol, intensity: 0.9,
        draw(gg) {
          keys.forEach((K) => {
            if (!K.label || K.kind === 'knob') return;
            gg.text(K.label, K.cx * U1 - K.w * U1 / 2 + 0.35, K.r * U1 + 0.72, { font: 'sans', size: K.label.length > 2 ? 0.32 : 0.46, weight: 600, alpha: 0.85 });
          });
        },
      });
      leg.mesh.rotation.x = -Math.PI / 2;
      leg.mesh.position.set(-KW / 2 + 0.8 + 8 * U1, 3.39, -KD / 2 + 0.8 + 3 * U1);
      g.add(leg.mesh);
      recolor.push(() => eraSoft(6, 0.6, legCol));
      const under = P.lightStrip(KW - 1, 0.12, 0.12, gearGlow);
      under.position.set(0, 0.2, KD / 2 + 0.02);
      g.add(under);
      top = 4;
    } else if (G.model === 'mouse') {
      g.rotation.y = -0.12;
      P.mesh(P.rbox(6.4, 0.35, 12.2, 2.6), M.plastic, 0, 0.18, 0, g);
      const shell = P.mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.42, metalness: 0.15 }), 0, 0.3, 0.3, g);
      shell.scale.set(3.15, 3.5, 6.0);
      P.mesh(P.boxG(0.08, 0.3, 4.4), M.rubber, 0, 3.45, -2.8, g).rotation.x = 0.35;
      P.mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.55, 20), M.rubber, 0, 3.35, -2.2, g).rotation.z = Math.PI / 2;
      for (const z of [-1.2, 0.6]) P.mesh(P.rbox(0.4, 0.7, 1.4, 0.15), M.plasticGray, -3.05, 1.9, z, g);
      const led = P.lightStrip(0.1, 0.1, 5, gearGlow); led.position.set(0, 0.36, 5.5); g.add(led);
      top = 3.6;
    } else if (G.model === 'headset') {
      P.mesh(P.cylG(5.5, 1, 40), anod, 0, 0.5, 0, g);
      P.mesh(P.cylG(0.9, 26, 20), M.alu, 0, 13.5, 0, g);
      const cradle = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.6, 12, 32, Math.PI), anod);
      cradle.position.y = 26.5; g.add(cradle);
      const band = new THREE.Mesh(new THREE.TorusGeometry(9.2, 0.75, 14, 64, Math.PI), new THREE.MeshStandardMaterial({ color: 0x18191e, metalness: 0.6, roughness: 0.4 }));
      band.position.y = 22; g.add(band);
      const strap = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.5, 6, 64, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: 0x0f1013, roughness: 0.9 }));
      strap.scale.z = 3.2; strap.position.y = 22; strap.rotation.z = Math.PI * 0.1; g.add(strap);
      for (const sx of [-1, 1]) {
        const cup = P.mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshStandardMaterial({ color: 0x1b1c21, metalness: 0.35, roughness: 0.45 }), sx * 9.9, 17.5, 0, g);
        cup.scale.set(1.5, 4.8, 4.2);
        const cushion = new THREE.Mesh(new THREE.TorusGeometry(3.2, 1.1, 14, 40), new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.95 }));
        cushion.scale.set(1, 1.15, 0.55); cushion.rotation.y = Math.PI / 2; cushion.position.set(sx * 8.4, 17.5, 0); g.add(cushion);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.12, 8, 48), new THREE.MeshBasicMaterial({ color: gearGlow }));
        ring.rotation.y = Math.PI / 2; ring.position.set(sx * 11.4, 17.5, 0); g.add(ring);
        P.mesh(P.rbox(0.5, 5.5, 1.2, 0.2), M.alu, sx * 9.9, 22.5, 0, g);
      }
      top = 32;
    } else if (G.model === 'mic') {
      P.mesh(P.cylG(5.8, 1.2, 40), anod, 0, 0.6, 0, g);
      P.mesh(P.cylG(0.7, 8, 16), M.alu, 0, 5, 0, g);
      for (const y of [11.5, 22]) { const r = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.28, 8, 48), anod); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; P.heatpipe([new THREE.Vector3(Math.cos(a) * 4.5, 11.5, Math.sin(a) * 4.5), new THREE.Vector3(Math.cos(a) * 3.4, 16.8, Math.sin(a) * 3.4), new THREE.Vector3(Math.cos(a) * 4.5, 22, Math.sin(a) * 4.5)], { r: 0.1, mat: M.rubber }, g); }
      P.mesh(P.cylG(2.7, 13, 32), P.rgbMat(GU, rgbA, rgbB, { speed: 0.08, int: 0.55 }), 0, 17, 0, g);
      P.mesh(new THREE.CylinderGeometry(3.1, 3.1, 15, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x131419, metalness: 0.6, roughness: 0.45, alphaMap: P.ventTex([4, 6]), transparent: true, side: THREE.DoubleSide, depthWrite: false }), 0, 17, 0, g);
      P.mesh(P.cylG(3.15, 1.4, 48), anod, 0, 25.2, 0, g);
      P.mesh(P.cylG(3.15, 1.2, 48), anod, 0, 9, 0, g);
      top = 27;
    } else {
      P.mesh(P.rbox(8, 5, 6, 1), anod, 0, 2.5, 0, g);
      const l = P.lightStrip(6, 0.2, 0.2, gearGlow); l.position.set(0, 3.5, 3.05); g.add(l);
      top = 6;
    }
    gearItems.push({ G, g, anchor: new THREE.Vector3(x, DESK_Y + top, z) });
  });

  // 日常小東西:馬克杯、盆栽、手機
  const props = new THREE.Group();
  desk.add(props);
  const mugPts = [];
  for (let i = 0; i <= 10; i++) { const u = i / 10; mugPts.push(new THREE.Vector2(u < 0.08 ? u * 45 : 3.6 - (u > 0.96 ? (u - 0.96) * 10 : 0), u * 9.5)); }
  const mugMat = new THREE.MeshStandardMaterial({ color: 0xd9d4cc, roughness: 0.35, metalness: 0.02 });
  P.mesh(new THREE.LatheGeometry(mugPts, 40), mugMat, -104, DESK_Y, BZ + 50, props);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.45, 10, 24, Math.PI * 1.2), mugMat);
  handle.position.set(-100.4, DESK_Y + 4.8, BZ + 50); handle.rotation.z = -Math.PI * 0.6; props.add(handle);
  P.mesh(new THREE.CircleGeometry(3.3, 32), new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 0.2 }), -104, DESK_Y + 8.6, BZ + 50, props).rotation.x = -Math.PI / 2;
  P.mesh(new THREE.CylinderGeometry(5, 4, 9, 32), new THREE.MeshStandardMaterial({ color: 0x2b2a2e, roughness: 0.85 }), -176, DESK_Y + 4.5, BZ + 8, props);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1c3a22, roughness: 0.7 });
  const lr = P.rng(8), leaves = [];
  for (let i = 0; i < 26; i++) { const a = lr() * Math.PI * 2, h = 10 + lr() * 16; leaves.push([-176 + Math.cos(a) * (2 + lr() * 5), DESK_Y + h, BZ + 8 + Math.sin(a) * (2 + lr() * 5), a, 1.2, 4 + lr() * 3, 0.25, 0.6 - lr() * 0.5, a]); }
  P.instances(new THREE.SphereGeometry(1, 12, 8), leafMat, leaves, props);
  const phone = new THREE.Group(); phone.position.set(-8, DESK_Y + 0.45, BZ + 18); phone.rotation.y = 0.3; props.add(phone);
  P.mesh(P.rbox(7.4, 0.8, 15.5, 1), anod, 0, 0, 0, phone);
  P.mesh(P.rbox(6.8, 0.1, 14.8, 0.8), new THREE.MeshStandardMaterial({ color: 0x06070a, roughness: 0.1, metalness: 0.4 }), 0, 0.41, 0, phone);

  // 週邊標籤
  const gearLabels = gearItems.map((I, i) => {
    const b = etch.block({
      name: 'gear-' + i, w: 26, h: 6.4, res: 46, color: gearCol, intensity: 1.2,
      draw(g) {
        g.text(t(I.G.label).toUpperCase(), 13, 1.4, { font: 'mono', size: 1.1, spacing: 0.16, alpha: 0.7, align: 'center', maxW: 25 });
        g.text(I.G.value, 13, 3.6, { font: 'sans', size: 1.9, weight: 700, align: 'center', maxW: 25.6 });
        if (I.G.note) g.text(t(I.G.note), 13, 5.6, { font: 'body', size: 1.2, alpha: 0.75, align: 'center', maxW: 25 });
      },
    });
    const isMon = I.G.model === 'monitor';
    const pos = isMon ? new THREE.Vector3(I.g.position.x, DESK_Y + 74, I.g.position.z + 4) : new THREE.Vector3(I.anchor.x, I.anchor.y + 16, I.anchor.z);
    b.mesh.position.copy(pos);
    root.add(b.mesh);
    const lead = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pos.clone().add(new THREE.Vector3(0, -3.4, 0)), isMon ? pos.clone().add(new THREE.Vector3(0, -12, 0)) : I.anchor.clone().add(new THREE.Vector3(0, 0.5, 0))]), new THREE.LineBasicMaterial({ color: gearCol, transparent: true, opacity: 0.55 }));
    root.add(lead);
    return { b, lead };
  });
  const osL = specLabels.find((L) => L.S.anchor === 'os');
  if (osL && gearItems[0]) {
    const tb = new THREE.Vector3(gearItems[0].g.position.x + 26, DESK_Y + 24.6, gearItems[0].g.position.z + 1);
    osL.lead.geometry.setFromPoints([osL.from, tb]);
    osL.dot.position.copy(tb);
    osL.dot.visible = true;
    osL.has = true;
  }

  // ---------- 房間:後牆 + 窗(百葉 + 窗簾)+ 層架 + 地板 + 地毯 ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.92, metalness: 0 });
  const wall = new THREE.Group();
  wall.position.z = WALL_Z;
  root.add(wall);
  const WX0 = -280, WX1 = 150, WY0 = -120, WY1 = 190;
  const ws = new THREE.Shape();
  ws.moveTo(WX0, WY0); ws.lineTo(WX1, WY0); ws.lineTo(WX1, WY1); ws.lineTo(WX0, WY1); ws.lineTo(WX0, WY0);
  const hole = new THREE.Path();
  hole.moveTo(WINDOW.x0, WINDOW.y0); hole.lineTo(WINDOW.x0, WINDOW.y1); hole.lineTo(WINDOW.x1, WINDOW.y1); hole.lineTo(WINDOW.x1, WINDOW.y0); hole.lineTo(WINDOW.x0, WINDOW.y0);
  ws.holes.push(hole);
  P.mesh(new THREE.ShapeGeometry(ws), wallMat, 0, 0, 0, wall);
  const winFrame = new THREE.MeshStandardMaterial({ color: 0x2a2c31, metalness: 0.8, roughness: 0.4 });
  const fx = (WINDOW.x0 + WINDOW.x1) / 2, fy = (WINDOW.y0 + WINDOW.y1) / 2, fw = WINDOW.x1 - WINDOW.x0, fh = WINDOW.y1 - WINDOW.y0;
  for (const [w, h, x, y] of [[fw + 6, 3, fx, WINDOW.y0], [fw + 6, 3, fx, WINDOW.y1], [3, fh, WINDOW.x0, fy], [3, fh, WINDOW.x1, fy], [2, fh, fx, fy]]) P.mesh(P.rbox(w, h, 5, 0.6), winFrame, x, y, 0, wall);
  P.mesh(P.rbox(fw + 12, 2.5, 14, 0.8), winFrame, fx, WINDOW.y0 - 2, 6, wall);
  const slats = [];
  for (let i = 0; i < 14; i++) slats.push([fx, WINDOW.y1 - 4 - i * 2.1, 3, 0, 1, 1, 1, 0.9]);
  P.instances(P.boxG(fw - 4, 0.12, 2.4), new THREE.MeshStandardMaterial({ color: 0x1c1d22, roughness: 0.6, metalness: 0.3 }), slats, wall);
  const curtainGeo = new THREE.PlaneGeometry(34, 150, 40, 1);
  { const p = curtainGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 0.9) * 1.6 + Math.sin(p.getX(i) * 2.3) * 0.5); curtainGeo.computeVertexNormals(); }
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0x14131a, roughness: 0.95, side: THREE.DoubleSide });
  for (const x of [WINDOW.x0 - 14, WINDOW.x1 + 14]) P.mesh(curtainGeo, curtainMat, x, fy - 10, 8, wall);
  P.mesh(new THREE.CylinderGeometry(0.8, 0.8, fw + 80, 16), anod, fx, WINDOW.y1 + 8, 9, wall).rotation.z = Math.PI / 2;
  const shelf = new THREE.Group(); shelf.position.set(-205, 30, 10); wall.add(shelf); // 窗戶左邊(不擋 HUD)
  P.mesh(P.rbox(60, 2, 18, 0.4), wood, 0, 0, 0, shelf);
  const br = P.rng(21), books = [];
  let bx = -27;
  for (let i = 0; i < 12; i++) { const w = 1.6 + br() * 2, h = 16 + br() * 7; books.push([bx + w / 2, 1 + h / 2, 0, 0, w, h, 13]); bx += w + 0.25; }
  const bookMesh = P.instances(P.boxG(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), books, shelf);
  const bc = new THREE.Color();
  books.forEach((_, i) => bookMesh.setColorAt(i, bc.setHSL(0.02 + br() * 0.7, 0.25 + br() * 0.3, 0.12 + br() * 0.14)));
  const signCol = new THREE.Color();
  const sign = etch.block({ name: 'shelf-sign', w: 20, h: 6, res: 40, color: signCol, intensity: 1.2, draw(g) { g.text('tun9i', 10, 4.3, { font: 'serif', size: 3.6, weight: 700, align: 'center' }); } });
  sign.mesh.position.set(14, 5, 9.1);
  shelf.add(sign.mesh);
  P.mesh(new THREE.PlaneGeometry(700, 420), new THREE.MeshStandardMaterial({ color: 0x08080b, roughness: 0.8 }), -60, DESK_Y - 75, 110, root).rotation.x = -Math.PI / 2;
  P.mesh(new THREE.CircleGeometry(80, 64), new THREE.MeshStandardMaterial({ color: 0x121117, roughness: 1 }), -64, DESK_Y - 74.9, BZ + 90, root).rotation.x = -Math.PI / 2;

  const screenLight = new THREE.PointLight(0xffffff, 0, 1, 0);
  screenLight.position.set(-64, DESK_Y + 40, BZ + 30);
  root.add(screenLight);
  lights.push({ light: screenLight, dist: 270, int: 1.6, desk: true, era: true });

  recolor.push(() => {
    era(6, rgbA).lerp(WHITE, 0.15);
    era(3.5, rgbB).lerp(WHITE, 0.1);
    eraSoft(6, 0.3, pumpCol).multiplyScalar(1.2);
    eraSoft(6, 0.4, specCol);
    eraSoft(6, 0.4, gearCol);
    era(6, gearGlow).multiplyScalar(0.55);
    eraSoft(6, 0.35, scrCol);
    era(6, screenCol).multiplyScalar(0.32);
    eraSoft(6, 0.5, brandCol);
    eraSoft(6, 0.3, signCol);
    eraSoft(6, 0.2, pwrRing.material.color).multiplyScalar(1.4);
    for (const L of lights) if (L.era) eraSoft(6, 0.55, L.light.color);
  });

  function update(st) {
    const { s, k, time, dt } = st;
    root.visible = s > k('int.pcb');
    const on = smooth(k('int.games') + 0.5, k('setup.pc') - 0.1, s);
    const deskOn = smooth(k('setup.pc') + 0.2, k('setup.desk') - 0.1, s);
    cs.visible = on > 0.001 || s > k('setup.pc');
    ringMat.uniforms.uOn.value = 0.15 + on * 0.85;
    fans.spin(-dt * (2 + 10 * on));
    lcd.mat.uniforms.uReveal.value = on;
    // 拉遠到桌面時規格標註淡掉:調亮度,不要調刻字進度(進度停在一半會卡著一條雷射掃描線)
    const specFade = 1 - smooth(k('setup.desk') - 0.5, k('setup.desk') - 0.1, s) * 0.85;
    specLabels.forEach((L, i) => {
      const r = smooth(k('setup.pc') - 0.55 + i * 0.04, k('setup.pc') - 0.3 + i * 0.03, s);
      L.b.mat.uniforms.uReveal.value = r;
      L.b.mat.uniforms.uInt.value = L.baseInt * specFade;
      L.lead.visible = L.dot.visible = r > 0.05 && L.has;
      L.lead.material.opacity = 0.6 * r * specFade;
    });
    mainScreen.mat.uniforms.uReveal.value = smooth(k('setup.pc') - 0.6, k('setup.pc') - 0.12, s); // 鏡頭停下來之前就寫完
    termScreen.mat.uniforms.uReveal.value = smooth(k('setup.pc') + 0.1, k('setup.desk') - 0.2, s);
    gearLabels.forEach((L, i) => { const r = smooth(k('setup.pc') + 0.3 + i * 0.06, k('setup.desk') - 0.05, s); L.b.mat.uniforms.uReveal.value = r; L.lead.visible = r > 0.05; });
    for (const L of lights) L.light.intensity = L.int * (L.desk ? Math.max(deskOn, 0.25 * on) : on);
    pumpRing.rotation.z = time * 0.4;
  }
  function post(st) {
    const kk = st.scaleOf('main');
    for (const L of lights) L.light.distance = L.dist * kk;
  }

  // 靜態合批:機殼、桌面、牆上不會動的零件依材質合併(會動的都是自訂著色器、實例化或半透明,本來就不會被合)
  P.bakeStatic(cs);
  P.bakeStatic(desk);
  P.bakeStatic(wall);
  return { update, post };
}
