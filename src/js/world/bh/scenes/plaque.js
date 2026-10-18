// 00 遠方 + 01 關於 —— 先鋒號式的金色銘板。
//
// 開場:鏡頭在 40 r_s 外,一片陽極處理的金色銘板飄在畫面左邊,右邊是黑洞與吸積盤。
// 銘板正面刻著名字、頭像、標語、數據與兩顆連結按鈕;右欄是先鋒號銘板的兩個圖案:氫原子的超精細躍遷、脈衝星地圖。
// 01:銘板翻面(繞自己的垂直軸轉半圈),背面的鈦合金上刻著自我介紹;時間線畫成脈衝星地圖 ——
// 從同一個焦點放射出去的線,每一條線是一個里程碑,線上的刻痕是二進位的年份。

import * as THREE from 'three';
import { t } from '../../../i18n.js';
import { TIMELINE } from '../../../../data/world.js';
import { sph, camKey } from '../kit.js';

const W = 4.8, H = 3.2;

export function buildPlaque(ctx) {
  const { kit, assets, U } = ctx;
  const root = new THREE.Group();
  root.name = 'plaque';

  // 位置:鏡頭(40 r_s、仰角 6°)前方偏左 8.5 個單位,面向鏡頭
  const C0 = sph(40, 0, 6);
  const toHole = C0.clone().negate().normalize();
  const side = new THREE.Vector3().crossVectors(toHole, new THREE.Vector3(0, 1, 0)).normalize(); // 畫面右
  const up = new THREE.Vector3().crossVectors(side, toHole).normalize();
  const center = C0.clone().addScaledVector(toHole, 9).addScaledVector(side, -3.0).addScaledVector(up, 0.2);
  const pivot = new THREE.Group();
  pivot.position.copy(center);
  pivot.lookAt(C0);
  pivot.scale.setScalar(0.72);
  root.add(pivot);
  const flip = new THREE.Group(); // 01 章翻面用
  pivot.add(flip);

  // ---------- 正面:金色銘板 ----------
  const avatar = assets.img('/images/avatar-v2.webp');
  const front = kit.plate({
    name: 'plaque-front', w: W, h: H, d: 0.05, mat: kit.M.gold, ch: 0, res: 520, intensity: 1.2, white: 0.55,
    draw(g) {
      g.rect(0.26, 0.26, 1.02, 1.02, { stroke: '#fff', lw: 0.012, r: 0.15, alpha: 0.6 });
      g.text(t('hero.eyebrow'), 1.48, 0.56, { size: 0.12, weight: 500, alpha: 0.8, maxW: 1.8 });
      g.text('Tunai', 1.42, 1.18, { font: 'serif', size: 0.66, weight: 700, maxW: 1.9 });
      g.text(t('hero.tagline'), 0.26, 1.64, { size: 0.15, weight: 700, spacing: 0.02, maxW: 3.0 });
      g.wrap(t('hero.sub'), 0.26, 1.92, 3.0, { font: 'body', size: 0.1, lh: 1.6, alpha: 0.85, maxLines: 3 });
      g.rule(0.26, 2.5, 3.0, { alpha: 0.35 });
      const stats = [['7+', t('stats.repos')], ['5', t('stats.certs')], ['3', t('stats.langs')]];
      stats.forEach(([n, l], i) => {
        const x = 0.26 + i * 1.02;
        g.text(n, x, 2.83, { font: 'serif', size: 0.27, weight: 700 });
        g.text(l, x + g.measure(n, { font: 'serif', size: 0.27, weight: 700 }) + 0.06, 2.81, { size: 0.08, alpha: 0.75, maxW: 0.66 });
      });
      g.text('TN-2026 · LAUNCHED FROM TAICHUNG, TAIWAN', 0.26, 3.06, { font: 'mono', size: 0.055, alpha: 0.5, spacing: 0.08, maxW: 3.0 });

      // 右欄:氫原子超精細躍遷(兩個圓 + 自旋箭頭)—— 先鋒號銘板上的長度單位
      const hx = 3.62, hy = 0.6;
      for (const cx of [hx, hx + 0.62]) {
        g.circle(cx, hy, 0.17, { stroke: '#fff', lw: 0.01, alpha: 0.55 });
        g.circle(cx, hy, 0.035, { fill: '#fff', alpha: 0.7 });
      }
      g.rule(hx + 0.18, hy, 0.26, { alpha: 0.45, t: 0.008 });
      g.text('21 cm', hx + 0.31, hy + 0.36, { font: 'mono', size: 0.06, alpha: 0.5, align: 'center' });
      // 右欄:脈衝星地圖(從同一點放射的線,刻痕是二進位)
      const px = 3.46, py = 1.82;
      const rays = [[-0.2, 0.95], [0.25, 0.8], [0.62, 0.66], [0.95, 0.42], [1.05, 0.05], [0.9, -0.42], [0.42, -0.62], [-0.06, -0.72]];
      rays.forEach(([dx, dy], i) => {
        const L = Math.hypot(dx, dy), ux = dx / L, uy = -dy / L; // 畫布的 y 向下
        g.line(px, py, px + ux * L * 0.95, py + uy * L * 0.95, { alpha: 0.42, lw: 0.008 });
        for (let k = 0; k < 6; k++) {
          if (!(((i * 37 + 11) >> k) & 1)) continue;
          const s = 0.3 + k * 0.1;
          g.line(px + ux * s - uy * 0.03, py + uy * s + ux * 0.03, px + ux * s + uy * 0.03, py + uy * s - ux * 0.03, { alpha: 0.42, lw: 0.008 });
        }
      });
      g.circle(px, py, 0.03, { fill: '#fff', alpha: 0.8 });
      // 連結:兩顆刻在板上的按鈕
      const btn = (y, label, href) => {
        g.rect(3.42, y, 1.12, 0.27, { stroke: '#fff', lw: 0.012, r: 0.06, alpha: 0.9 });
        g.text(label, 3.98, y + 0.175, { size: 0.1, weight: 700, align: 'center', spacing: 0.04, maxW: 1.0 });
        g.hot(3.42, y, 1.12, 0.27, href, label);
      };
      btn(2.5, 'GitHub ↗', 'https://github.com/Tunai-0511');
      btn(2.86, t('hero.cta2') + ' →', '#contact');
    },
  });
  flip.add(front.g);

  // 頭像:一片原色的琺瑯徽章(一般混色,不被加法刻字染色)
  const avTex = new THREE.Texture(avatar);
  avTex.colorSpace = THREE.SRGBColorSpace;
  avTex.anisotropy = 8;
  const onAvatar = () => { avTex.needsUpdate = true; };
  if (avatar.complete && avatar.naturalWidth) onAvatar(); else avatar.addEventListener('load', onAvatar);
  const av = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 0.98),
    new THREE.MeshStandardMaterial({ map: avTex, emissiveMap: avTex, emissive: new THREE.Color(0.6, 0.6, 0.6), roughness: 0.35, metalness: 0.1, transparent: true }),
  );
  av.position.set(-W / 2 + 0.26 + 0.51, H / 2 - 0.26 - 0.51, 0.028);
  front.g.add(av);

  // ---------- 背面:鈦合金上的自我介紹 + 脈衝星地圖時間線 ----------
  const back = kit.plate({
    name: 'plaque-back', w: W + 0.12, h: H + 0.12, d: 0.04, mat: kit.M.titan, ch: 1, res: 560, intensity: 1.3, white: 0.45, bolts: true,
    back: {
      ch: 1, res: 560, white: 0.45, intensity: 1.3,
      draw(g) {
        const ox = 0.06, oy = 0.06;
        g.text('01 · ' + t('about.eyebrow'), ox + 0.26, oy + 0.36, { font: 'mono', size: 0.08, spacing: 0.12, alpha: 0.75 });
        g.wrap(t('about.title'), ox + 0.26, oy + 0.66, 2.6, { font: 'serif', size: 0.19, weight: 700, lh: 1.25 });
        const y1 = g.wrap(t('about.p1'), ox + 0.26, oy + 1.2, 2.55, { font: 'body', size: 0.088, lh: 1.65, alpha: 0.92 });
        g.wrap(t('about.p2'), ox + 0.26, y1 + 0.1, 2.55, { font: 'body', size: 0.088, lh: 1.65, alpha: 0.92 });
        // 時間線:脈衝星地圖
        const fx = ox + 3.02, fy = oy + 3.0;
        g.circle(fx, fy, 0.035, { fill: '#fff', alpha: 0.85 });
        const n = TIMELINE.length;
        TIMELINE.forEach((L, i) => {
          const ly = oy + 0.5 + i * ((2.35) / Math.max(1, n - 1)) * 0.92;
          const lx = ox + 3.3;
          g.line(fx, fy, lx - 0.06, ly - 0.03, { alpha: 0.5, lw: 0.008 });
          // 刻痕:年份的二進位
          const yr = parseInt(String(t(L.date)).match(/\d{4}/)?.[0] || '2026', 10);
          const dx = lx - 0.06 - fx, dy = ly - 0.03 - fy, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
          for (let k = 0; k < 11; k++) {
            if (!((yr >> k) & 1)) continue;
            const s = 0.12 + k * 0.07;
            g.line(fx + ux * s - uy * 0.025, fy + uy * s + ux * 0.025, fx + ux * s + uy * 0.025, fy + uy * s - ux * 0.025, { alpha: 0.5, lw: 0.008 });
          }
          if (L.major) {
            g.text(t(L.date), lx, ly, { font: 'mono', size: 0.062, spacing: 0.08, weight: 700 });
            g.text(t(L.school), lx, ly + 0.15, { font: 'serif', size: 0.1, weight: 700, maxW: 1.5 });
            g.wrap(t(L.dept), lx, ly + 0.27, 1.5, { font: 'body', size: 0.064, alpha: 0.88, maxLines: 2 });
          } else {
            g.text(t(L.date), lx, ly, { font: 'mono', size: 0.062, spacing: 0.08, weight: 700 });
            g.wrap(t(L.text), lx, ly + 0.13, 1.5, { font: 'body', size: 0.07, alpha: 0.9, maxLines: 2 });
          }
        });
      },
    },
  });
  back.g.position.z = -0.07;
  flip.add(back.g);
  // 兩片之間的支柱
  const standoff = new THREE.CylinderGeometry(0.035, 0.035, 0.07, 10);
  standoff.rotateX(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const m = new THREE.Mesh(standoff, kit.M.frame);
    m.position.set(sx * (W / 2 - 0.12), sy * (H / 2 - 0.12), -0.035);
    flip.add(m);
  }

  // ---------- 鏡頭 ----------
  pivot.updateMatrixWorld(true);
  const local = (x, y, z = 0) => new THREE.Vector3(x, y, z).applyMatrix4(pivot.matrixWorld);
  // 開場:看向銘板與黑洞之間
  const T0 = C0.clone().addScaledVector(toHole, 9).addScaledVector(side, -0.95).addScaledVector(up, 0.05);
  // 翻面之後背面朝向鏡頭:左欄(自我介紹)在 pivot 的 -x,右欄(脈衝星地圖時間線)在 +x
  const keys = [
    camKey('hero', C0, T0),
    camKey('about.cut', local(0.5, 0.25, 6.8), local(0.8, 0, 0)),
    camKey('about.read', local(-0.75, 0.1, 5.3), local(-0.7, 0.05, 0)),
    camKey('about.layers', local(1.45, -0.08, 5.4), local(1.3, -0.08, 0)),
  ];

  function update(st) {
    const f = st.p('hero', 'about.cut');
    flip.rotation.y = Math.PI * f;
    // 翻面時微微抬一下,像在失重中被輕推
    flip.position.y = Math.sin(Math.PI * f) * 0.15;
    // 開場時慢慢飄進來
    const intro = Math.min(1, st.tLoad / 2.4);
    pivot.position.copy(center).addScaledVector(toHole, (1 - intro * intro * (3 - 2 * intro)) * -1.5);
    void U;
  }

  return { root, keys, update, hotMeshes: [front.b.mesh] };
}
