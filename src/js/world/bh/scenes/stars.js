// 02 歷程 —— S 星群。
//
// 銀河中心的黑洞旁邊有一群繞著它跑的恆星(S2 就是其中一顆,天文學家靠它的軌道量出了黑洞的質量)。
// 這裡每一張證照是一顆 S 星:越新的軌道越內圈、越亮,最重要的那張(major)帶發光色條。
// 恆星照克卜勒定律跑(近心點快、遠心點慢),身後拖一段漸暗的軌跡。
// 標示牌像紀錄片的字卡一樣排在畫面一側,引線一路拉到那顆正在跑的星;鏡頭到了那一組才被雷射寫出來。
// 「正在學的」是一團還在收縮的原恆星雲:粒子繞著一顆暗紅的核心轉。
//
// 多一張證照 → 多一顆星、多一條軌道,鏡頭的分組也跟著變(src/data/world.js 的 CERTS)。

import * as THREE from 'three';
import { t } from '../../../i18n.js';
import { CERTS, LEARNING } from '../../../../data/world.js';
import { makeSwarm } from '../../particles.js';
import { sph, camKey, screenAt, facing } from '../kit.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

const TRAIL_VERT = /* glsl */ `
  attribute float aT;
  uniform float uHead;
  varying float vA;
  void main() {
    float d = fract(uHead - aT);           // 0 = 星的位置,往後越來越淡
    vA = 0.1 + 0.9 * exp(-d * 4.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const TRAIL_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha;
  varying float vA;
  void main() { gl_FragColor = vec4(uColor * vA * uAlpha, 1.0); }`;

// 光暈貼圖(徑向漸層)
let haloTex = null;
export function halo() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}

// 解克卜勒方程:平均近點角 M → 偏近點角 E
function kepler(M, e) {
  let E = M;
  for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

// 鏡頭鍵到了才把牌子寫出來(雷射掃過 + 牌子彈出),離開就收起來
function reveal(st, ki, w = 0.95) {
  const d = Math.abs(st.s - ki);
  return 1 - smooth(w * 0.45, w, d);
}

export function buildStars(ctx) {
  const { kit, recolor } = ctx;
  const root = new THREE.Group();
  root.name = 'stars';
  const N = CERTS.length;

  // 軌道參數:由舊到新 → 由外到內
  const ORB = CERTS.map((C, i) => {
    const k = N > 1 ? i / (N - 1) : 1;
    const a = 15 - k * 8.5;
    return {
      C, i, a,
      e: [0.46, 0.34, 0.52, 0.3, 0.42, 0.38, 0.5][i % 7],
      inc: [64, 36, 76, 48, 26, 58, 40][i % 7],
      node: [18, 150, 262, 84, 326, 200, 120][i % 7],
      peri: [40, 210, 120, 300, 20, 260, 160][i % 7],
      period: 38 * Math.pow(a / 6.5, 1.5),
      phase: [0.15, 0.55, 0.8, 0.35, 0.62, 0.05, 0.9][i % 7],
    };
  });

  const stars = ORB.map((O) => {
    const g = new THREE.Group();
    g.quaternion
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), (O.node * Math.PI) / 180)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (O.inc * Math.PI) / 180))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (O.peri * Math.PI) / 180));
    root.add(g);
    const b = O.a * Math.sqrt(1 - O.e * O.e), c = O.a * O.e;
    const SEG = 360;
    const pos = new Float32Array((SEG + 1) * 3), at = new Float32Array(SEG + 1);
    for (let s = 0; s <= SEG; s++) {
      const E = (s / SEG) * Math.PI * 2;
      pos.set([Math.cos(E) * O.a - c, 0, Math.sin(E) * b], s * 3);
      at[s] = s / SEG;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aT', new THREE.BufferAttribute(at, 1));
    const col = new THREE.Color();
    const trail = new THREE.Line(geo, new THREE.ShaderMaterial({
      uniforms: { uHead: { value: 0 }, uColor: { value: col }, uAlpha: { value: O.C.major ? 1.1 : 0.75 } },
      vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    trail.frustumCulled = false;
    g.add(trail);
    const coreCol = new THREE.Color();
    const core = new THREE.Mesh(new THREE.SphereGeometry(O.C.major ? 0.22 : 0.15, 16, 12), new THREE.MeshBasicMaterial({ color: coreCol }));
    const glowCol = new THREE.Color();
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: glowCol, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    spr.scale.setScalar(O.C.major ? 3.6 : 2.4);
    core.add(spr);
    g.add(core);
    const ch = 2 + O.i * 0.12;
    recolor.push(() => {
      kit.eraSoft(ch, 0.25, col);
      kit.eraSoft(ch, 0.6, coreCol).multiplyScalar(O.C.major ? 9 : 6);
      kit.eraSoft(ch, 0.35, glowCol).multiplyScalar(O.C.major ? 1.5 : 1.0);
    });
    const tag = kit.plate({
      name: 'cert-' + O.C.id, w: 6.2, h: 1.9, d: 0.05, mat: kit.M.titan, ch, res: 150, intensity: 1.3, white: 0.5, edge: !!O.C.major,
      draw(gg) {
        gg.text(O.C.date, 0.3, 0.5, { font: 'mono', size: 0.26, spacing: 0.1, weight: 700, alpha: 0.85 });
        gg.text(O.C.major ? 'S' + (O.i + 1) + ' · MAJOR' : 'S' + (O.i + 1), 5.9, 0.5, { font: 'mono', size: 0.2, spacing: 0.14, alpha: 0.55, align: 'right' });
        // 單行,太長就自動縮小(英文、日文的證照名稱比中文長很多)
        gg.text(t(O.C.name), 0.3, 1.08, { font: 'sans', size: 0.36, weight: 700, maxW: 5.6 });
        gg.text(t(O.C.org), 0.3, 1.55, { font: 'body', size: 0.22, alpha: 0.75, maxW: 5.6 });
      },
    });
    root.add(tag.g);
    const lead = kit.leader(ch, 0.55);
    root.add(lead.g);
    return { O, g, b, c, trail, core, tag, lead, starW: new THREE.Vector3(), ki: 0 };
  });

  // ---------- 原恆星雲(正在學的)----------
  const PROTO = sph(25, 60, -5);
  const proto = new THREE.Group();
  proto.position.copy(PROTO);
  root.add(proto);
  const pc = new THREE.Color();
  const pcore = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: pc }));
  const pglowCol = new THREE.Color();
  const pglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: pglowCol, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  pglow.scale.setScalar(2.4);
  pcore.add(pglow);
  proto.add(pcore);
  const swCol = new THREE.Color();
  const swarm = makeSwarm({ count: ctx.mobile ? 900 : 2000, size: 0.05, color: swCol });
  swarm.setFrom((i, v, r) => { const a = r() * Math.PI * 2, rad = 1 + Math.pow(r(), 0.7) * 4; v.set(Math.cos(a) * rad, (r() - 0.5) * 1.6, Math.sin(a) * rad); });
  swarm.setTo((i, v, r) => { const a = r() * Math.PI * 2, rad = 0.5 + Math.pow(r(), 1.4) * 2.6; v.set(Math.cos(a) * rad, (r() - 0.5) * 0.25, Math.sin(a) * rad); });
  swarm.U.uOrbitR.value.set(2.4, 0.4, 2.4);
  swarm.U.uNoise.value = 0.12;
  swarm.points.rotation.x = 0.4;
  proto.add(swarm.points);
  recolor.push(() => { kit.era(2.6, pc).multiplyScalar(1.6); kit.era(2.4, pglowCol).multiplyScalar(0.35); kit.eraSoft(2.5, 0.3, swCol).multiplyScalar(1.4); });
  const LH = 1.1 + LEARNING.length * 1.25;
  const learn = kit.plate({
    name: 'journey-learn', w: 6.4, h: LH, d: 0.05, mat: kit.M.titan, ch: 2.5, res: 150, intensity: 1.25, white: 0.45,
    draw(g) {
      g.text(t('jr.learning') + ' · PROTOSTAR', 0.3, 0.62, { font: 'mono', size: 0.24, spacing: 0.12, alpha: 0.75, maxW: 5.8 });
      LEARNING.forEach((L, i) => {
        const y = 1.25 + i * 1.25;
        g.text(t(L.title), 0.3, y, { font: 'sans', size: 0.32, weight: 700, maxW: 5.8 });
        g.wrap(t(L.desc), 0.3, y + 0.38, 5.8, { font: 'body', size: 0.2, lh: 1.45, alpha: 0.8, maxLines: 2 });
      });
    },
  });
  root.add(learn.g);
  const learnLead = kit.leader(2.5, 0.55);
  root.add(learnLead.g);

  // ---------- 章節標題 ----------
  const title = kit.plate({
    name: 'journey-title', w: 8.4, h: 2.7, d: 0.06, mat: kit.M.titan, ch: 2, res: 120, intensity: 1.25, white: 0.45,
    draw(g) {
      g.text('02 · ' + t('jr.eyebrow'), 0.35, 0.62, { font: 'mono', size: 0.3, spacing: 0.14, alpha: 0.75 });
      g.text(t('jr.title'), 0.35, 1.5, { font: 'serif', size: 0.72, weight: 700, maxW: 7.7 });
      g.text(t('jr.certs') + ' · S-STARS', 0.35, 2.2, { font: 'mono', size: 0.24, spacing: 0.1, alpha: 0.6, maxW: 7.7 });
    },
  });
  root.add(title.g);

  // ---------- 鏡頭 + 牌子的位置 ----------
  // 一組最多三張,由新到舊(內圈先);第一組同時是總覽,左上角掛章節標題
  const order = [...stars].sort((A, B) => B.O.i - A.O.i);
  const groups = [];
  for (let i = 0; i < order.length; i += 3) groups.push(order.slice(i, i + 3));
  const CAMS = [
    { C: sph(44, 16, 30), T: new THREE.Vector3(2.5, -1, 0) },
    { C: sph(34, 34, 18), T: new THREE.Vector3(2, -0.5, 0) },
    { C: sph(36, 48, 22), T: new THREE.Vector3(2, 0, 0) },
  ];
  const keys = [];
  groups.forEach((G, gi) => {
    const { C, T } = CAMS[Math.min(gi, CAMS.length - 1)];
    const D = C.distanceTo(T) * 0.55;
    const q = facing(C, T);
    G.forEach((S, j) => {
      screenAt(C, T, 0.52, 0.32 - j * 0.42, D, S.tag.g.position);
      S.tag.g.quaternion.copy(q);
      S.tag.g.scale.setScalar(D / 24);
      S.group = gi;
    });
    if (gi === 0) {
      screenAt(C, T, -0.5, 0.42, D, title.g.position);
      title.g.quaternion.copy(q);
      title.g.scale.setScalar(D / 24);
    }
    keys.push(camKey('journey.' + gi, C, T, { layers: G.map((S) => S.O.i).sort((a, b) => a - b), fog: [4, 30] }));
  });
  {
    const C = PROTO.clone().add(sph(10, 40, 18)), T = PROTO.clone().lerp(new THREE.Vector3(), 0.2);
    const D = C.distanceTo(PROTO) * 0.8;
    screenAt(C, T, 0.4, 0.05, D, learn.g.position);
    learn.g.quaternion.copy(facing(C, T));
    learn.g.scale.setScalar(D / 18);
    keys.push(camKey('journey.learn', C, T, { fog: [4, 30] }));
  }

  // 出場與退場都是漸變的:整個星群在 02 章前後一段距離內淡入淡出;牌子從小長大、雷射再把字寫上去
  const base = new Map([...stars.map((S) => S.tag.g), title.g, learn.g].map((g) => [g, g.scale.x]));
  const grow = (g, r) => {
    const k = smooth(0, 0.55, r);
    g.visible = k > 0.002;
    g.scale.setScalar(base.get(g) * (0.4 + 0.6 * k));
    return k;
  };
  const corner = new THREE.Vector3();
  function update(st) {
    const k0 = st.first('journey'), k1 = st.last('journey');
    const fade = smooth(k0 - 1.9, k0 - 0.6, st.s) * (1 - smooth(k1 + 0.5, k1 + 1.7, st.s));
    root.visible = fade > 0.002;
    if (!root.visible) return;
    for (const S of stars) {
      const { O } = S;
      const M = ((st.time / O.period + O.phase) % 1) * Math.PI * 2;
      const E = kepler(M, O.e);
      S.core.position.set(Math.cos(E) * O.a - S.c, 0, Math.sin(E) * S.b);
      S.core.scale.setScalar(fade);
      S.trail.material.uniforms.uHead.value = E / (Math.PI * 2);
      S.trail.material.uniforms.uAlpha.value = (O.C.major ? 1.1 : 0.75) * fade;
      const r = reveal(st, k0 + S.group);
      const k = grow(S.tag.g, r);
      S.lead.g.visible = S.tag.g.visible;
      if (S.tag.g.visible) {
        S.tag.b.mat.uniforms.uReveal.value = smooth(0.25, 1, r);
        S.lead.line.material.opacity = 0.55 * k;
        S.core.getWorldPosition(S.starW);
        corner.set(-3.1, -0.95, 0).applyMatrix4(S.tag.g.matrixWorld);
        S.lead.set(S.starW, corner, 0.07);
      }
    }
    const rt = reveal(st, k0);
    grow(title.g, rt);
    title.b.mat.uniforms.uReveal.value = smooth(0.25, 1, rt);
    const rl = reveal(st, k1);
    const kl = grow(learn.g, rl);
    learnLead.g.visible = learn.g.visible;
    learnLead.line.material.opacity = 0.55 * kl;
    learn.b.mat.uniforms.uReveal.value = smooth(0.25, 1, rl);
    corner.set(-3.2, -LH / 2, 0).applyMatrix4(learn.g.matrixWorld);
    learnLead.set(PROTO, corner, 0.1);
    pcore.scale.setScalar(fade);
    swarm.U.uAlpha.value = fade;
    swarm.U.uTime.value = st.time;
    swarm.U.uMix.value = 1;
    swarm.U.uOrbit.value = 1;
    swarm.U.uViewH.value = innerHeight;
  }

  return { root, keys, update, hotMeshes: [] };
}
