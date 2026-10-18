// 07 訊號送出 —— 穿過事件視界。
//
// 鏡頭最後一段是自由落下:先貼著光子球邊緣往下掉,接著穿過 r = 1(視界)。
// 在視界裡往前看,中央是一個越來越大的黑色圓錐(半角 = arccos √r),整個宇宙被擠成它邊緣一圈藍移的亮光。
// 聯絡方式刻在最後一塊黑玻璃上,一群光點從四面八方掉進來、拼成那一行字。
// 連結可以點;黑玻璃本身幾乎看不見,只有邊緣反射那一圈光。

import * as THREE from 'three';
import { t } from '../../../i18n.js';
import { CONTACT } from '../../../../data/world.js';
import { makeSwarm } from '../../particles.js';
import { sph, camKey, screenAt, facing, besideHole } from '../kit.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const W = 6.4, H = 3.5;

export function buildHorizon(ctx) {
  const { kit, mobile } = ctx;
  const root = new THREE.Group();
  root.name = 'horizon';

  const plate = kit.plate({
    name: 'contact', w: W, h: H, d: 0.04, mat: kit.M.dark, ch: 7, res: 200, intensity: 1.25, white: 0.45, bolts: false,
    draw(g) {
      g.text('07 · ' + t('ct.eyebrow') + ' · EVENT HORIZON', W / 2, 0.5, { font: 'mono', size: 0.17, spacing: 0.18, alpha: 0.7, align: 'center', maxW: W - 0.6 });
      g.text(t('ct.title'), W / 2, 1.32, { font: 'serif', size: 0.6, weight: 700, align: 'center', maxW: W - 0.6 });
      g.text(t('ct.sub'), W / 2, 1.82, { font: 'body', size: 0.19, alpha: 0.85, align: 'center', maxW: W - 0.6 });
      const btn = (x, w, label, href) => {
        g.rect(x, 2.2, w, 0.46, { stroke: '#fff', lw: 0.02, r: 0.23, alpha: 0.95 });
        g.text(label, x + w / 2, 2.5, { font: 'sans', size: 0.18, weight: 700, align: 'center', spacing: 0.04, maxW: w - 0.2 });
        g.hot(x, 2.2, w, 0.46, href, label);
      };
      btn(W / 2 - 1.85, 1.75, t('ct.mail') + ' →', CONTACT.mail);
      btn(W / 2 + 0.1, 1.75, 'GitHub ↗', CONTACT.github);
      g.text(CONTACT.site + ' · © 2026 · ' + t('ft.src') + ' ↗', W / 2, 3.12, { font: 'mono', size: 0.12, alpha: 0.55, align: 'center', spacing: 0.12, maxW: W - 0.6 });
      g.hot(W / 2 - 1.6, 2.95, 3.2, 0.25, 'https://github.com/Tunai-0511/tun9i-site', t('ft.src'));
    },
  });
  root.add(plate.g);

  // ---------- 掉進來的光點:拼成標題與兩顆按鈕的外框 ----------
  const PN = mobile ? 2200 : 5200;
  const swCol = new THREE.Color();
  const swarm = makeSwarm({ count: PN, size: 0.035, color: swCol });
  plate.g.add(swarm.points);
  const sample = (() => {
    const c = document.createElement('canvas');
    const S = 60;
    c.width = W * S; c.height = H * S;
    const x = c.getContext('2d');
    return () => {
      x.clearRect(0, 0, c.width, c.height);
      x.fillStyle = '#fff'; x.textAlign = 'center';
      x.font = `700 ${0.6 * S}px 'Playfair Display', 'Songti TC', 'Noto Serif TC', serif`;
      x.fillText(t('ct.title'), c.width / 2, 1.32 * S);
      x.lineWidth = 0.02 * S; x.strokeStyle = '#fff';
      for (const bx of [W / 2 - 1.85, W / 2 + 0.1]) { x.beginPath(); if (x.roundRect) x.roundRect(bx * S, 2.2 * S, 1.75 * S, 0.46 * S, 0.23 * S); else x.rect(bx * S, 2.2 * S, 1.75 * S, 0.46 * S); x.stroke(); }
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const pts = [];
      for (let yy = 0; yy < c.height; yy += 2) for (let xx = 0; xx < c.width; xx += 2) if (d[(yy * c.width + xx) * 4 + 3] > 140) pts.push([xx / S - W / 2, H / 2 - yy / S]);
      return pts;
    };
  })();
  const fillTargets = () => {
    const pts = sample();
    if (!pts.length) return;
    swarm.setTo((i, v, r) => { const p = pts[Math.floor(r() * pts.length)]; v.set(p[0], p[1], 0.03); });
  };
  // 起點:四面八方的一層殼(像從整個天空掉進來)
  swarm.setFrom((i, v, r) => { const a = r() * Math.PI * 2, z = r() * 2 - 1, rad = 7 + r() * 9; const s = Math.sqrt(1 - z * z); v.set(Math.cos(a) * s * rad, z * rad * 0.6, Math.sin(a) * s * rad * 0.4 - 1); });
  fillTargets();
  swarm.U.uNoise.value = 0.04;
  swarm.U.uOrbitR.value.set(W * 0.6, 0.6, 1.2);
  document.fonts?.ready.then(fillTargets);
  addEventListener('langchange', () => requestAnimationFrame(fillTargets));
  ctx.recolor.push(() => kit.eraSoft(7, 0.35, swCol).multiplyScalar(1.1));

  // ---------- 鏡頭 ----------
  // 掉落:貼著陰影邊緣往下;最後一個鏡頭在視界裡面(r ≈ 0.9),往黑洞中心看
  const Cf = sph(2.05, 6, 5), Tf = besideHole(Cf, 56, 1, 0.06);
  const Cs = sph(0.9, 14, 2), Ts = Cs.clone().multiplyScalar(0.55);
  const D = 0.2;
  screenAt(Cs, Ts, 0, 0.04, D, plate.g.position);
  plate.g.quaternion.copy(facing(Cs, Ts));
  plate.g.scale.setScalar(D / 8.6);
  swarm.U.uSpace.value = D / 8.6;
  const keys = [
    camKey('contact.fall', Cf, Tf, { pull: false, fog: [8, 80] }),
    camKey('contact.sky', Cs, Ts, { pull: false, fov: 52, fog: [8, 80] }),
  ];

  function update(st) {
    const on = st.s > st.first('contact') - 1.4;
    root.visible = on;
    if (!on) return;
    const k = st.last('contact');
    const r = smooth(k - 0.9, k - 0.05, st.s);
    // 直向的手機:畫面很窄,牌子跟著縮到放得下(水平視角 ≈ 0.84 弧度時是原尺寸)
    const hf = 2 * Math.atan(Math.tan((52 * Math.PI) / 360) * (innerWidth / innerHeight));
    plate.g.scale.setScalar((D / 8.6) * Math.min(1, hf / 0.84));
    plate.b.mat.uniforms.uReveal.value = smooth(0.55, 1, r);
    swarm.U.uTime.value = st.time;
    swarm.U.uMix.value = r;
    swarm.U.uAlpha.value = 0.25 + 0.75 * r;
    swarm.U.uViewH.value = innerHeight;
    swarm.U.uBurst.value *= 0.92;
  }
  function pulse(ray, st) { if (st.s > st.last('contact') - 0.5) swarm.U.uBurst.value = 1; }

  return { root, keys, update, pulse, hotMeshes: [plate.b.mesh] };
}
