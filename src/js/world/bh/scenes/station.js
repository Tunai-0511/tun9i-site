// 04 作品 —— 太空站。
//
// 一座環形太空站停在吸積盤上方(r ≈ 14 r_s):中央樞紐刻著章節標題,環慢慢轉(人工重力)。
// 精選專案是右邊那塊最大的面板(名字、網址、四個數字、兩顆可以點的按鈕),左邊是它的規格書;
// 環的下方掛著四塊小面板 = 其他 repo(即時從 GitHub 抓);上方的太陽能板就是貢獻熱力圖 ——
// 53 週 × 7 天,每一格電池的亮度 = 那一天的貢獻數。
//
// 座標:站的本地座標,x 向右、y 向上、+z 朝著總覽鏡頭。

import * as THREE from 'three';
import { t } from '../../../i18n.js';
import { repoCards } from '../../../github.js';
import { getHeat } from '../../../heatmap.js';
import { FEATURED, GITHUB } from '../../../../data/world.js';
import * as P from '../../parts.js';
import { sph, camKey, facing } from '../kit.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const m4 = new THREE.Matrix4();

export function buildStation(ctx) {
  const { kit, recolor } = ctx;
  const { M } = kit;
  const root = new THREE.Group();
  root.name = 'station';

  const S = sph(14, 262, 17);
  const Cb = sph(24, 246, 24);
  const st = new THREE.Group();
  st.position.copy(S);
  st.quaternion.copy(facing(Cb, S));
  root.add(st);

  // ---------- 站體 ----------
  const RING = 3.4;
  const spin = new THREE.Group();
  st.add(spin);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RING, 0.2, 16, 128), M.titan);
  spin.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(RING, 0.06, 8, 128), M.frame);
  ring2.position.z = 0.26;
  spin.add(ring2);
  // 十二個居住艙(同一種,實例化)
  const modGeo = P.rbox(0.82, 0.4, 0.5, 0.06);
  const mods = new THREE.InstancedMesh(modGeo, M.foil, 12);
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.set(Math.cos(a) * RING, Math.sin(a) * RING, 0);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a + Math.PI / 2);
    m4.compose(p, q, sc);
    mods.setMatrixAt(i, m4);
  }
  spin.add(mods);
  // 舷窗:每個艙一排小燈
  const winCol = new THREE.Color();
  const wins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: winCol }), 12 * 5);
  for (let i = 0; i < 12; i++) for (let k = 0; k < 5; k++) {
    const a = (i / 12) * Math.PI * 2 + (k - 2) * 0.035;
    p.set(Math.cos(a) * RING, Math.sin(a) * RING, 0.32);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a + Math.PI / 2);
    m4.compose(p, q, sc);
    wins.setMatrixAt(i * 5 + k, m4);
  }
  spin.add(wins);
  // 輪輻 + 樞紐
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const sp = P.mesh(P.cylG(0.07, RING - 0.8, 10), M.frame, Math.cos(a) * (RING / 2 + 0.4), Math.sin(a) * (RING / 2 + 0.4), 0, spin);
    sp.rotation.z = a - Math.PI / 2;
  }
  const hub = P.mesh(P.cylG(0.8, 1.0, 32), M.foil, 0, 0, -0.1, st);
  hub.rotation.x = Math.PI / 2;
  P.mesh(P.cylG(0.86, 0.08, 32), M.titan, 0, 0, 0.42, st).rotation.x = Math.PI / 2;
  recolor.push(() => kit.eraSoft(4, 0.5, winCol).multiplyScalar(2.2));

  // ---------- 面板 ----------
  const blocks = [];
  const mount = (pl, x, y, z = 0.5) => { pl.g.position.set(x, y, z); st.add(pl.g); blocks.push(pl); return pl; };
  // 從站體拉一根桁架到面板背後
  const truss = (x0, y0, x1, y1) => {
    const a = new THREE.Vector3(x0, y0, 0), b = new THREE.Vector3(x1, y1, 0.3);
    const L = a.distanceTo(b);
    const m = P.mesh(P.cylG(0.045, L, 8), M.frame, (x0 + x1) / 2, (y0 + y1) / 2, 0.15, st);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  };

  const title = mount(kit.plate({
    name: 'proj-title', w: 3.3, h: 1.25, d: 0.04, mat: M.titan, ch: 4, res: 300, intensity: 1.3, white: 0.4,
    draw(g) {
      g.text('04 · ' + t('proj.eyebrow') + ' · STATION', 0.18, 0.3, { font: 'mono', size: 0.1, spacing: 0.14, alpha: 0.75, maxW: 3 });
      g.text(t('proj.title'), 0.18, 0.72, { font: 'serif', size: 0.26, weight: 700, maxW: 2.95 });
      g.text(t('proj.sub'), 0.18, 1.02, { font: 'body', size: 0.11, alpha: 0.75, maxW: 2.95 });
    },
  }), 0, 0, 0.62);

  const feat = mount(kit.plate({
    name: 'feat', w: 3.2, h: 3.1, d: 0.05, mat: M.titan, ch: 4, res: 280, intensity: 1.35, white: 0.35, edge: true,
    draw(g) {
      g.text(document.documentElement.dataset.lang === 'en' ? 'FEATURED' : t('feat.tag') + ' · FEATURED', 0.25, 0.36, { font: 'mono', size: 0.12, spacing: 0.14, alpha: 0.7, maxW: 2.8 });
      g.wrap(FEATURED.name, 0.25, 0.86, 2.8, { font: 'serif', size: 0.36, weight: 700, lh: 1.15 });
      g.text(FEATURED.host, 0.25, 1.22, { font: 'mono', size: 0.13, alpha: 0.85 });
      FEATURED.stats.forEach(([a, b], i) => {
        const x = 0.25 + (i % 2) * 1.45, y = 1.68 + Math.floor(i / 2) * 0.52;
        g.text(a, x, y, { font: 'serif', size: 0.27, weight: 700 });
        g.text(t(b), x, y + 0.18, { font: 'body', size: 0.1, alpha: 0.72, maxW: 1.3 });
      });
      const btn = (x, w, label, href) => {
        g.rect(x, 2.62, w, 0.32, { stroke: '#fff', lw: 0.014, r: 0.16, alpha: 0.9 });
        g.text(label, x + w / 2, 2.83, { size: 0.12, weight: 700, align: 'center', spacing: 0.04, maxW: w - 0.14 });
        g.hot(x, 2.62, w, 0.32, href, label);
      };
      btn(0.25, 1.32, t('feat.try') + ' ↗', FEATURED.live);
      btn(1.65, 1.32, t('feat.src') + ' ↗', FEATURED.source);
    },
  }), 5.6, 0.5, 0.4);
  truss(RING + 0.2, 0.2, 4.0, 0.4);

  const sheet = mount(kit.plate({
    name: 'feat-sheet', w: 4.6, h: 3.1, d: 0.05, mat: M.titan, ch: 4, res: 230, intensity: 1.2, white: 0.5,
    draw(g) {
      g.text('DATASHEET · ' + FEATURED.name, 0.25, 0.34, { font: 'mono', size: 0.11, spacing: 0.12, alpha: 0.6, maxW: 4.1 });
      const y1 = g.wrap(t(FEATURED.lede), 0.25, 0.68, 4.1, { font: 'body', size: 0.13, lh: 1.55, maxLines: 4 });
      g.rule(0.25, y1 - 0.06, 4.1, { alpha: 0.3, t: 0.01 });
      const n = FEATURED.notes.length, cw = 4.1 / n;
      FEATURED.notes.forEach(([a, b], i) => {
        const x = 0.25 + i * cw;
        const yy = g.wrap(t(a), x, y1 + 0.22, cw - 0.2, { font: 'sans', size: 0.13, weight: 700, lh: 1.3, maxLines: 2 });
        g.wrap(t(b), x, yy + 0.06, cw - 0.2, { font: 'body', size: 0.1, lh: 1.55, alpha: 0.82, maxLines: 6 });
      });
    },
  }), -6.1, 0.4, 0.4);
  truss(-RING - 0.2, 0.1, -3.8, 0.4);

  // 其他 repo:環下方四塊小面板
  const NREPO = GITHUB.maxChips;
  const repos = Array.from({ length: NREPO }, (_, i) => mount(kit.plate({
    name: 'repo-' + i, w: 2.3, h: 1.75, d: 0.04, mat: M.titan, ch: 4.2, res: 300, intensity: 1.3, white: 0.4,
    draw(g) {
      const r = repoCards()?.[i];
      if (!r) { g.text('—', 1.15, 0.95, { font: 'mono', size: 0.2, align: 'center', alpha: 0.4 }); return; }
      g.wrap(r.title, 0.16, 0.36, 2.0, { font: 'sans', size: 0.17, weight: 700, lh: 1.15, maxLines: 2 });
      g.text([r.language, r.date].filter(Boolean).join(' · ') + (r.stars ? '  ★ ' + r.stars : ''), 0.16, 0.78, { font: 'mono', size: 0.085, alpha: 0.7, maxW: 2.0 });
      g.wrap(r.desc, 0.16, 1.0, 2.0, { font: 'body', size: 0.085, lh: 1.5, alpha: 0.82, maxLines: r.live ? 3 : 4 });
      g.hot(0, 0, 2.3, 1.3, r.url, r.title);
      if (r.live) {
        const host = new URL(r.live).hostname;
        g.text('LIVE · ' + host + ' ↗', 0.16, 1.62, { font: 'mono', size: 0.085, weight: 700, maxW: 2.0 });
        g.hot(0, 1.42, 2.3, 0.33, r.live, host);
      }
    },
  }), 0, -5.1, 0.3));
  const layoutRepos = () => {
    const n = Math.min(NREPO, repoCards()?.length || NREPO);
    const span = 2.5, x0 = -((n - 1) * span) / 2;
    repos.forEach((R, i) => { R.g.visible = i < n; R.g.position.set(x0 + i * span, -5.15, 0.3); R.b.redraw(); });
  };
  layoutRepos();
  addEventListener('repos:data', layoutRepos);
  addEventListener('langchange', () => requestAnimationFrame(layoutRepos));
  truss(0, -RING - 0.25, 0, -4.2);
  const repoBar = P.mesh(P.boxG(10.2, 0.08, 0.08), M.frame, 0, -4.2, 0.2, st);
  void repoBar;

  // 熱力圖:太陽能板(53 × 7 格,亮度 = 那一天的貢獻數)
  const HC = 53, HR = 7, HP = 0.15;
  const solarW = HC * HP + 0.3, solarH = HR * HP + 0.3;
  const solar = new THREE.Group();
  solar.position.set(0.9, 5.2, 0.2);
  st.add(solar);
  P.mesh(P.rbox(solarW, solarH, 0.06, 0.03), M.dark, 0, 0, 0, solar);
  P.mesh(P.boxG(solarW + 0.1, 0.05, 0.08), M.frame, 0, solarH / 2, 0.02, solar);
  P.mesh(P.boxG(solarW + 0.1, 0.05, 0.08), M.frame, 0, -solarH / 2, 0.02, solar);
  truss(0, RING + 0.25, 0.9, 5.2 - solarH / 2);
  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(HP * 0.82, HP * 0.82, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff }), HC * HR);
  for (let c = 0; c < HC; c++) for (let r = 0; r < HR; r++) {
    m4.makeTranslation(-((HC - 1) * HP) / 2 + c * HP, ((HR - 1) * HP) / 2 - r * HP, 0.045);
    cells.setMatrixAt(c * HR + r, m4);
  }
  solar.add(cells);
  const level = new Float32Array(HC * HR).fill(-1);
  const heatInfo = { total: null };
  const heatLabel = mount(kit.plate({
    name: 'heat-label', w: 2.6, h: 1.2, d: 0.04, mat: M.titan, ch: 4.3, res: 300, intensity: 1.3, white: 0.35,
    draw(g) {
      g.text(t('gh.head'), 0.16, 0.34, { font: 'sans', size: 0.16, weight: 700, maxW: 2.3 });
      if (heatInfo.total != null) g.text(`${heatInfo.total} ${t('gh.total')}`, 0.16, 0.64, { font: 'mono', size: 0.12, alpha: 0.85, maxW: 2.3 });
      g.text(t('proj.more'), 0.16, 0.98, { font: 'sans', size: 0.13, weight: 700, maxW: 2.3 });
      g.hot(0, 0.78, 2.6, 0.42, GITHUB.all, t('proj.more'));
    },
  }), -4.95, 5.2, 0.3);
  const loadHeat = () => {
    const d = getHeat();
    if (!d?.contributions?.length) return;
    const days = d.contributions.slice(-HC * HR);
    const pad = HC * HR - days.length;
    for (let i = 0; i < HC * HR; i++) level[i] = i < pad ? -1 : days[i - pad].level;
    heatInfo.total = d.total?.lastYear ?? days.reduce((s, x) => s + x.count, 0);
    heatLabel.b.redraw();
  };
  addEventListener('heat:data', loadHeat);
  loadHeat();
  // 沒有貢獻的那幾天是一格普通的深藍色電池;有貢獻的亮起來,越多越亮(過了 bloom 門檻就會暈開)
  const cc = new THREE.Color(), dim = new THREE.Color(0x16223f);
  const paintCells = (time) => {
    for (let i = 0; i < HC * HR; i++) {
      const L = level[i];
      if (L <= 0) cc.copy(dim).multiplyScalar(L < 0 ? 0.45 : 1);
      else { kit.eraSoft(4.2 + L * 0.15, 0.25, cc).multiplyScalar(0.6 + L * 0.7 + 0.12 * Math.sin(time * 1.3 + i * 0.37)); }
      cells.setColorAt(i, cc);
    }
    cells.instanceColor.needsUpdate = true;
  };
  paintCells(0);

  // ---------- 鏡頭 ----------
  st.updateMatrixWorld(true);
  const W = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(st.matrixWorld);
  const keys = [
    camKey('proj.board', W(0.2, -0.4, 17.5), W(0.2, 0.0, 0), { fog: [3, 30] }),
    camKey('proj.featured', W(4.2, 0.2, 7.6), W(4.6, 0.4, 0.4), { fog: [3, 30] }),
    camKey('proj.notes', W(-5.0, 0.2, 8.4), W(-5.5, 0.35, 0.4), { fog: [3, 30] }),
    camKey('proj.repos', W(0, -4.4, 9.4), W(0, -4.9, 0.3), { fog: [3, 30] }),
    camKey('proj.heat', W(-0.7, 5.0, 12.2), W(-0.65, 4.9, 0.3), { fog: [3, 30] }),
  ];

  let lastPaint = 0;
  // 進出場交給引擎(不在畫面裡就直接換,在畫面裡就長出來 / 收起來)
  const want = (stt) => stt.s > stt.first('projects') - 2.0 && stt.s < stt.last('projects') + 1.2;
  function update(stt) {
    if (!want(stt)) return;
    spin.rotation.z = stt.time * 0.04;
    if (stt.time - lastPaint > 0.1) { lastPaint = stt.time; paintCells(stt.time); }
    // 到站的時候雷射把整座站的面板一次寫完(每一塊錯開一點),停在任何一個鏡頭時都不會有寫到一半的字
    const k0 = stt.first('projects');
    const r = (lag) => smooth(k0 - 0.85 + lag, k0 - 0.1 + lag * 0.3, stt.s);
    title.b.mat.uniforms.uReveal.value = r(0);
    feat.b.mat.uniforms.uReveal.value = r(0.08);
    sheet.b.mat.uniforms.uReveal.value = r(0.12);
    repos.forEach((R, i) => { R.b.mat.uniforms.uReveal.value = r(0.16 + i * 0.03); });
    heatLabel.b.mat.uniforms.uReveal.value = r(0.2);
  }

  return { root, keys, update, want, units: [st], hotMeshes: [feat.b.mesh, heatLabel.b.mesh, ...repos.map((R) => R.b.mesh)] };
}
