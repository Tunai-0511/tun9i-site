// 04 作品 + 05 下班之後 —— 主機板與顯示卡。
//
// 04:從晶粒城市一路拉遠,切開的 CPU 合回去、插進主機板的插座,板子「開機」、走線亮起來。
//     主機板下半部是作品區:精選專案是一顆大晶片(旁邊的絲印是它的規格書),
//     其他 repo 是一排小晶片(即時從 GitHub 抓),最下面一排 LED 是過去一年的貢獻熱力圖。
//     晶片與絲印上的連結都可以點。
// 05:一張顯示卡飛進來、轉身 —— 背板印著常聽的音樂(每一欄一組等化器);
//     背板掀開:GPU 封裝上刻著章節標題,周圍的記憶體 = 在玩的遊戲,兩側絲印 = 興趣。
//     看完它插回 PCIe 槽,06 章拉遠成整台主機。
//
// 內容與數量都來自 src/data/world.js;版面依數量自動排。
// 座標:main 空間(公分)。主機板直立在 z = BZ 的平面上、面向 +z;板內用板子的本地座標。

import * as THREE from 'three';
import { t } from '../../i18n.js';
import { repoCards } from '../../github.js';
import { getHeat } from '../../heatmap.js';
import { FEATURED, GITHUB, INTERESTS, GAMES, MUSIC } from '../../../data/world.js';
import { era, eraSoft, metal, WHITE } from '../era.js';
import * as P from '../parts.js';

export const BZ = -40;
const FRONT = 0.08;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

// ---------- PCB 底圖:黑色板 + 走線 + 零件編號絲印;另一張是走線的發光貼圖 ----------
function pcbTextures(W, H, seed = 3, keepout = []) {
  const res = 48;
  const c = document.createElement('canvas'), e = document.createElement('canvas');
  c.width = e.width = Math.round(W * res);
  c.height = e.height = Math.round(H * res);
  const x = c.getContext('2d'), y = e.getContext('2d');
  const r = P.rng(seed);
  x.fillStyle = '#0a0c11'; x.fillRect(0, 0, c.width, c.height);
  x.globalAlpha = 0.05;
  for (let i = -c.height; i < c.width; i += 5) { x.strokeStyle = i % 10 ? '#2a2f3a' : '#000'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + c.height, c.height); x.stroke(); }
  x.globalAlpha = 1;
  const bundle = (x0, y0, segs, n, gap) => {
    for (let k = 0; k < n; k++) {
      let px = x0, py = y0 + k * gap;
      x.beginPath(); y.beginPath(); x.moveTo(px, py); y.moveTo(px, py);
      for (const [dx, dy, len] of segs) { px += dx * len; py += dy * len; x.lineTo(px, py); y.lineTo(px, py); }
      x.strokeStyle = '#1a1f28'; x.lineWidth = 2.2; x.stroke();
      y.strokeStyle = `rgba(255,255,255,${0.3 + r() * 0.55})`; y.lineWidth = 1.5; y.stroke();
    }
  };
  for (let i = 0; i < 70; i++) {
    const x0 = r() * c.width, y0 = r() * c.height, L = () => 30 + r() * 240;
    const h = r() > 0.5;
    const s = r() > 0.5 ? 1 : -1;
    bundle(x0, y0, h ? [[1, 0, L()], [0.707, 0.707 * s, L() * 0.4], [1, 0, L()]] : [[0, 1, L()], [0.707 * s, 0.707, L() * 0.4], [0, 1, L()]], 2 + Math.floor(r() * 7), 6);
  }
  for (let i = 0; i < 1400; i++) { const px = r() * c.width, py = r() * c.height; x.fillStyle = '#1e232d'; x.beginPath(); x.arc(px, py, 1.7, 0, 7); x.fill(); x.fillStyle = '#6b5a3a'; x.beginPath(); x.arc(px, py, 0.8, 0, 7); x.fill(); y.fillStyle = 'rgba(255,255,255,0.3)'; y.fillRect(px - 1, py - 1, 2, 2); }
  // 零件編號(C101、R23…)
  x.font = `${Math.round(res * 0.16)}px ui-monospace, Menlo, monospace`;
  x.fillStyle = 'rgba(200,205,215,0.28)';
  for (let i = 0; i < 260; i++) x.fillText(['C', 'R', 'L', 'Q', 'U', 'D', 'J'][Math.floor(r() * 7)] + Math.floor(r() * 900 + 1), r() * c.width, r() * c.height);
  // 刻字的區域不走線(否則發光的走線會跟字搶),只留一圈絲印框
  for (const [x0, y0, x1, y1] of keepout) {
    const px0 = (x0 + W / 2) * res, px1 = (x1 + W / 2) * res, py0 = (H / 2 - y1) * res, py1 = (H / 2 - y0) * res;
    x.globalAlpha = 0.94; x.fillStyle = '#0a0c11'; x.fillRect(px0, py0, px1 - px0, py1 - py0);
    x.globalAlpha = 0.22; x.strokeStyle = '#c8cdd7'; x.lineWidth = 1.2; x.strokeRect(px0 + 3, py0 + 3, px1 - px0 - 6, py1 - py0 - 6);
    x.globalAlpha = 1;
    y.fillStyle = '#000'; y.fillRect(px0, py0, px1 - px0, py1 - py0);
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const emap = new THREE.CanvasTexture(e); emap.anisotropy = 8;
  return { map, emap };
}

// 記憶體(遊戲)在 GPU 周圍的位置(從背面看的座標):上下兩排 + 左右直立的,依數量長
function memSlots(n) {
  const side = n > 6 ? Math.min(2, Math.ceil((n - 6) / 2)) : 0; // 每一側幾顆直立的
  const rest = n - side * 2;
  const top = Math.ceil(rest / 2), bot = rest - top;
  const slots = [];
  const row = (cnt, y) => { for (let i = 0; i < cnt; i++) slots.push({ x: (i - (cnt - 1) / 2) * 3.1, y, vert: false }); };
  row(top, 4.25);
  row(bot, -3.85);
  for (let i = 0; i < side; i++) {
    const y = side === 1 ? 0.2 : 1.65 - i * 2.9;
    slots.push({ x: -4.35, y, vert: true }, { x: 4.35, y, vert: true });
  }
  return slots.slice(0, n);
}

// 鏡頭、插座、規格錨點這些「資料」一開始就要有(捲動對應、CPU 的插座姿態、06 章的標註都靠它);
// 幾何與貼圖很重,延後到首屏畫完、瀏覽器閒下來才建(populate)。
const SOCK = new THREE.Vector3(-2, 10, FRONT);
const SLOT_Y = 1.1;

export function buildBoard(ctx) {
  const root = new THREE.Group();
  root.name = 'board';
  root.visible = false;
  const hot = [];
  let impl = null;
  for (const G of GAMES) ctx.assets.img(G.img); // 零件延後建,遊戲封面照樣一開始就下載(直接跳到後面的章節時圖已經在了)
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const keys = {
    projects: [
      { name: 'proj.board', T: V(0, 0.5, BZ), O: V(-3, 4, 66), fog: [2, 8] },
      { name: 'proj.featured', T: V(-8.6, -5.4, BZ), O: V(1.4, 1.6, 19.5) },
      { name: 'proj.notes', T: V(4.9, -6.9, BZ), O: V(0.6, 1.4, 19.5) },
      { name: 'proj.repos', T: V(0.2, -13.4, BZ), O: V(0, 2.2, 20.5) },
      { name: 'proj.heat', T: V(-3.4, -15.9, BZ), O: V(0.4, 2.6, 21) },
    ],
    interests: [
      { name: 'int.music', T: V(0, 0.8, -24), O: V(0, 1.2, 31) },
      { name: 'int.pcb', T: V(0, 0.6, -24), O: V(0, 1.4, 29) },
      { name: 'int.games', T: V(0, 0.4, -24), O: V(0.4, 0.8, 17.5) },
    ],
  };
  return {
    root, keys, hotMeshes: hot,
    socketPos: new THREE.Vector3(SOCK.x, SOCK.y, BZ + FRONT + 0.18),
    socketQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
    // 06 章的規格標註要指到這些零件(主空間座標)
    anchors: {
      cpu: new THREE.Vector3(SOCK.x, SOCK.y, BZ + 2),
      gpu: new THREE.Vector3(8, SLOT_Y - 2.5, BZ + 12),
      ram: new THREE.Vector3(7.5, 12, BZ + 4),
      mb: new THREE.Vector3(10, 16.5, BZ + 0.2),
      ssd: new THREE.Vector3(-5.2, 3.5, BZ + 1),
    },
    get ready() { return !!impl; },
    populate() { if (!impl) impl = constructBoard(ctx, root, hot); return impl; },
    update(st) { if (impl) impl.update(st); else root.visible = false; },
  };
}

function constructBoard(ctx, root, hot) {
  const { etch, assets, recolor, mobile } = ctx;
  const M = P.materials();
  const board = new THREE.Group();
  board.position.set(0, 0, BZ);
  root.add(board);
  const m4 = new THREE.Matrix4();
  const detail = mobile ? 0.45 : 1;

  // ---------- PCB ----------
  const W = 32, H = 36;
  const { map, emap } = pcbTextures(W, H, 3, [[-15.7, -3.55, -0.9, -0.2], [-14.6, -11.5, -7.6, -10.3], [-5.7, -10.7, 15.6, -3.1], [-16, -15.2, 16, -11.1], [-15.9, -18, -10.3, -14.6]]);
  const pcbMat = new THREE.MeshStandardMaterial({ map, emissiveMap: emap, emissive: new THREE.Color(0, 0, 0), roughness: 0.6, metalness: 0.25, roughnessMap: P.noiseTex([4, 4]) });
  P.mesh(new THREE.BoxGeometry(W, H, 0.16), pcbMat, 0, 0, 0, board);
  const edgeCol = new THREE.Color();
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, 0.16)), new THREE.LineBasicMaterial({ color: edgeCol, transparent: true, opacity: 0.6 }));
  board.add(edge);
  P.screwHoles([[-15, 17], [-2, 17], [14.8, 17], [-15, 1.6], [14.8, 1.6], [-15, -17], [0, -17.2], [14.8, -17], [7, 10]].map(([x, y]) => [x, y, FRONT]), { r: 0.42, mats: M }, board);

  // ---------- 插座(AM5)----------
  const sock = new THREE.Group();
  sock.position.copy(SOCK);
  board.add(sock);
  P.mesh(P.rbox(5.8, 5.8, 0.3, 0.08), M.plastic, 0, 0, 0.15, sock);
  // 固定框:四邊 + 角落鉚釘 + 壓桿
  for (const [w, h, x, y] of [[6.1, 0.4, 0, 2.9], [6.1, 0.4, 0, -2.9], [0.4, 6.1, 2.9, 0], [0.4, 6.1, -2.9, 0]]) P.mesh(P.rbox(w, h, 0.16, 0.05), M.steel, x, y, 0.36, sock);
  P.instances(P.cylG(0.16, 0.12, 12), M.steel, [[-2.9, -2.9, 0.46], [2.9, -2.9, 0.46], [-2.9, 2.9, 0.46], [2.9, 2.9, 0.46]].map((p) => [...p, 0, 1, 1, 1, Math.PI / 2]), sock);
  const lever = P.mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.6, 10), M.steel, 3.45, -0.3, 0.42, sock);
  P.mesh(P.rbox(0.9, 0.22, 0.2, 0.06), M.steel, 3.45, 2.55, 0.42, sock);
  void lever;
  // 插座周圍的固態電容(一整排)
  const capList = [];
  for (let i = 0; i < 14; i++) capList.push([-7.4 + i * 0.72, 5.75, FRONT]);
  for (let i = 0; i < 9; i++) capList.push([-6.6, 12.9 - i * 0.72, FRONT]);
  P.capCans(capList, { r: 0.28, h: 0.72, mats: M }, board);

  // ---------- 供電:電感 + MOSFET + 散熱片(有鰭片、拉絲鋁、燈條)----------
  const chokeList = [];
  for (let i = 0; i < 11; i++) chokeList.push([-7.6 + i * 1.05, 13.6, FRONT]);
  for (let i = 0; i < 7; i++) chokeList.push([-8.4, 11.9 - i * 1.05, FRONT]);
  P.chokes(chokeList, { s: 0.9, h: 0.6, mats: M }, board);
  P.mosfets(chokeList.map(([x, y, z]) => [x + (y > 13 ? 0 : 0.95), y + (y > 13 ? 0.95 : 0), z]), { s: 0.45, mats: M }, board);
  const sinkTop = new THREE.Group();
  sinkTop.position.set(-2.2, 15.4, FRONT);
  board.add(sinkTop);
  P.mesh(P.rbox(12.4, 2.1, 0.9, 0.12), M.alu, 0, 0, 1.25, sinkTop);
  P.finArray({ x: 0, y: 0, z: 2.05, w: 12, h: 2, d: 0.9, count: Math.round(34 * detail) + 6, t: 0.06, mat: M.aluDark }, sinkTop);
  const sinkLeft = new THREE.Group();
  sinkLeft.position.set(-10, 8.6, FRONT);
  board.add(sinkLeft);
  P.mesh(P.rbox(2.2, 10.2, 1.9, 0.14), M.alu, 0, 0, 1.2, sinkLeft);
  for (let i = 0; i < 9; i++) P.mesh(P.boxG(2.24, 0.12, 0.3), M.aluDark, 0, -4.5 + i * 1.12, 2.1, sinkLeft);
  // I/O 護罩(一大塊,側邊有燈條)
  const io = new THREE.Group();
  io.position.set(-13.9, 9.8, FRONT);
  board.add(io);
  P.mesh(P.rbox(3.4, 13.6, 3.4, 0.25), M.aluDark, 0, 0, 1.7, io);
  const ioLight = P.lightStrip(0.1, 12.4, 0.1, new THREE.Color());
  ioLight.position.set(1.72, 0, 3.2);
  io.add(ioLight);
  // 風扇與前面板排針、24-pin
  P.pinHeader({ x: 3.2, y: 16.9, z: FRONT, cols: 4, rows: 1, mats: M }, board);
  P.pinHeader({ x: 12.6, y: -17.2, z: FRONT, cols: 9, rows: 2, mats: M }, board);
  P.pinHeader({ x: 8.3, y: -17.2, z: FRONT, cols: 10, rows: 2, mats: M }, board);
  const atx = new THREE.Group();
  atx.position.set(14.6, 6.2, FRONT);
  board.add(atx);
  P.mesh(P.rbox(1.4, 5.6, 1.5, 0.08), M.plastic, 0, 0, 0.75, atx);
  P.instances(P.boxG(0.28, 0.28, 0.02), M.rubber, Array.from({ length: 24 }, (_, i) => [-0.25 + (i % 2) * 0.5, -2.4 + Math.floor(i / 2) * 0.42, 1.51]), atx);
  // CMOS 電池
  P.mesh(P.cylG(1, 0.3, 32), M.steel, 12.2, -1.2, FRONT + 0.15, board).rotation.x = Math.PI / 2;
  P.mesh(P.boxG(2.3, 0.3, 0.5), M.plastic, 12.2, -2.35, FRONT + 0.25, board);

  // ---------- 記憶體插槽 + 兩條 DDR5 ----------
  const RAMX = [5.2, 6.35, 7.5, 8.65];
  RAMX.forEach((x) => {
    P.mesh(P.rbox(0.62, 13.6, 0.85, 0.05), M.plastic, x, 9.4, FRONT + 0.42, board);
    P.mesh(P.rbox(0.66, 0.7, 1.1, 0.05), M.plasticGray, x, 16.45, FRONT + 0.55, board); // 卡榫
    P.mesh(P.rbox(0.66, 0.7, 1.1, 0.05), M.plasticGray, x, 2.35, FRONT + 0.55, board);
  });
  const ramCol = new THREE.Color();
  const rams = [RAMX[1], RAMX[3]].map((x) => {
    const g = new THREE.Group();
    g.position.set(x, 9.4, FRONT + 0.85);
    board.add(g);
    P.mesh(P.boxG(0.1, 13.3, 3.0), new THREE.MeshStandardMaterial({ color: 0x0c1a12, roughness: 0.6 }), 0, 0, 1.5, g); // PCB
    for (const sx of [-0.14, 0.14]) P.mesh(P.rbox(0.12, 13.4, 2.8, 0.04), M.aluDark, sx, 0, 1.7, g); // 散熱片
    const diff = P.mesh(P.rbox(0.36, 13.2, 0.45, 0.12), new THREE.MeshStandardMaterial({ color: 0x14161b, emissive: ramCol, emissiveIntensity: 0.5, roughness: 0.3, transparent: true, opacity: 0.95 }), 0, 0, 3.3, g);
    return { g, diff };
  });

  // ---------- M.2(Gen5,插座正下方)----------
  const m2 = new THREE.Group();
  m2.position.set(-5.2, 3.5, FRONT);
  board.add(m2);
  P.mesh(P.rbox(9.2, 2.6, 0.7, 0.1), M.alu, 0, 0, 0.35, m2);
  for (let i = 0; i < 12; i++) P.mesh(P.boxG(0.08, 2.4, 0.18), M.aluDark, -4.2 + i * 0.76, 0, 0.78, m2);

  // ---------- PCIe x16(金屬強化)----------
  const slot = new THREE.Group();
  slot.position.set(-4.2, SLOT_Y, FRONT);
  board.add(slot);
  P.mesh(P.rbox(16, 1.15, 1.1, 0.06), M.plastic, 0, 0, 0.55, slot);
  P.mesh(P.boxG(16.3, 1.3, 0.9), M.steel, 0, 0, 0.47, slot).scale.set(1, 1, 1);
  P.mesh(P.boxG(15.8, 0.3, 0.02), M.rubber, 0, 0, 1.11, slot);
  P.mesh(P.rbox(1.2, 1.5, 1.3, 0.08), M.plasticGray, 8.7, 0, 0.65, slot); // 卡榫

  // ---------- 小零件(表面黏著):避開大零件與作品區的字 ----------
  const busy = (x, y) =>
    (Math.abs(x - SOCK.x) < 3.6 && Math.abs(y - SOCK.y) < 3.6) || (x > 4.5 && x < 9.2 && y > 1.8 && y < 17) ||
    (x < -11.5 && y > 2.5) || (Math.abs(y - SLOT_Y) < 1) || (y < -0.2 && x > -15.4 && x < 15.4 && y > -17.9) ||
    (y > 14.2) || (x < -8.6 && y > 3.5 && y < 14) || (Math.abs(x + 5.2) < 4.8 && Math.abs(y - 3.5) < 1.5) || (x > 13.6 && y > 3 && y < 9.3);
  P.smdField({ area: [-15.6, -0.2, 15.6, 17.6], z: FRONT, count: Math.round(1300 * detail), seed: 7, avoid: busy, mats: M }, board);
  // 作品區裡也撒一點(但只在字與晶片的縫隙)
  const projBusy = (x, y) => (x < -6.6 && y < -1.4 && y > -11.9) || (x > -6.4 && y < -3 && y > -10.8) || (y < -11.2 && y > -15) || (y < -14.8) || (y > -3.2 && x > -15.4);
  P.smdField({ area: [-15.6, -17.8, 15.6, -0.4], z: FRONT, count: Math.round(420 * detail), seed: 9, avoid: projBusy, mats: M }, board);
  P.qfp({ x: 12.4, y: 12.5, z: FRONT, s: 1.4, pins: 12, mats: M }, board);
  P.qfp({ x: 11.2, y: -0.9 + 10, z: FRONT, s: 0.9, pins: 8, mats: M }, board);
  P.qfp({ x: -12.8, y: 0.2, z: FRONT, s: 1.1, pins: 10, mats: M }, board);

  // 主機板型號的絲印
  const mbCol = new THREE.Color();
  const mbName = etch.block({
    name: 'mb-name', w: 9, h: 1.3, res: 120, color: mbCol, intensity: 0.9,
    draw(g) { g.text('MPG X870E CARBON WIFI', 0.05, 0.62, { font: 'sans', size: 0.5, weight: 700, spacing: 0.08 }); g.text('MSI · AM5 · DDR5 · PCIE 5.0', 0.05, 1.1, { font: 'mono', size: 0.28, alpha: 0.6, spacing: 0.1 }); },
  });
  mbName.mesh.position.set(10.2, 17.2, FRONT + 0.01);
  board.add(mbName.mesh);

  // ---------- 作品區 ----------
  const col = { title: new THREE.Color(), feat: new THREE.Color(), sheet: new THREE.Color(), repo: new THREE.Color(), heat: new THREE.Color() };
  recolor.push(() => {
    eraSoft(4, 0.4, col.title); eraSoft(4, 0.35, col.feat); eraSoft(4, 0.5, col.sheet); eraSoft(4.2, 0.4, col.repo); eraSoft(4.3, 0.3, col.heat);
    eraSoft(4, 0.3, edgeCol); era(4, ioLight.material.color).multiplyScalar(1.4); eraSoft(6, 0.25, ramCol);
    eraSoft(4, 0.5, mbCol);
  });
  const blocks = [];
  const place = (b, x, y, z = FRONT + 0.012, parent = board) => { b.mesh.position.set(x, y, z); parent.add(b.mesh); blocks.push(b); return b; };

  const titleB = place(etch.block({
    name: 'proj-title', w: 14.5, h: 3.1, res: 110, color: col.title, intensity: 1.2,
    draw(g) {
      g.text('04 · ' + t('proj.eyebrow'), 0.05, 0.55, { font: 'mono', size: 0.36, spacing: 0.14, alpha: 0.75 });
      g.text(t('proj.title'), 0.05, 1.75, { font: 'serif', size: 0.95, weight: 700, maxW: 14.3 });
      g.text(t('proj.sub'), 0.05, 2.65, { font: 'body', size: 0.36, alpha: 0.72, maxW: 14.3 });
    },
  }), -8.3, -1.9);

  // 精選專案:一顆 BGA 大晶片(基板 + 封膠 + 金屬蓋 + 周圍的去耦電容)
  const FX = -11.1, FY = -6.9;
  const fg = new THREE.Group();
  fg.position.set(FX, FY, FRONT);
  board.add(fg);
  P.mesh(P.rbox(6.6, 6.6, 0.18, 0.08), M.substrate, 0, 0, 0.09, fg);
  P.mesh(P.rbox(5.5, 5.5, 0.32, 0.1), M.chip, 0, 0, 0.34, fg);
  P.mesh(P.rbox(5.1, 5.1, 0.04, 0.08), M.alu, 0, 0, 0.52, fg);
  const dc = [];
  for (let i = 0; i < 12; i++) { const tt = -2.9 + i * 0.52; dc.push([tt, 3.05, 0.18], [tt, -3.05, 0.18], [3.05, tt, 0.18], [-3.05, tt, 0.18]); }
  P.instances(P.boxG(0.16, 0.08, 0.06), M.ceramic, dc.map((p, i) => [...p, i % 4 < 2 ? 0 : Math.PI / 2]), fg);
  const feat = etch.block({
    name: 'feat-chip', w: 5, h: 5, res: 200, color: col.feat, intensity: 1.3,
    draw(g) {
      g.text(document.documentElement.dataset.lang === 'en' ? 'FEATURED' : t('feat.tag') + ' · FEATURED', 0.2, 0.52, { font: 'mono', size: 0.21, spacing: 0.14, alpha: 0.7, maxW: 4.6 });
      g.wrap(FEATURED.name, 0.2, 1.35, 4.6, { font: 'serif', size: 0.6, weight: 700, lh: 1.15 });
      g.text(FEATURED.host, 0.2, 2.02, { font: 'mono', size: 0.25, alpha: 0.85 });
      FEATURED.stats.forEach(([a, b], i) => {
        const x = 0.2 + (i % 2) * 2.4, y = 2.95 + Math.floor(i / 2) * 1.0;
        g.text(a, x, y, { font: 'serif', size: 0.48, weight: 700 });
        g.text(t(b), x, y + 0.35, { font: 'body', size: 0.19, alpha: 0.7, maxW: 2.2 });
      });
      g.hot(0, 0, 5, 5, FEATURED.live, FEATURED.host);
    },
  });
  place(feat, 0, 0, 0.545, fg);
  const cta = etch.block({
    name: 'feat-cta', w: 6.6, h: 1.1, res: 150, color: col.feat, intensity: 1.3,
    draw(g) {
      const btn = (x, w, label, href) => {
        g.rect(x, 0.12, w, 0.8, { stroke: '#fff', lw: 0.04, r: 0.16, alpha: 0.9 });
        g.text(label, x + w / 2, 0.64, { size: 0.3, weight: 700, align: 'center', spacing: 0.04, maxW: w - 0.3 });
        g.hot(x, 0.12, w, 0.8, href, label);
      };
      btn(0.05, 3.2, t('feat.try') + ' ↗', FEATURED.live);
      btn(3.35, 3.2, t('feat.src') + ' ↗', FEATURED.source);
    },
  });
  place(cta, FX, FY - 4.2);
  const sheet = etch.block({
    name: 'feat-sheet', w: 21, h: 7.4, res: 95, color: col.sheet, intensity: 1.15,
    draw(g) {
      g.rect(0.02, 0.02, 20.96, 7.36, { stroke: '#fff', lw: 0.03, r: 0.2, alpha: 0.18 });
      g.text('DATASHEET · ' + FEATURED.name, 0.3, 0.55, { font: 'mono', size: 0.26, spacing: 0.12, alpha: 0.6 });
      const y1 = g.wrap(t(FEATURED.lede), 0.3, 1.2, 20.4, { font: 'body', size: 0.36, lh: 1.55 });
      g.rule(0.3, y1 - 0.05, 20.4, { alpha: 0.3, t: 0.03 });
      const n = FEATURED.notes.length, cw = 20.4 / n;
      FEATURED.notes.forEach(([a, b], i) => {
        const x = 0.3 + i * cw;
        g.wrap(t(a), x, y1 + 0.6, cw - 0.5, { font: 'sans', size: 0.34, weight: 700, lh: 1.3 });
        g.wrap(t(b), x, y1 + 1.55, cw - 0.5, { font: 'body', size: 0.27, lh: 1.6, alpha: 0.82, maxLines: 5 });
      });
    },
  });
  place(sheet, 4.9, -6.9);

  // 其他 repo:一排小晶片(QFN 封裝 + 側邊接腳),數量跟著資料
  const NCHIP = GITHUB.maxChips;
  const repoChips = Array.from({ length: NCHIP }, (_, i) => {
    const g = new THREE.Group();
    board.add(g);
    P.mesh(P.rbox(3.3, 3.3, 0.14, 0.06), M.substrate, 0, 0, FRONT + 0.07, g);
    P.mesh(P.rbox(2.75, 2.75, 0.26, 0.08), M.chip, 0, 0, FRONT + 0.27, g);
    const legs = [];
    for (let k = 0; k < 8; k++) { const tt = -1.15 + k * 0.33; legs.push([tt, 1.47, FRONT + 0.05, 0, 0.12, 0.2, 0.05], [tt, -1.47, FRONT + 0.05, 0, 0.12, 0.2, 0.05], [1.47, tt, FRONT + 0.05, 0, 0.2, 0.12, 0.05], [-1.47, tt, FRONT + 0.05, 0, 0.2, 0.12, 0.05]); }
    P.instances(P.boxG(1, 1, 1), M.solder, legs, g);
    const top = etch.block({
      name: 'repo-top-' + i, w: 2.6, h: 2.6, res: 260, color: col.repo, intensity: 1.3,
      draw(gg) {
        const r = repoCards()?.[i];
        if (!r) { gg.text('—', 1.3, 1.5, { font: 'mono', size: 0.4, align: 'center', alpha: 0.4 }); return; }
        gg.wrap(r.title, 0.15, 0.62, 2.35, { font: 'sans', size: 0.3, weight: 700, lh: 1.2, maxLines: 3 });
        gg.text([r.language, r.date].filter(Boolean).join(' · '), 0.15, 2.2, { font: 'mono', size: 0.16, alpha: 0.7 });
        if (r.stars) gg.text('★ ' + r.stars, 2.45, 2.2, { font: 'mono', size: 0.16, alpha: 0.7, align: 'right' });
        gg.hot(0, 0, 2.6, 2.6, r.url, r.title);
      },
    });
    top.mesh.position.set(0, 0, FRONT + 0.405);
    g.add(top.mesh);
    blocks.push(top);
    const desc = etch.block({
      name: 'repo-desc-' + i, w: 4.3, h: 3.4, res: 170, color: col.sheet, intensity: 1.1,
      draw(gg) {
        const r = repoCards()?.[i];
        if (!r) return;
        gg.wrap(r.desc, 0.05, 0.28, 4.2, { font: 'body', size: 0.21, lh: 1.55, alpha: 0.85, maxLines: 7 });
        if (r.live) {
          const host = new URL(r.live).hostname;
          gg.text('LIVE · ' + host + ' ↗', 0.05, 3.25, { font: 'mono', size: 0.19, weight: 700 });
          gg.hot(0, 2.95, 4.3, 0.4, r.live, host);
        }
      },
    });
    desc.mesh.position.set(3.95, 0.05, FRONT + 0.012);
    g.add(desc.mesh);
    blocks.push(desc);
    return { g, top, desc };
  });
  // 依實際數量置中排列
  const layoutRepos = () => {
    const n = Math.min(NCHIP, repoCards()?.length || NCHIP);
    const span = 8.1, x0 = -((n - 1) * span) / 2 - 2.1;
    repoChips.forEach((R, i) => { R.g.visible = i < n; R.g.position.set(x0 + i * span, -13.2, 0); R.top.redraw(); R.desc.redraw(); });
  };
  layoutRepos();
  addEventListener('repos:data', layoutRepos);
  addEventListener('langchange', () => requestAnimationFrame(layoutRepos));

  // 熱力圖:53 × 7 顆 LED(真的 LED 小方塊 + 透明的燈罩)
  const HC = 53, HR = 7, HP = 0.4, HX0 = -10.2, HY0 = -15.35;
  const leds = new THREE.InstancedMesh(P.rbox(0.28, 0.28, 0.14, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffff }), HC * HR);
  const ledLevel = new Float32Array(HC * HR).fill(-1);
  for (let c = 0; c < HC; c++) for (let rr = 0; rr < HR; rr++) { m4.makeTranslation(HX0 + c * HP, HY0 - rr * HP, FRONT + 0.07); leds.setMatrixAt(c * HR + rr, m4); }
  board.add(leds);
  P.mesh(P.rbox(HC * HP + 0.4, HR * HP + 0.4, 0.06, 0.1), M.glass, HX0 + (HC - 1) * HP / 2, HY0 - (HR - 1) * HP / 2, FRONT + 0.18, board);
  const heatInfo = { total: null };
  const heatLabel = etch.block({
    name: 'heat-label', w: 5.2, h: 3, res: 150, color: col.heat, intensity: 1.2,
    draw(g) {
      g.text(t('gh.head'), 0.05, 0.55, { font: 'sans', size: 0.34, weight: 700, maxW: 5.1 });
      if (heatInfo.total != null) g.text(`${heatInfo.total} ${t('gh.total')}`, 0.05, 1.15, { font: 'mono', size: 0.28, alpha: 0.85 });
      g.text(t('proj.more'), 0.05, 2.35, { font: 'sans', size: 0.3, weight: 700, maxW: 5.1 });
      g.hot(0, 1.9, 5.2, 0.7, GITHUB.all, t('proj.more'));
    },
  });
  place(heatLabel, -13.1, -16.3);
  const loadHeat = () => {
    const d = getHeat();
    if (!d?.contributions?.length) return;
    const days = d.contributions.slice(-HC * HR);
    const pad = HC * HR - days.length;
    for (let i = 0; i < HC * HR; i++) ledLevel[i] = i < pad ? -1 : days[i - pad].level;
    heatInfo.total = d.total?.lastYear ?? days.reduce((s, x) => s + x.count, 0);
    heatLabel.redraw();
  };
  addEventListener('heat:data', loadHeat);
  loadHeat();
  const ledC = new THREE.Color();

  // ---------- 05 顯示卡 ----------
  // 模型座標:PCB 在 XY 平面(長 30、高 12),背板在 -z 側,散熱器與風扇在 +z 側,金手指在 y = -6
  const gpu = new THREE.Group();
  root.add(gpu);
  const gpcbMat = new THREE.MeshStandardMaterial({ color: 0x0b0d12, metalness: 0.3, roughness: 0.6, map: pcbTextures(30, 12, 17).map });
  P.mesh(P.boxG(30, 12, 0.16), gpcbMat, 0, 0, 0, gpu);
  P.instances(P.boxG(0.3, 0.8, 0.18), M.gold, Array.from({ length: 30 }, (_, i) => [-8 + i * 0.44, -6.3, 0]), gpu);
  // 擋板 + 輸出孔(DP × 3、HDMI)
  const bracket = new THREE.Group();
  bracket.position.set(-15.1, 0.2, 1.4);
  gpu.add(bracket);
  P.mesh(P.boxG(0.12, 13.2, 3.2), M.steel, 0, 0, 0, bracket);
  P.instances(P.rbox(0.14, 1.9, 0.8, 0.05), M.rubber, [[0.02, 3.8, 0], [0.02, 1.4, 0], [0.02, -1, 0], [0.02, -3.4, 0]], bracket);
  P.instances(P.boxG(0.13, 0.9, 0.12), M.steel, [[0.03, 5.6, -0.8], [0.03, -5.2, -0.8]], bracket);
  // 散熱器:外殼(拉絲鋁,斜切的面)+ 裡面的鰭片 + 熱導管 + 三顆風扇
  const shroud = new THREE.Group();
  shroud.position.z = 0.2;
  gpu.add(shroud);
  P.finArray({ x: 0.2, y: 0, z: 1.55, w: 28.6, h: 10.6, d: 2.7, count: Math.round(96 * detail) + 20, t: 0.05, mat: M.aluDark }, shroud);
  for (let i = 0; i < 5; i++) {
    const yy = -3.2 + i * 1.6;
    P.heatpipe([new THREE.Vector3(-13, yy, 0.45), new THREE.Vector3(-4, yy + 0.3, 0.45), new THREE.Vector3(4, yy - 0.3, 0.45), new THREE.Vector3(13.5, yy, 0.45)], { r: 0.28, mat: M.copper }, shroud);
  }
  const cover = new THREE.Group();
  cover.position.z = 3.15;
  shroud.add(cover);
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x1f2228, metalness: 0.95, roughness: 0.36, roughnessMap: P.brushedTex([3, 1]) });
  // 外殼做成有開孔的框(三個圓孔給風扇):用 Shape + holes 擠出
  const cs = new THREE.Shape();
  cs.moveTo(-14.6, -5.8); cs.lineTo(14.8, -5.8); cs.lineTo(14.8, 5.8); cs.lineTo(-14.6, 5.8); cs.lineTo(-14.6, -5.8);
  const FANX = [-9.8, 0.2, 10.2];
  for (const fx of FANX) { const h = new THREE.Path(); h.absarc(fx, 0, 4.75, 0, Math.PI * 2, true); cs.holes.push(h); }
  const coverGeo = new THREE.ExtrudeGeometry(cs, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 48 });
  P.mesh(coverGeo, coverMat, 0, 0, 0, cover);
  const fanCol = new THREE.Color();
  const fans = FANX.map((x) => {
    const g = new THREE.Group();
    g.position.set(x, 0, 3.05);
    shroud.add(g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.78, 0.09, 8, 96), new THREE.MeshBasicMaterial({ color: fanCol }));
    ring.position.z = 0.62;
    g.add(ring);
    const spin = new THREE.Group();
    g.add(spin);
    spin.add(P.fanBlades({ R: 4.55, hub: 1.25, count: 11, thick: 0.05, mat: new THREE.MeshStandardMaterial({ color: 0x101115, metalness: 0.3, roughness: 0.45 }) }));
    const hub = P.mesh(P.cylG(1.25, 0.3, 40), new THREE.MeshStandardMaterial({ color: 0x22252c, metalness: 0.85, roughness: 0.28, roughnessMap: P.brushedTex([1, 1]) }), 0, 0, 0.1, g);
    hub.rotation.x = Math.PI / 2;
    return { g, ring, spin };
  });
  // 卡側的燈條 + 字 + 供電接頭(裝回機殼時朝向鏡頭的那一面)
  const sideCol = new THREE.Color();
  const sideBar = P.lightStrip(24, 0.12, 0.26, sideCol);
  sideBar.position.set(0.8, 6.02, 3.3);
  gpu.add(sideBar);
  const side = etch.block({ name: 'gpu-side', w: 12, h: 1.4, res: 100, color: sideCol, intensity: 1, draw(g) { g.text('GEFORCE RTX 5080', 6, 0.95, { font: 'sans', size: 0.72, weight: 700, spacing: 0.14, align: 'center' }); } });
  side.mesh.rotation.x = -Math.PI / 2;
  side.mesh.position.set(2, 6.12, 1.9);
  gpu.add(side.mesh);
  P.mesh(P.rbox(2.2, 0.9, 1, 0.08), M.plastic, 9, 6.2, 0.7, gpu); // 12V-2x6
  // PCB 背面(-z 側):GPU 封裝 + 記憶體(遊戲)+ 供電零件 + 兩側絲印(興趣)
  const back = new THREE.Group();
  back.position.z = -0.08;
  back.rotation.y = Math.PI; // 背面的東西用「從背面看」的座標排:x 往右就是畫面右邊
  gpu.add(back);
  P.mesh(P.rbox(4.8, 4.8, 0.14, 0.08), M.substrate, 0, 0.2, 0.07, back);
  P.mesh(P.rbox(2.9, 2.9, 0.16, 0.05), new THREE.MeshStandardMaterial({ color: 0x191d2a, metalness: 0.85, roughness: 0.18 }), 0, 0.2, 0.22, back);
  const gpuCaps = [];
  for (let i = 0; i < 10; i++) { const tt = -2.1 + i * 0.47; gpuCaps.push([tt, 2.45, 0.16], [tt, -2.05, 0.16]); }
  P.instances(P.boxG(0.14, 0.07, 0.06), M.ceramic, gpuCaps, back);
  // 供電:左右兩側的電感 + MOSFET
  const gChokes = [];
  for (let i = 0; i < 5; i++) { gChokes.push([-13.6 + i * 1.05, -4.6, 0], [9.3 + i * 1.05, -4.6, 0]); }
  P.chokes(gChokes, { s: 0.85, h: 0.5, mats: M }, back);
  P.smdField({ area: [-14.5, -5.6, 14.5, 5.6], z: 0, count: Math.round(520 * detail), seed: 21, mats: M, avoid: (x, y) => (Math.abs(x) < 6.3 && Math.abs(y) < 5.8) || (Math.abs(x) > 6 && y > -4 && y < 5.4) || y < -5.2 }, back);
  const gCol = { title: new THREE.Color(), game: new THREE.Color(), int: new THREE.Color(), music: new THREE.Color() };
  recolor.push(() => { eraSoft(5, 0.35, gCol.title); eraSoft(5, 0.45, gCol.game); eraSoft(5, 0.4, gCol.int); eraSoft(5, 0.45, gCol.music); eraSoft(5, 0.1, fanCol).multiplyScalar(2); eraSoft(5, 0.2, sideCol).multiplyScalar(1.6); });
  const gtitle = etch.block({
    name: 'gpu-title', w: 2.8, h: 2.8, res: 280, color: gCol.title, intensity: 1.3,
    draw(g) {
      g.text('05 · ' + t('int.eyebrow'), 1.4, 0.55, { font: 'mono', size: 0.16, spacing: 0.12, alpha: 0.7, align: 'center' });
      g.wrap(t('int.title'), 0.2, 1.2, 2.4, { font: 'serif', size: 0.34, weight: 700, lh: 1.3 });
    },
  });
  gtitle.mesh.position.set(0, 0.2, 0.305);
  back.add(gtitle.mesh);
  // 遊戲 = 記憶體
  const slots = memSlots(GAMES.length);
  const gameChips = GAMES.map((G, i) => {
    const S = slots[i] || { x: 0, y: 0, vert: false };
    const w = S.vert ? 1.9 : 2.8, h = S.vert ? 2.8 : 1.9;
    P.mesh(P.rbox(w, h, 0.2, 0.05), M.chip, S.x, S.y, 0.1, back);
    const b = etch.block({
      name: 'game-' + i, w, h, res: 300, color: gCol.game, intensity: 1.25,
      draw(g) {
        if (S.vert) {
          g.wrap(G.name, 0.12, 1.45, w - 0.2, { font: 'sans', size: 0.2, weight: 700, lh: 1.2, maxLines: 3 });
          g.text(t(G.tag), 0.12, h - 0.25, { font: 'body', size: 0.15, alpha: 0.75, maxW: w - 0.2 });
        } else {
          g.wrap(G.name, 1.25, 0.55, w - 1.35, { font: 'sans', size: 0.2, weight: 700, lh: 1.2, maxLines: 2 });
          g.text(t(G.tag), 1.25, h - 0.25, { font: 'body', size: 0.15, alpha: 0.75, maxW: w - 1.35 });
        }
      },
    });
    b.mesh.position.set(S.x, S.y, 0.205);
    back.add(b.mesh);
    const im = assets.img(G.img);
    const tx = new THREE.Texture(im); tx.colorSpace = THREE.SRGBColorSpace;
    const up = () => { tx.needsUpdate = true; };
    if (im.complete && im.naturalWidth) up(); else im.addEventListener('load', up);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: tx, transparent: true, color: new THREE.Color(0.72, 0.72, 0.72) }));
    if (S.vert) logo.position.set(S.x, S.y + h / 2 - 0.62, 0.21);
    else logo.position.set(S.x - w / 2 + 0.62, S.y, 0.21);
    back.add(logo);
    return b;
  });
  // 興趣:兩側絲印(前一半在左、後一半在右)
  const half = Math.ceil(INTERESTS.length / 2);
  const intBlocks = INTERESTS.map((I, i) => {
    const left = i < half, row = left ? i : i - half, rows = left ? half : INTERESTS.length - half;
    const bh = Math.min(4.6, 10.4 / rows);
    const blk = etch.block({
      name: 'int-' + i, w: 8.2, h: bh, res: 110, color: gCol.int, intensity: 1.2,
      draw(g) {
        g.text(String(i + 1).padStart(2, '0'), 0.05, 0.55, { font: 'mono', size: 0.3, alpha: 0.55 });
        g.text(t(I.title), 0.9, 0.62, { font: 'sans', size: 0.56, weight: 700, maxW: 7.2 });
        g.wrap(t(I.desc), 0.05, 1.55, 8, { font: 'body', size: 0.33, lh: 1.6, alpha: 0.85, maxLines: Math.max(1, Math.floor((bh - 1.4) / 0.53)) });
      },
    });
    blk.mesh.position.set(left ? -10.35 : 10.35, 5.2 - bh / 2 - row * (bh + 0.3), 0.012);
    back.add(blk.mesh);
    return blk;
  });
  // 背板:常聽的音樂(依數量分欄)+ 等化器 + 散熱孔
  const plate = new THREE.Group();
  plate.position.z = 0.95;
  back.add(plate);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, metalness: 0.9, roughness: 0.34, roughnessMap: P.brushedTex([4, 2]) });
  P.mesh(P.rbox(30, 12, 0.12, 0.2), plateMat, 0, 0, 0, plate);
  const vent = P.mesh(new THREE.PlaneGeometry(6, 10), new THREE.MeshStandardMaterial({ color: 0x050507, metalness: 0.2, roughness: 0.8, alphaMap: P.ventTex([2.4, 4]), transparent: true, depthWrite: false }), 11.7, 0, 0.065, plate);
  vent.visible = MUSIC.length <= 4;
  const NM = MUSIC.length, colW = 29 / NM;
  const music = etch.block({
    name: 'music', w: 29, h: 11.2, res: 80, color: gCol.music, intensity: 1.2,
    draw(g) {
      g.text('♪ ' + t('music.head'), 0.2, 0.9, { font: 'sans', size: 0.62, weight: 700 });
      g.text('RTX 5080 · 16GB · BACKPLATE', 28.8, 0.85, { font: 'mono', size: 0.3, alpha: 0.5, align: 'right', spacing: 0.1 });
      MUSIC.forEach((m, i) => {
        const x = 0.2 + i * colW;
        g.text(t(m.title), x, 5.4, { font: 'sans', size: 0.5, weight: 700, maxW: colW - 0.5 });
        g.wrap(t(m.desc), x, 6.25, colW - 0.5, { font: 'body', size: 0.3, lh: 1.6, alpha: 0.85, maxLines: 7 });
      });
    },
  });
  music.mesh.position.z = 0.07;
  plate.add(music.mesh);
  const BARS = 9, EQN = NM * BARS;
  const eq = new THREE.InstancedMesh(P.rbox(0.34, 1, 0.08, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff }), EQN);
  eq.position.z = 0.1;
  plate.add(eq);
  const eqC = new THREE.Color();

  // 顯示卡的姿態:飛進來 → 面對鏡頭(背板朝前)→ 插回 PCIe 槽
  const GP = {
    away: { p: new THREE.Vector3(46, 8, -14), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, Math.PI - 0.9, 0.3)) },
    show: { p: new THREE.Vector3(0, 0.5, -24), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, Math.PI, 0)) },
    slot: { p: new THREE.Vector3(-1.2, SLOT_Y, BZ + FRONT + 0.6 + 6.3), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)) },
  };
  const gp = new THREE.Vector3(), gq = new THREE.Quaternion();

  function update(st) {
    const { s, k, time, dt } = st;
    // 主機板在 04 章之前看不到(黑暗的背景 + 霧),不畫,省下一大半的繪製
    root.visible = s > st.last('ai') - 0.2;
    const power = smooth(st.last('ai') + 0.5, k('proj.board'), s);
    pcbMat.emissive.copy(era(4)).multiplyScalar(power * (0.2 + 0.05 * Math.sin(time * 1.3)));
    edge.material.opacity = 0.12 + power * 0.55;
    ioLight.visible = power > 0.05;
    rams.forEach((R, i) => { R.diff.material.emissiveIntensity = power * (0.22 + 0.1 * Math.sin(time * 1.6 + i)); });
    const rv = (b, a, c) => { b.mat.uniforms.uReveal.value = smooth(a, c, s); };
    rv(titleB, k('proj.board') - 0.55, k('proj.board') - 0.08);
    rv(feat, k('proj.board') + 0.2, k('proj.featured') - 0.05);
    rv(cta, k('proj.board') + 0.4, k('proj.featured'));
    rv(sheet, k('proj.featured') + 0.2, k('proj.notes') - 0.05);
    repoChips.forEach((R, i) => { rv(R.top, k('proj.notes') + 0.1 + i * 0.08, k('proj.repos') - 0.1); rv(R.desc, k('proj.notes') + 0.25 + i * 0.08, k('proj.repos')); });
    rv(heatLabel, k('proj.repos') + 0.2, k('proj.heat') - 0.05);
    const sweep = smooth(k('proj.repos') + 0.1, k('proj.heat'), s);
    if (root.visible) for (let c = 0; c < HC; c++) for (let rr = 0; rr < HR; rr++) {
      const i = c * HR + rr, lv = ledLevel[i];
      const on = c / HC < sweep ? 1 : 0;
      const b = lv < 0 ? 0.02 : (0.06 + [0, 0.35, 0.6, 0.85, 1.2][lv | 0] * on) * (0.3 + 0.7 * power);
      era(4.3, ledC).multiplyScalar(b * 2.2);
      leds.setColorAt(i, ledC);
    }
    if (leds.instanceColor) leds.instanceColor.needsUpdate = true;

    // --- 顯示卡 ---
    const arrive = smooth(k('proj.heat') + 0.15, k('int.music') - 0.1, s);
    const open = smooth(k('int.music') + 0.2, k('int.pcb') - 0.1, s);
    const install = smooth(k('int.games') + 0.25, k('setup.pc') - 0.25, s);
    gpu.visible = arrive > 0.001;
    gp.copy(GP.away.p).lerp(GP.show.p, arrive);
    gq.copy(GP.away.q).slerp(GP.show.q, arrive);
    if (install > 0) { gp.lerp(GP.slot.p, install); gq.slerp(GP.slot.q, install); }
    if (install < 1) gp.y += Math.sin(time * 0.9) * 0.12 * (1 - install);
    gpu.position.copy(gp);
    gpu.quaternion.copy(gq);
    const lift = open * (1 - install);
    plate.position.set(0, lift * 15, 0.95 + lift * 5);
    plate.rotation.x = lift * 0.35;
    music.mat.uniforms.uReveal.value = smooth(k('proj.heat') + 0.6, k('int.music') - 0.02, s);
    gtitle.mat.uniforms.uReveal.value = smooth(k('int.music') + 0.4, k('int.pcb') - 0.05, s);
    intBlocks.forEach((b, i) => rv(b, k('int.music') + 0.45 + i * 0.06, k('int.pcb')));
    gameChips.forEach((b, i) => rv(b, k('int.pcb') + 0.1 + i * 0.04, k('int.games') - 0.1));
    const act = arrive * (1 - install * 0.5);
    if (gpu.visible) for (let c = 0; c < NM; c++) for (let j = 0; j < BARS; j++) {
      const i = c * BARS + j;
      const h = 0.25 + act * (1.4 + 1.4 * Math.abs(Math.sin(time * (2.2 + c * 0.55 + j * 0.13) + j * 1.7 + c)) * (0.5 + 0.5 * Math.sin(j * 0.7 + time * 1.3 + c)));
      m4.makeScale(1, h, 1).setPosition(-14.3 + c * colW + j * 0.46 + 0.4, 1.2 + h / 2, 0);
      eq.setMatrixAt(i, m4);
      era(5 + c * 0.05, eqC).lerp(WHITE, 0.15).multiplyScalar(0.55 + h * 0.12);
      eq.setColorAt(i, eqC);
    }
    eq.instanceMatrix.needsUpdate = true;
    if (eq.instanceColor) eq.instanceColor.needsUpdate = true;
    for (const F of fans) F.spin.rotation.z -= dt * (2 + 8 * act);
  }

  hot.push(...blocks.map((b) => b.mesh));
  // 靜態合批:主機板與顯示卡上不會動的零件依材質合併(會動的:專案晶片會重新排版、I/O 燈會開關、背板會掀、風扇會轉)
  const keepRepo = new Set(repoChips.map((R) => R.g));
  P.bakeStatic(board, { exclude: (o) => keepRepo.has(o) || o === ioLight });
  const keepFan = new Set(fans.map((F) => F.g));
  P.bakeStatic(gpu, { exclude: (o) => o === plate || keepFan.has(o) });
  return { update };
}
