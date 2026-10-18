// 03 AI 工作流 —— 軌道上的衛星。
//
// 每天在用的 AI 是一顆顆衛星,排在吸積盤外緣(r ≈ 19 r_s)的同一條軌道上。
// 鏡頭跟著它們繞黑洞走半圈:每一站看兩顆,背景裡的吸積盤一直在變 —— 迎面而來的那一側亮、遠離的那一側暗(都卜勒集束),
// 繞到另一邊就整個反過來。衛星本體是金色隔熱毯包的匯流排、兩片太陽能板、一面高增益天線;
// 正面掛一塊鈦合金面板:logo、名字、用法。最前面那顆中繼衛星掛著章節標題。
//
// 多一個 AI 工具 → 軌道上多一顆衛星、鏡頭多一站(src/data/world.js 的 AI_TOOLS)。

import * as THREE from 'three';
import { t } from '../../../i18n.js';
import { BRAND } from '../../../brand-icons.js';
import { AI_TOOLS } from '../../../../data/world.js';
import * as P from '../../parts.js';
import { sph, camKey, facing, screenAt } from '../kit.js';

const R = 19, Y = 1.4;
const AZ0 = 112, STEP = 40;  // 第一組的方位角、每組相隔(相隔越大,轉場時視線轉得越多)
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

// 一顆衛星(本地座標:+z 是面板朝外的方向,y 向上)
function satellite(kit, { big = false } = {}) {
  const { M } = kit;
  const g = new THREE.Group();
  const s = big ? 1.5 : 1;
  P.mesh(P.rbox(1.0 * s, 1.0 * s, 1.2 * s, 0.06), M.foil, 0, 0, -0.75 * s, g);
  P.mesh(P.rbox(1.08 * s, 0.06, 1.28 * s, 0.02), M.titan, 0, 0.53 * s, -0.75 * s, g);
  P.mesh(P.rbox(1.08 * s, 0.06, 1.28 * s, 0.02), M.titan, 0, -0.53 * s, -0.75 * s, g);
  // 太陽能板:兩側各兩片,接在桁架上
  for (const side of [-1, 1]) {
    const boom = P.mesh(P.cylG(0.025, 0.7 * s, 8), M.frame, side * 0.85 * s, 0, -0.75 * s, g);
    boom.rotation.z = Math.PI / 2;
    for (let k = 0; k < 2; k++) {
      const x = side * (1.25 + k * 1.2) * s;
      P.mesh(P.boxG(1.12 * s, 0.025, 0.78 * s), M.solar, x, 0, -0.75 * s, g).rotation.x = -0.35;
      P.mesh(P.boxG(1.16 * s, 0.03, 0.04), M.frame, x, 0.13 * s, -0.75 * s - 0.37 * s, g);
    }
  }
  // 高增益天線:淺淺的拋物面
  const pts = [];
  for (let i = 0; i <= 12; i++) { const r = (i / 12) * 0.6 * s; pts.push(new THREE.Vector2(r, (r * r) / (1.6 * s))); }
  const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), M.paint);
  dish.material.side = THREE.DoubleSide;
  dish.position.set(0, 0.62 * s, -1.05 * s);
  dish.rotation.x = -0.9;
  g.add(dish);
  const feed = P.mesh(P.cylG(0.015, 0.4 * s, 6), M.frame, 0, 0.8 * s, -0.9 * s, g);
  feed.rotation.x = -0.9;
  // 推進器
  for (const [x, y] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) {
    const n = P.mesh(new THREE.ConeGeometry(0.06 * s, 0.14 * s, 10, 1, true), M.frame, x * s, y * s, -1.42 * s, g);
    n.rotation.x = -Math.PI / 2;
  }
  // 支架:面板接到本體
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const st = P.mesh(P.cylG(0.02, 0.5, 6), M.frame, sx * 0.32 * s, sy * 0.32 * s, -0.12, g);
    st.rotation.x = Math.PI / 2;
  }
  return g;
}

export function buildAgents(ctx) {
  const { kit, assets, recolor } = ctx;
  const root = new THREE.Group();
  root.name = 'agents';
  const TOOLS = AI_TOOLS.map((T, i) => ({ ...T, i }));
  const NT = TOOLS.length;
  const pairs = [];
  for (let i = 0; i < NT; i += 2) pairs.push(TOOLS.slice(i, i + 2));

  // 每一組:鏡頭的位置與看的方向;兩顆衛星在鏡頭前排開
  const stops = pairs.map((G, gi) => {
    const az = AZ0 + gi * STEP;
    const C = sph(27.5, az - 13, 9);
    const mid = sph(R, az, 0).add(new THREE.Vector3(0, Y, 0));
    const T = mid.clone().lerp(new THREE.Vector3(0, 0, 0), 0.25);
    return { G, az, C, T, mid };
  });

  const sats = TOOLS.map((T) => {
    const gi = Math.floor(T.i / 2), j = T.i % 2;
    const S = stops[gi];
    const n = S.G.length;
    // 兩顆排在畫面右側三分之二(黑洞留在左邊),一高一低
    const pos = screenAt(S.C, S.T, n > 1 ? (j ? 0.6 : 0.1) : 0.35, n > 1 ? (j ? -0.2 : 0.16) : 0, 9.5);
    const g = new THREE.Group();
    g.position.copy(pos);
    g.quaternion.copy(facing(S.C, pos));
    g.scale.setScalar(0.72);
    root.add(g);
    const body = satellite(kit);
    body.scale.setScalar(0.75);
    body.position.z = -0.2;
    g.add(body);
    const col = new THREE.Color();
    const plate = kit.plate({
      name: 'ai-' + T.id, w: 3.9, h: 2.5, d: 0.04, mat: kit.M.titan, ch: 3, res: 260, intensity: 1.3, white: 0.45,
      draw(gg) {
        gg.text(String(T.i + 1).padStart(2, '0') + ' · AGENT', 3.65, 0.36, { font: 'mono', size: 0.11, alpha: 0.55, spacing: 0.12, align: 'right' });
        gg.text(T.name, 1.2, 0.86, { font: 'serif', size: 0.4, weight: 700, maxW: 2.5 });
        gg.rule(0.25, 1.18, 3.4, { alpha: 0.35, t: 0.012 });
        gg.wrap(t(T.desc), 0.25, 1.48, 3.4, { font: 'body', size: 0.15, lh: 1.55, alpha: 0.95, maxLines: 4 });
      },
    });
    plate.g.scale.setScalar(1);
    g.add(plate.g);
    recolor.push(() => col.set(T.color).lerp(new THREE.Color(1, 1, 1), 0.45));
    plate.b.mat.uniforms.uColor.value = col;
    // logo:原色,一般混色(不被刻字的加法染色)
    const logoImg = T.logo.brand ? assets.svg(BRAND[T.logo.brand], T.logo.mono) : assets.img(T.logo.img);
    const lt = new THREE.Texture(logoImg);
    lt.colorSpace = THREE.SRGBColorSpace;
    const upd = () => { lt.needsUpdate = true; };
    if (logoImg?.complete && logoImg.naturalWidth) upd(); else logoImg?.addEventListener('load', upd);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false, color: new THREE.Color(1.1, 1.1, 1.1) }));
    logo.position.set(-3.9 / 2 + 0.25 + 0.36, 2.5 / 2 - 0.2 - 0.36, 0.03);
    logo.renderOrder = 6;
    plate.g.add(logo);
    // 狀態燈:慢慢閃
    const ledCol = new THREE.Color();
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: ledCol }));
    led.position.set(1.85, -1.12, 0.04);
    plate.g.add(led);
    recolor.push(() => ledCol.set(T.color).multiplyScalar(3));
    return { T, g, body, plate, led, gi, ledCol };
  });

  // ---------- 中繼衛星 + 章節標題 ----------
  const relayAz = AZ0 - 40;
  const Cp = sph(31, relayAz - 14, 15);
  const relayPos = sph(R + 2, relayAz, 0).add(new THREE.Vector3(0, Y + 1.5, 0));
  const Tp = relayPos.clone().lerp(new THREE.Vector3(), 0.32);
  const relay = new THREE.Group();
  screenAt(Cp, Tp, -0.3, -0.12, 9.5, relay.position);
  relay.quaternion.copy(facing(Cp, Tp));
  relay.scale.setScalar(0.62);
  root.add(relay);
  const rb = satellite(kit, { big: true });
  rb.position.z = -0.4;
  relay.add(rb);
  const title = kit.plate({
    name: 'ai-title', w: 6.6, h: 2.6, d: 0.05, mat: kit.M.titan, ch: 3, res: 160, intensity: 1.3, white: 0.4,
    draw(g) {
      g.text('03 · ' + t('ai.eyebrow'), 0.35, 0.58, { font: 'mono', size: 0.24, spacing: 0.14, alpha: 0.75 });
      g.text(t('ai.title'), 0.35, 1.35, { font: 'serif', size: 0.62, weight: 700, maxW: 5.9 });
      g.wrap(t('ai.sub'), 0.35, 1.84, 5.9, { font: 'body', size: 0.2, lh: 1.5, alpha: 0.85, maxLines: 2 });
    },
  });
  relay.add(title.g);
  title.g.position.z = 0.1;

  // 軌道:一條細細的光環,標出衛星在哪一圈
  const orbit = kit.orbitLine({ a: R, ch: 3, opacity: 0.22, seg: 384 });
  orbit.position.y = Y;
  root.add(orbit);

  const keys = [camKey('ai.plaza', Cp, Tp, { tools: [], fog: [4, 30] })];
  stops.forEach((S, gi) => keys.push(camKey('ai.' + gi, S.C, S.T, { tools: S.G.map((T) => T.i), fog: [4, 30] })));

  // 這一章前後一段距離內衛星才在(進出場由引擎處理:不在畫面裡就直接換,在畫面裡就長出來 / 收起來)
  const want = (st) => st.s > st.first('ai') - 2.3 && st.s < st.last('ai') + 1.7;
  for (const S of sats) S.y0 = S.g.position.y;
  function update(st) {
    const k0 = st.first('ai'), k1 = st.last('ai');
    // 軌道光環淡入淡出
    orbit.material.opacity = 0.22 * smooth(k0 - 2.3, k0 - 1.1, st.s) * (1 - smooth(k1 + 0.5, k1 + 1.7, st.s));
    orbit.visible = orbit.material.opacity > 0.002;
    if (!want(st)) return;
    for (const S of sats) {
      // 在軌道上微微漂、慢慢轉(失重)
      S.body.rotation.z = Math.sin(st.time * 0.3 + S.T.i) * 0.05;
      S.g.position.y = S.y0 + Math.sin(st.time * 0.5 + S.T.i * 1.7) * 0.06;
      const r = 1 - smooth(0.4, 0.85, Math.abs(st.s - (k0 + 1 + S.gi)));
      S.plate.b.mat.uniforms.uReveal.value = smooth(0.15, 1, r);
      S.led.material.color.copy(S.ledCol).multiplyScalar(0.4 + 0.6 * (0.5 + 0.5 * Math.sin(st.time * 2.4 + S.T.i)));
    }
    title.b.mat.uniforms.uReveal.value = smooth(0.15, 1, 1 - smooth(0.4, 0.85, Math.abs(st.s - k0)));
  }

  return { root, keys, update, want, units: [...sats.map((S) => S.g), relay], hotMeshes: [] };
}
