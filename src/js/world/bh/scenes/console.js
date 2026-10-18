// 06 配備 —— 光子球。
//
// 鏡頭降到離中心不到 3.5 r_s 的地方:1.5 r_s 是光子球,光在這裡可以繞著黑洞轉圈。
// 從這裡看出去,陰影佔了大半個天空,整個宇宙被擠成它邊緣的一圈亮光。
// 跑這一切的機器刻在探測器的兩塊儀表面板上:左邊主機規格(像 neofetch 的輸出),右邊週邊。
// 面板是黑色玻璃,字是等寬的 —— 這是全片唯一長得像螢幕的地方。

import * as THREE from 'three';
import { t } from '../../../i18n.js';
import { SPECS, GEAR } from '../../../../data/world.js';
import * as P from '../../parts.js';
import { sph, camKey, screenAt, facing, besideHole } from '../kit.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

export function buildConsole(ctx) {
  const { kit } = ctx;
  const root = new THREE.Group();
  root.name = 'console';

  const row = (g, y, label, value, note) => {
    g.text(label, 0.3, y, { font: 'mono', size: 0.15, alpha: 0.6, spacing: 0.06, maxW: 1.25 });
    g.text(value, 1.62, y, { font: 'sans', size: 0.19, weight: 700, maxW: 3.9 });
    if (note) g.text(note, 1.62, y + 0.24, { font: 'mono', size: 0.12, alpha: 0.6, maxW: 3.9 });
  };
  const RH = 0.56;
  const rig = kit.plate({
    name: 'setup-rig', w: 5.8, h: 1.75 + SPECS.length * RH, d: 0.05, mat: kit.M.dark, ch: 6, res: 170, intensity: 1.3, white: 0.4,
    draw(g) {
      g.text('06 · ' + t('setup.eyebrow') + ' · PHOTON SPHERE', 0.3, 0.42, { font: 'mono', size: 0.16, spacing: 0.14, alpha: 0.7, maxW: 5.2 });
      g.text(t('setup.title'), 0.3, 0.98, { font: 'serif', size: 0.42, weight: 700, maxW: 5.2 });
      g.text(t('setup.sub'), 0.3, 1.34, { font: 'body', size: 0.15, alpha: 0.75, maxW: 5.2 });
      g.rule(0.3, 1.52, 5.2, { alpha: 0.25, t: 0.01 });
      SPECS.forEach((S, i) => row(g, 1.86 + i * RH, t(S.label), S.value, S.note ? t(S.note) : ''));
    },
  });
  root.add(rig.g);
  const gear = kit.plate({
    name: 'setup-gear', w: 5.8, h: 1.2 + GEAR.length * RH, d: 0.05, mat: kit.M.dark, ch: 6.4, res: 170, intensity: 1.3, white: 0.4,
    draw(g) {
      g.text(t('setup.gear') + ' · PERIPHERALS', 0.3, 0.42, { font: 'mono', size: 0.16, spacing: 0.14, alpha: 0.7, maxW: 5.2 });
      g.rule(0.3, 0.62, 5.2, { alpha: 0.25, t: 0.01 });
      GEAR.forEach((G, i) => row(g, 0.98 + i * RH, t(G.label), G.value, G.note ? t(G.note) : ''));
    },
  });
  root.add(gear.g);
  // 面板的框:細細一圈金屬
  for (const pl of [rig, gear]) {
    const { width: w, height: h } = pl.slab.geometry.parameters;
    const fr = new THREE.Group();
    for (const [x, y, ww, hh] of [[0, h / 2 + 0.04, w + 0.16, 0.08], [0, -h / 2 - 0.04, w + 0.16, 0.08], [w / 2 + 0.04, 0, 0.08, h], [-w / 2 - 0.04, 0, 0.08, h]]) P.mesh(P.boxG(ww, hh, 0.09), kit.M.frame, x, y, 0, fr);
    pl.g.add(fr);
  }

  // ---------- 鏡頭 ----------
  // 鏡頭沿切線方向看:陰影在畫面右半,面板在左半
  const C1 = sph(3.5, 338, 9), T1 = besideHole(C1, 34, 2, 0.05);
  const C2 = sph(3.0, 352, 6), T2 = besideHole(C2, 30, 2, 0.04);
  const place = (pl, C, T, sx, sy, D, base) => {
    screenAt(C, T, sx, sy, D, pl.g.position);
    pl.g.quaternion.copy(facing(C, T));
    pl.g.scale.setScalar(D / base);
  };
  place(rig, C1, T1, -0.36, 0.0, 0.75, 13.5);
  place(gear, C2, T2, -0.36, 0.02, 0.62, 13.5);
  const keys = [
    camKey('setup.pc', C1, T1, { pull: false, fog: [6, 60] }),
    camKey('setup.desk', C2, T2, { pull: false, fog: [6, 60] }),
  ];

  // 進出場交給引擎(不在畫面裡就直接換,在畫面裡就長出來 / 收起來)
  const want = (st) => st.s > st.first('setup') - 1.8 && st.s < st.last('setup') + 1.3;
  function update(st) {
    if (!want(st)) return;
    const k0 = st.first('setup');
    const rv = (ki) => smooth(0.15, 1, 1 - smooth(0.45, 1.2, Math.abs(st.s - ki)));
    rig.b.mat.uniforms.uReveal.value = rv(k0);
    gear.b.mat.uniforms.uReveal.value = rv(k0 + 1);
  }
  return { root, keys, update, want, units: [rig.g, gear.g], hotMeshes: [] };
}
