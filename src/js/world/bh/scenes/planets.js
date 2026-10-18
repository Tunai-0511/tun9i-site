// 05 下班之後 —— 一串掉進來的行星,和一張重力波的頻譜。
//
// 在玩的遊戲 = 一顆顆行星,沿著一條往黑洞彎進去的路排成一串(《EVENT HORIZON》第五幕:我們的太陽系掉了進來)。
// 每顆行星的表面是程序畫的(氣態巨行星的條紋、岩石的坑洞、冰、熔岩),頭上掛一塊小牌子:遊戲圖示、名字、類型。
// 興趣是第一塊牌子;常聽的音樂刻成重力波的「啁啾」—— LIGO 把兩個黑洞合併的訊號轉成聲音時,就是這種越來越快、越來越尖的波形。
//
// 多一款遊戲 → 多一顆行星;多一類音樂 → 多一條波形(src/data/world.js 的 GAMES、MUSIC)。

import * as THREE from 'three';
import { t } from '../../../i18n.js';
import { INTERESTS, GAMES, MUSIC } from '../../../../data/world.js';
import * as P from '../../parts.js';
import { sph, camKey, screenAt, facing } from '../kit.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

// 行星表面(等距長方投影的 canvas)
const KINDS = [
  { kind: 'gas', a: '#c9a27a', b: '#7d5a44' },
  { kind: 'rock', a: '#8f8a84', b: '#4c4844' },
  { kind: 'ice', a: '#bcd3e0', b: '#6f8fa6' },
  { kind: 'gas', a: '#d8c08e', b: '#9a6b3c' },
  { kind: 'lava', a: '#2a1a16', b: '#ff7a3a' },
  { kind: 'rock', a: '#b07a5c', b: '#5a3426' },
  { kind: 'ice', a: '#a9b8e8', b: '#5d62a8' },
  { kind: 'gas', a: '#8fb6a8', b: '#3f6a62' },
];
function planetTex(i) {
  const K = KINDS[i % KINDS.length];
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const r = P.rng(31 + i * 7);
  x.fillStyle = K.a; x.fillRect(0, 0, 512, 256);
  if (K.kind === 'gas' || K.kind === 'ice') {
    for (let y = 0; y < 256; y += 2) {
      const n = Math.sin(y * 0.09 + i) * 0.5 + Math.sin(y * 0.031 + i * 3) * 0.5;
      x.globalAlpha = 0.18 + 0.4 * Math.abs(n) * (K.kind === 'ice' ? 0.5 : 1);
      x.fillStyle = n > 0 ? K.b : K.a;
      x.fillRect(0, y, 512, 2);
    }
    if (K.kind === 'gas') { x.globalAlpha = 0.5; x.fillStyle = K.b; x.beginPath(); x.ellipse(150 + r() * 200, 150, 30, 14, 0, 0, 7); x.fill(); }
  } else {
    for (let k = 0; k < 160; k++) {
      const cx = r() * 512, cy = r() * 256, rad = 2 + Math.pow(r(), 3) * 26;
      x.globalAlpha = 0.25 + r() * 0.35;
      x.fillStyle = K.b;
      x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill();
      if (K.kind === 'lava' && r() > 0.6) { x.strokeStyle = K.b; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + (r() - 0.5) * 120, cy + (r() - 0.5) * 60); x.stroke(); }
    }
  }
  x.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 重力波的啁啾:頻率與振幅一路上升到合併,接著是快速衰減的鈴宕
function chirp(x0, y0, w, h, seed) {
  const pts = [];
  const tm = 0.82 + seed * 0.03; // 合併的位置
  let ph = 0;
  for (let i = 0; i <= 260; i++) {
    const u = i / 260;
    let A, f;
    if (u < tm) { const tau = Math.max(tm - u, 0.004); f = 6 * Math.pow(tau / tm, -0.62); A = Math.pow(tau / tm, -0.27) * 0.3; }
    else { const v = (u - tm) / (1 - tm); f = 34; A = Math.exp(-v * 5) * 1.0; }
    ph += f * (1 / 260) * Math.PI * 2;
    pts.push([x0 + u * w, y0 - Math.min(A, 1) * Math.sin(ph + seed) * h * 0.5]);
  }
  return pts;
}

export function buildPlanets(ctx) {
  const { kit, assets, recolor } = ctx;
  const root = new THREE.Group();
  root.name = 'planets';

  // ---------- 掉進來的那條路 ----------
  const NG = GAMES.length;
  const pathPt = (u) => {
    const az = 288 + u * 34, rr = 12.5 - u * 4.6, el = 22 - u * 10;
    return sph(rr, az, el);
  };
  const road = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 121 }, (_, i) => pathPt(-0.12 + (i / 120) * 1.28))),
    kit.lineMat(5, 0.3, 0.3),
  );
  road.frustumCulled = false;
  root.add(road);

  const planets = GAMES.map((G, i) => {
    const u = NG > 1 ? i / (NG - 1) : 0.5;
    const pos = pathPt(u);
    const rad = 0.26 + 0.18 * ((i * 37) % 5) / 4;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(rad, 48, 24), new THREE.MeshStandardMaterial({ map: planetTex(i), roughness: 0.85, metalness: 0 }));
    mesh.position.copy(pos);
    mesh.rotation.z = 0.3 - ((i * 13) % 7) * 0.08;
    root.add(mesh);
    // 熔岩那顆自己會發光
    if (KINDS[i % KINDS.length].kind === 'lava') { mesh.material.emissive = new THREE.Color(1, 0.42, 0.16); mesh.material.emissiveMap = mesh.material.map; mesh.material.emissiveIntensity = 0.6; }
    // 有些有環
    if (i % 3 === 0) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(rad * 1.45, rad * 2.1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.5, 0.45), transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = Math.PI / 2 - 0.4;
      mesh.add(ring);
    }
    // 牌子:遊戲圖示 + 名字 + 類型
    const tag = kit.plate({
      name: 'game-' + i, w: 2.6, h: 0.82, d: 0.03, mat: kit.M.titan, ch: 5, res: 260, intensity: 1.3, white: 0.45, bolts: false,
      draw(g) {
        g.text(G.name, 0.86, 0.38, { font: 'sans', size: 0.17, weight: 700, maxW: 1.62 });
        g.text(t(G.tag), 0.86, 0.62, { font: 'body', size: 0.11, alpha: 0.72, maxW: 1.62 });
      },
    });
    root.add(tag.g);
    const img = assets.img(G.img);
    const it = new THREE.Texture(img);
    it.colorSpace = THREE.SRGBColorSpace;
    const upd = () => { it.needsUpdate = true; };
    if (img.complete && img.naturalWidth) upd(); else img.addEventListener('load', upd);
    const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: it, transparent: true, depthWrite: false }));
    icon.position.set(-2.6 / 2 + 0.11 + 0.31, 0, 0.022);
    icon.renderOrder = 6;
    tag.g.add(icon);
    const lead = kit.leader(5, 0.5);
    root.add(lead.g);
    return { G, i, mesh, rad, tag, lead, pos, spin: 0.15 + ((i * 7) % 5) * 0.06 };
  });

  // ---------- 興趣 ----------
  const interests = kit.plate({
    name: 'interests', w: 6.6, h: 3.9, d: 0.05, mat: kit.M.titan, ch: 5, res: 160, intensity: 1.25, white: 0.45,
    draw(g) {
      g.text('05 · ' + t('int.eyebrow') + ' · AFTER HOURS', 0.32, 0.55, { font: 'mono', size: 0.22, spacing: 0.14, alpha: 0.75, maxW: 6 });
      g.text(t('int.title'), 0.32, 1.26, { font: 'serif', size: 0.52, weight: 700, maxW: 6 });
      INTERESTS.forEach((I, k) => {
        const x = 0.32 + (k % 2) * 3.1, y = 1.95 + Math.floor(k / 2) * 0.98;
        g.text(t(I.title), x, y, { font: 'sans', size: 0.24, weight: 700, maxW: 2.8 });
        g.wrap(t(I.desc), x, y + 0.3, 2.85, { font: 'body', size: 0.15, lh: 1.45, alpha: 0.78, maxLines: 2 });
      });
    },
  });
  root.add(interests.g);

  // ---------- 音樂:重力波 ----------
  const NM = MUSIC.length;
  const MH = 1.25 + NM * 0.86;
  const music = kit.plate({
    name: 'music', w: 6.8, h: MH, d: 0.05, mat: kit.M.titan, ch: 5.4, res: 160, intensity: 1.25, white: 0.4,
    draw(g) {
      g.text(t('music.head') + ' · GRAVITATIONAL WAVES', 0.32, 0.55, { font: 'mono', size: 0.22, spacing: 0.12, alpha: 0.75, maxW: 6.2 });
      g.text('h(t) · strain', 6.48, 0.55, { font: 'mono', size: 0.16, alpha: 0.45, align: 'right' });
      MUSIC.forEach((m, k) => {
        const y = 1.2 + k * 0.86;
        g.poly(chirp(0.32, y + 0.24, 2.1, 0.5, k * 0.7), { alpha: 0.75, lw: 0.018 });
        g.line(0.32, y + 0.24, 2.42, y + 0.24, { alpha: 0.15, lw: 0.008 });
        g.text(t(m.title), 2.7, y + 0.12, { font: 'sans', size: 0.22, weight: 700, maxW: 3.8 });
        g.wrap(t(m.desc), 2.7, y + 0.42, 3.8, { font: 'body', size: 0.13, lh: 1.4, alpha: 0.78, maxLines: 2 });
      });
    },
  });
  root.add(music.g);

  // ---------- 鏡頭 + 牌子 ----------
  const Ci = sph(21, 281, 26), Ti = pathPt(0.15).lerp(new THREE.Vector3(), 0.35);
  const Cg = sph(21, 298, 27), Tg = pathPt(0.5).lerp(new THREE.Vector3(), 0.12).add(new THREE.Vector3(0, -0.6, 0));
  const Cm = sph(15, 322, 22), Tm = pathPt(0.95).lerp(new THREE.Vector3(), 0.4);
  const place = (pl, C, T, sx, sy, depthF, base) => {
    const D = C.distanceTo(T) * depthF;
    screenAt(C, T, sx, sy, D, pl.g.position);
    pl.g.quaternion.copy(facing(C, T));
    pl.g.scale.setScalar(D / base);
  };
  place(interests, Ci, Ti, -0.38, 0.12, 0.5, 21);
  place(music, Cm, Tm, -0.34, 0.06, 0.5, 15.5);
  const TS = 0.78; // 行星牌子的大小
  for (const Pn of planets) Pn.tag.g.scale.setScalar(TS);

  const keys = [
    camKey('int.pcb', Ci, Ti, { fog: [3, 30] }),
    camKey('int.games', Cg, Tg, { fog: [3, 30] }),
    camKey('int.music', Cm, Tm, { fog: [3, 30] }),
  ];

  const up = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  // 行星進出場交給引擎;牌子跟著自己的鏡頭長出來 / 收起來(沒輪到的黑板不會擋在行星前面,也不會一下子跳出來)
  const want = (st) => st.s > st.first('interests') - 2.0 && st.s < st.last('interests') + 1.3;
  const base = new Map([interests.g, music.g].map((g) => [g, g.scale.x]));
  const grow = (g, r, s0 = base.get(g)) => {
    const k = smooth(0, 0.55, r);
    g.visible = k > 0.002;
    g.scale.setScalar(s0 * (0.4 + 0.6 * k));
    return k;
  };
  function update(st) {
    const k0 = st.first('interests'), k1 = st.last('interests');
    road.material.opacity = 0.3 * smooth(k0 - 2, k0 - 0.8, st.s) * (1 - smooth(k1 + 0.4, k1 + 1.3, st.s));
    road.visible = road.material.opacity > 0.002;
    if (!want(st)) { interests.g.visible = music.g.visible = false; for (const Pn of planets) Pn.tag.g.visible = Pn.lead.g.visible = false; return; }
    const win = (ki, w = 0.95) => 1 - smooth(w * 0.45, w, Math.abs(st.s - ki));
    const ri = win(k0), rm = win(k0 + 2);
    grow(interests.g, ri);
    grow(music.g, rm);
    interests.b.mat.uniforms.uReveal.value = smooth(0.25, 1, ri);
    music.b.mat.uniforms.uReveal.value = smooth(0.25, 1, rm);
    const rg = win(k0 + 1, 0.85);
    up.set(0, 1, 0).applyQuaternion(st.camera.quaternion);
    for (const Pn of planets) {
      Pn.mesh.rotation.y = st.time * Pn.spin;
      // 牌子:雙數號在行星上方、單數號在下方,鄰居才不會疊在一起
      const above = Pn.i % 2 === 0;
      Pn.tag.g.position.copy(Pn.pos).addScaledVector(up, (above ? 1 : -1) * (Pn.rad + 0.75));
      Pn.tag.g.quaternion.copy(st.camera.quaternion);
      const kt = grow(Pn.tag.g, rg, TS);
      Pn.lead.g.visible = Pn.tag.g.visible;
      Pn.lead.line.material.opacity = 0.5 * kt;
      Pn.tag.b.mat.uniforms.uReveal.value = smooth(0.25, 1, rg);
      a.copy(Pn.pos).addScaledVector(up, (above ? 1 : -1) * Pn.rad * 1.05);
      b.set(-1.3 * TS, (above ? -0.41 : 0.41) * TS, 0).applyQuaternion(st.camera.quaternion).add(Pn.tag.g.position);
      Pn.lead.set(a, b, 0.03);
    }
  }

  return { root, keys, update, want, units: planets.map((Pn) => Pn.mesh), hotMeshes: [] };
}
