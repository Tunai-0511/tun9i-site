// 《事件視界》引擎 —— 整個網站是一趟掉進黑洞的旅程,捲動就是往下掉。
//
// 捲動位置 = 時間軸。時間軸上有一串關鍵鏡頭(KEYS),每個鏡頭屬於一個 HTML 區塊(章節)。
// 鏡頭沿著一條往內收的螺旋走:40 r_s 外的銘板 → S 星群 → 軌道上的衛星 → 太空站 → 墜落的行星 →
// 光子球 → 穿過視界。全部在同一個座標系(r_s = 1、黑洞在原點),距離用對數內插。
//
// 每一幀分兩層畫:
//   1) lens.js:每個像素沿彎曲時空追光(星空、吸積盤、光子環),畫在一張比較小的畫布上
//   2) three.js 場景:刻字的硬體(銘板、衛星、太空站…)疊在上面,再一起過 bloom、暗角、色調映射
// 黑洞的陰影用一顆不畫顏色、只寫深度的球擋住它後面的物件。
//
// 網站的內容不是字卡:它們用 etch.js 刻在物件上,可以點的就是連結。

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { currentPalette } from '../palettes.js';
import { era, eraSoft, paletteColors, setPaletteColors, STOPS } from '../era.js';
import { createEtcher, createAssets } from '../etch.js';
import { makeWarp } from '../particles.js';
import { captionFor } from '../captions.js';
import { createLens, MAX_WAVES } from './lens.js';
import { makeKit } from './kit.js';
import { buildPlaque } from './scenes/plaque.js';
import { buildStars } from './scenes/stars.js';
import { buildAgents } from './scenes/agents.js';
import { buildStation } from './scenes/station.js';
import { buildPlanets } from './scenes/planets.js';
import { buildConsole } from './scenes/console.js';
import { buildHorizon } from './scenes/horizon.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

// 紀錄片式 HUD:左上章節;右上的大字是鏡頭離黑洞多遠(以 r_s 計),底下是那裡的時鐘走多快
const HUD = [
  { n: '00', zh: '遠方', en: 'FAR FIELD' },
  { n: '01', zh: '銘板', en: 'THE PLAQUE' },
  { n: '02', zh: '歷程', en: 'S-STARS' },
  { n: '03', zh: 'AI 工作流', en: 'IN ORBIT' },
  { n: '04', zh: '作品', en: 'THE STATION' },
  { n: '05', zh: '下班之後', en: 'AFTER HOURS' },
  { n: '06', zh: '配備', en: 'PHOTON SPHERE' },
  { n: '07', zh: '訊號送出', en: 'EVENT HORIZON' },
];
const CLOCK = { zh: '時鐘', en: 'CLOCK', ja: '時計' };
const INSIDE = { zh: '視界之內', en: 'INSIDE THE HORIZON', ja: '視界の内側' };

// 暗角 + 底片顆粒 + 轉場時一點色散
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.5 }, uGrain: { value: 0.03 }, uAb: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uAb; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      vec2 off = d * uAb * 0.012;
      vec4 c = texture2D(tDiffuse, vUv);
      c.r = texture2D(tDiffuse, vUv + off).r;
      c.b = texture2D(tDiffuse, vUv - off).b;
      c.rgb *= mix(1.0 - uVig, 1.0, 1.0 - smoothstep(0.2, 0.85, length(d * vec2(1.2, 1.0)))); // edge0 < edge1
      c.rgb += (h(vUv * 1733.0 + fract(uTime) * 91.0) - 0.5) * uGrain;
      gl_FragColor = c;
    }`,
};

export function mountWorld(stage, { hud = null } = {}) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mobile = coarse || innerWidth <= 860;
  const debug = /[?&]worlddebug\b/.test(location.search);

  // ---------- renderer + 後製 ----------
  // 除錯模式保留畫面緩衝(截圖 QA 用 toDataURL 讀得到最後一幀)
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: debug });
  const PR = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  renderer.setPixelRatio(PR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(0x000000, 1);
  const canvas = renderer.domElement;
  canvas.className = 'world-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 20, 90);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 1000);
  scene.add(camera);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(PR);
  composer.addPass(new RenderPass(scene, camera));
  // 門檻偏高:吸積盤最亮的內緣與刻字會暈開,星空與金屬反光不會
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), mobile ? 0.4 : 0.45, 0.42, 0.9);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  // ---------- 黑洞(背景那一層)----------
  const lens = createLens({ mobile });
  scene.add(lens.bg);
  // 陰影擋板:只寫深度。遠處看,被吞掉的光線的衝擊參數 < 3√3/2 r_s,所以陰影看起來是半徑 ≈ 2.6 的球
  const occluder = new THREE.Mesh(new THREE.SphereGeometry(2.6, 48, 24), new THREE.MeshBasicMaterial({ colorWrite: false }));
  occluder.renderOrder = -999;
  scene.add(occluder);

  // ---------- 光 ----------
  // 主光:從鏡頭左上方(讓刻字的那一面看得到材質);吸積盤光:從黑洞那邊打過來的暖光(物件的輪廓)
  scene.add(new THREE.AmbientLight(0x1c1a24, 0.55));
  const key = new THREE.DirectionalLight(0xf2eee8, 1.15);
  scene.add(key, key.target);
  const diskLight = new THREE.PointLight(0xffb35c, 2.2, 0, 0);
  scene.add(diskLight);
  const cursorLight = new THREE.PointLight(0xffe6c4, 0, 1, 0);
  scene.add(cursorLight);

  // ---------- 色票 ----------
  setPaletteColors(paletteColors(currentPalette()));
  const recolor = [];
  recolor.push(() => {
    STOPS.forEach((c, i) => lens.U.uRamp.value[i].copy(c));
    era(2.5, diskLight.color).lerp(new THREE.Color(1, 1, 1), 0.25);
  });

  // ---------- 刻字 + 資產 ----------
  const etch = createEtcher({ renderer, mobile });
  let redrawQ = 0;
  const assets = createAssets(() => { if (!redrawQ) redrawQ = requestAnimationFrame(() => { redrawQ = 0; etch.redrawAll(); }); });

  // ---------- 場景 ----------
  const U = { uTime: { value: 0 } };
  const ctx = { mobile, etch, assets, recolor, U, renderer, lens };
  ctx.kit = makeKit(ctx);
  const buildMs = {};
  const timed = (name, fn) => { const t0 = performance.now(); const r = fn(); buildMs[name] = +(performance.now() - t0).toFixed(1); return r; };
  const plaque = timed('plaque', () => buildPlaque(ctx));
  const stars = timed('stars', () => buildStars(ctx));
  const agents = timed('agents', () => buildAgents(ctx));
  const station = timed('station', () => buildStation(ctx));
  const planets = timed('planets', () => buildPlanets(ctx));
  const consoleS = timed('console', () => buildConsole(ctx));
  const horizon = timed('horizon', () => buildHorizon(ctx));
  const scenes = [plaque, stars, agents, station, planets, consoleS, horizon];
  for (const s of scenes) scene.add(s.root);
  let hotMeshes = [];
  const refreshHot = () => { hotMeshes = scenes.flatMap((s) => s.hotMeshes || []); };
  refreshHot();

  // ---------- 出場 / 退場 ----------
  // 每個場景交出一串「單位」(衛星、太空站、行星…)與一個 want(st):這一刻它該不該在。
  // 要換狀態時,單位如果不在畫面裡就直接換;在畫面裡的話,用半秒長出來 / 收起來 —— 不會在鏡頭前憑空跳出來。
  const frustum = new THREE.Frustum(), projView = new THREE.Matrix4();
  const presence = [];
  for (const sc of scenes) for (const u of sc.units || []) {
    u.updateMatrixWorld(true);
    const sph = new THREE.Box3().setFromObject(u).getBoundingSphere(new THREE.Sphere());
    presence.push({ sc, u, sph, base: u.scale.clone(), k: 1 });
  }
  function stepPresence(dt, instant = false) {
    projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projView);
    for (const P of presence) {
      const want = P.sc.want(frameState) ? 1 : 0;
      if (P.k === want) continue;
      if (instant || !frustum.intersectsSphere(P.sph)) P.k = want;
      else P.k = clamp(P.k + Math.sign(want - P.k) * dt * 1.9);
      const e = P.k * P.k * (3 - 2 * P.k);
      P.u.visible = P.k > 0.002;
      P.u.scale.copy(P.base).multiplyScalar(Math.max(e, 0.001));
    }
  }

  // ---------- 關鍵鏡頭 ----------
  // T:看哪裡;O:從 T 往哪個方向、多遠(r_s)。ch:章節(HUD 與色溫);id:對應的 HTML 區塊
  const KEYS = [
    ...plaque.keys.map((k) => ({ ...k, id: k.name === 'hero' ? 'hero' : 'about', ch: k.name === 'hero' ? 0 : 1 })),
    ...stars.keys.map((k) => ({ ...k, id: 'journey', ch: 2 })),
    ...agents.keys.map((k) => ({ ...k, id: 'ai', ch: 3 })),
    ...station.keys.map((k) => ({ ...k, id: 'projects', ch: 4 })),
    ...planets.keys.map((k) => ({ ...k, id: 'interests', ch: 5 })),
    ...consoleS.keys.map((k) => ({ ...k, id: 'setup', ch: 6 })),
    ...horizon.keys.map((k) => ({ ...k, id: 'contact', ch: 7 })),
  ];
  const KI = Object.fromEntries(KEYS.map((k, i) => [k.name, i]));
  const FIRST = {}, LAST = {};
  KEYS.forEach((k, i) => { if (FIRST[k.id] == null) FIRST[k.id] = i; LAST[k.id] = i; });
  const kIdx = (name) => { const i = KI[name]; if (i == null) throw new Error('[world] no key ' + name); return i; };

  // ---------- 捲動 → s ----------
  // 捲動距離跟著鏡頭的運動量分配:視線轉得多、移得遠的那一段轉場,給它比較長的捲動跑道。
  // 否則一格滾輪在大轉場的中段會把鏡頭甩十幾度,看起來很生硬。
  // 每一段 i → i+1 的權重 w(1 = 原本的一拍 88svh);每個鏡頭左右各分到相鄰兩段的一半。
  const SPAN = KEYS.slice(0, -1).map((a, i) => {
    const b = KEYS[i + 1];
    const da = a.O.clone().negate().normalize(), db = b.O.clone().negate().normalize();
    const ang = Math.acos(clamp(da.dot(db), -1, 1));
    const dlog = Math.abs(Math.log(b.O.length() / a.O.length()));
    const trans = a.T.clone().add(a.O).distanceTo(b.T.clone().add(b.O)) / ((a.O.length() + b.O.length()) / 2);
    const m = ang * 1.3 + dlog * 0.6 + Math.min(trans, 6) * 0.22;
    return clamp(0.7 + m, 0.85, 2.4);
  });
  const sideL = (i) => (i > 0 ? SPAN[i - 1] / 2 : 0.5);
  const sideR = (i) => (i < KEYS.length - 1 ? SPAN[i] / 2 : 0.5);
  const sections = [...new Set(KEYS.map((k) => k.id))];
  const beats = {}, offs = [];
  for (const id of sections) {
    let acc = 0;
    KEYS.forEach((k, i) => { if (k.id !== id) return; offs[i] = acc + sideL(i); acc += sideL(i) + sideR(i); });
    beats[id] = acc;
    document.getElementById(id)?.style.setProperty('--beats', acc.toFixed(3));
  }
  let anchors = KEYS.map((_, i) => i);
  let sTarget = 0, sView = 0, sVel = 0;
  function layout() {
    const vh = innerHeight;
    const maxYc = Math.max(1, document.documentElement.scrollHeight - vh) + vh / 2;
    anchors = KEYS.map((k, i) => {
      const el = document.getElementById(k.id);
      if (!el) return vh / 2;
      const r = el.getBoundingClientRect();
      return clamp(r.top + scrollY + (offs[i] / beats[k.id]) * r.height, vh / 2, maxYc);
    });
    for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
    anchors[anchors.length - 1] = Math.min(anchors[anchors.length - 1], maxYc);
    for (let i = anchors.length - 2; i >= 0; i--) anchors[i] = Math.min(anchors[i], anchors[i + 1] - 1);
    resize();
    readScroll();
  }
  function readScroll() {
    const y = scrollY + innerHeight / 2;
    let s = 0;
    if (y <= anchors[0]) s = 0;
    else if (y >= anchors[anchors.length - 1]) s = anchors.length - 1;
    else for (let i = 0; i < anchors.length - 1; i++) if (y < anchors[i + 1]) { s = i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]); break; }
    sTarget = s;
  }
  // 黑洞那一層的解析度(相對於 CSS 像素),由效能調節決定
  let lensQ = mobile ? 0.5 : 0.72;
  const LENS_MIN = mobile ? 0.34 : 0.4, LENS_MAX = lensQ;
  let vw = 0, vhh = 0;
  function resize(force = false) {
    const w = innerWidth, h = innerHeight;
    if (!force && coarse && vw && w === vw && Math.abs(h - vhh) < 140) return; // 手機網址列伸縮不重建
    vw = w; vhh = h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    lens.setSize(w, h, lensQ);
    camera.aspect = w / h;
    // 窄螢幕下緣有字幕:把畫面往上推,主體落在上半部
    if (w <= 860 || w / h < 0.8) camera.setViewOffset(w, h, 0, h * 0.15, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  // ---------- 游標 / 熱區 / 點擊 ----------
  const pointer = { ndc: new THREE.Vector2(), has: false, on: 0, target: 0, lastMove: -99, x: 0, y: 0, flash: 0 };
  const ray = new THREE.Raycaster();
  let hover = null;
  const INTERACTIVE = 'a,button,input,textarea,select,label,summary,[role="button"],[contenteditable],.site-nav,#term';
  function setPointer(e) {
    pointer.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    pointer.has = true; pointer.target = 1; pointer.lastMove = time;
    pickDirty = true;
  }
  let pickDirty = true, pickS = -1, pickN = 0;
  function visibleDeep(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
  function pickHot() {
    if (!pointer.has) return null;
    ray.setFromCamera(pointer.ndc, camera);
    const list = hotMeshes.filter((m) => m.userData.etch?.hits.length && visibleDeep(m));
    const hits = ray.intersectObjects(list, false);
    for (const h of hits) {
      const b = h.object.userData.etch;
      if (!h.uv) continue;
      if (b.mat.uniforms.uReveal.value < 0.95) continue;
      const r = b.hits.find((q) => h.uv.x >= q.u0 && h.uv.x <= q.u1 && h.uv.y >= q.v0 && h.uv.y <= q.v1);
      if (r) return { block: b, hit: r };
    }
    return null;
  }
  function setHover(h) {
    if (hover && (!h || hover.block !== h.block)) hover.block.mat.uniforms.uHotK.value = 0;
    hover = h;
    if (h) { h.block.mat.uniforms.uHot.value.set(h.hit.u0, h.hit.v0, h.hit.u1, h.hit.v1); h.block.mat.uniforms.uHotK.value = 1; }
    document.documentElement.classList.toggle('world-hot', !!h);
  }
  function openHit(hit) {
    const href = hit.href;
    if (href.startsWith('#')) document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    else if (href.startsWith('mailto:')) location.href = href;
    else window.open(href, '_blank', 'noopener');
  }
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') setPointer(e); }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { pointer.target = 0; setHover(null); });
  // 重力波:每次點擊發出一圈,最多同時 MAX_WAVES 圈
  let waveSlot = 0;
  const waveAt = new Array(MAX_WAVES).fill(-99);
  function emitWave(dir) {
    const i = waveSlot;
    waveSlot = (waveSlot + 1) % MAX_WAVES;
    lens.U.uWave.value[i].set(dir.x, dir.y, dir.z, time);
    lens.U.uWaveA.value[i] = 1;
    waveAt[i] = time;
  }
  let down = null;
  addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
  addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > 8 || dt > 500) return;
    if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
    if (String(getSelection() || '').length) return;
    setPointer(e);
    const h = pickHot();
    if (h) { openHit(h.hit); return; }
    pointer.flash = 1;
    ray.setFromCamera(pointer.ndc, camera);
    emitWave(ray.ray.direction);
    for (const s of scenes) s.pulse?.(ray, frameState);
  }, { passive: true });

  // ---------- 轉場光流 ----------
  const warp = makeWarp({ count: mobile ? 140 : 260 });
  camera.add(warp.lines);

  // ---------- HUD ----------
  let hudIdx = -1, hudTimer = 0, hudR = '', hudCap = '';
  function setHud(i) {
    if (!hud || i === hudIdx) return;
    hudIdx = i;
    const H = HUD[i];
    hud.root.classList.add('is-swapping');
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => {
      hud.n.textContent = H.n; hud.zh.textContent = H.zh; hud.en.textContent = H.en;
      hud.root.classList.remove('is-swapping');
    }, 220);
  }
  // 右上:鏡頭到黑洞中心的距離(r_s)與靜止觀察者的時鐘快慢 √(1 − r_s/r)
  function setReadout(r) {
    if (!hud) return;
    const lang = document.documentElement.dataset.lang || 'zh';
    const num = r >= 10 ? r.toFixed(1) : r.toFixed(2);
    const cap = r > 1 ? `r / r_s · ${CLOCK[lang] || CLOCK.en} ×${Math.sqrt(1 - 1 / r).toFixed(3)}` : INSIDE[lang] || INSIDE.en;
    if (num !== hudR) { hudR = num; hud.num.textContent = num; }
    if (cap !== hudCap) { hudCap = cap; hud.cap.textContent = cap; }
  }

  // ---------- 色票切換 ----------
  const livePal = paletteColors(currentPalette());
  const applyPalette = (P) => { setPaletteColors(P); for (const f of recolor) f(); };
  applyPalette(livePal);
  let palTween = null;
  addEventListener('palettechange', (e) => {
    const to = paletteColors(e.detail);
    palTween = { from: { stops: livePal.stops.map((c) => c.clone()), metal: livePal.metal.clone() }, to, t0: time, dur: 0.9 };
  });
  function stepPalette() {
    if (!palTween) return;
    const { from, to, t0, dur } = palTween;
    const u = clamp((time - t0) / dur), e2 = u * u * (3 - 2 * u);
    livePal.stops.forEach((c, i) => c.copy(from.stops[i]).lerp(to.stops[i], e2));
    livePal.metal.copy(from.metal).lerp(to.metal, e2);
    applyPalette(livePal);
    if (u >= 1) palTween = null;
  }
  addEventListener('langchange', () => { etch.redrawAll(); hudCap = ''; requestAnimationFrame(layout); });
  document.fonts?.ready.then(() => etch.redrawAll());
  Promise.all(['500 40px "Space Grotesk"', '700 40px "Space Grotesk"', '700 40px "Playfair Display"', '600 40px "Playfair Display"'].map((f) => document.fonts?.load(f))).then(() => etch.redrawAll()).catch(() => {});

  // ---------- 每一幀 ----------
  let time = 0, tLoad = 0;
  const look = new THREE.Vector3(), cam = new THREE.Vector3(), dir = new THREE.Vector3(), upv = new THREE.Vector3(), tmp = new THREE.Vector3();
  const plane = new THREE.Plane(), hitP = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  let lastLogD = 0, warpV = 0;
  const frameState = {};

  // 經過鏡頭時放慢、但不停死:e(f) = f − a·sin(2πf)/2π,斜率在鏡頭上是 1 − a、在兩個鏡頭中間是 1 + a。
  // (以前是前後各 10% 的停留區:那一段捲動鏡頭完全不動,開始捲時會「頓一下」,路過中間的鏡頭也會卡住再走。)
  const DETENT = 0.5;
  const holdEase = (f, a) => f - (a * Math.sin(2 * Math.PI * f)) / (2 * Math.PI);

  // ---------- 鏡頭路徑 ----------
  // 每個鏡頭的位置換成繞黑洞的球座標(ln r、方位角、仰角),用單調的 Hermite 樣條串起來:
  // 轉場是繞著黑洞走的一段弧(像軌道慢慢往內收),而且經過每個鏡頭時路徑是圓滑的,不會折一個角。
  // 看的那一點用同一個參數在直角座標上走樣條。
  // 「單調」:相鄰兩段的變化方向相反時那一點的切線歸零,切線也有上限 —— 樣條不會衝過頭(例如不會掉得比下一個鏡頭還深)。
  const azRef = []; // 方位角展開成連續的(不會在 ±180° 跳一圈)
  {
    let prev = null;
    for (const k of KEYS) {
      const P = k.T.clone().add(k.O);
      let az = (Math.atan2(P.x, P.z) * 180) / Math.PI;
      if (prev != null) az += 360 * Math.round((prev - az) / 360);
      azRef.push(az);
      prev = az;
    }
  }
  const SPH = KEYS.map(() => [0, 0, 0]);
  const VD = KEYS.map(() => new THREE.Vector3()); // 每個鏡頭的視線方向
  const VL = KEYS.map(() => 1);                    // 與看的距離
  let posePull = -1;
  function poses(pullBase) {
    if (pullBase === posePull) return; // 只跟長寬比有關:變了才重算
    posePull = pullBase;
    KEYS.forEach((k, i) => {
      const P = tmp.copy(k.T).addScaledVector(k.O, k.pull === false ? 1 : pullBase);
      const r = P.length();
      let az = (Math.atan2(P.x, P.z) * 180) / Math.PI;
      az += 360 * Math.round((azRef[i] - az) / 360);
      SPH[i][0] = Math.log(r);
      SPH[i][1] = az;
      SPH[i][2] = (Math.asin(clamp(P.y / r, -1, 1)) * 180) / Math.PI;
      VD[i].copy(k.T).sub(P);
      VL[i] = VD[i].length();
      VD[i].divideScalar(VL[i]);
    });
  }
  // 視線方向用球面內插:轉的速度均勻(看的那一點如果也走樣條,鏡頭離它很近時會在某一瞬間甩過去)
  function slerpDir(a, b, t, out) {
    const th = Math.acos(clamp(a.dot(b), -1, 1));
    if (th < 1e-4) return out.copy(a).lerp(b, t).normalize();
    const s0 = Math.sin((1 - t) * th) / Math.sin(th), s1 = Math.sin(t * th) / Math.sin(th);
    return out.set(a.x * s0 + b.x * s1, a.y * s0 + b.y * s1, a.z * s0 + b.z * s1).normalize();
  }
  // p1 → p2 之間的單調 Hermite(p0、p3 是前後的鄰居,決定經過 p1、p2 時的切線)
  function herm(p0, p1, p2, p3, t) {
    const d = p2 - p1;
    let m1 = 0, m2 = 0;
    if (d !== 0) {
      if ((p1 - p0) * d > 0) m1 = clamp((p2 - p0) * 0.5 / d, 0, 2.5) * d;
      if ((p3 - p2) * d > 0) m2 = clamp((p3 - p1) * 0.5 / d, 0, 2.5) * d;
    }
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (3 * t2 - 2 * t3) * p2 + (t3 - t2) * m2;
  }

  // 開場:從很遠的地方往前推進來(畫面像一張慢慢顯影的照片)
  const INTRO = 2.6;

  function draw(dt, simS = null) {
    const sim = simS != null;
    const s = sim ? simS : sView;
    if (!sim) stepPalette();
    U.uTime.value = time;
    const i = Math.min(KEYS.length - 2, Math.floor(s));
    const f = s - i;
    const k0 = KEYS[i], k1 = KEYS[i + 1];
    const e = holdEase(f, k0.detent ?? DETENT);
    const aspect = innerWidth / innerHeight;
    const pullBase = aspect < 1 ? Math.pow(1 / aspect, 0.9) : 1;

    if (!sim) {
      if (time - pointer.lastMove > 2.5) pointer.target = 0;
      pointer.on += (pointer.target - pointer.on) * 0.08;
      pointer.x += (pointer.ndc.x - pointer.x) * 0.06;
      pointer.y += (pointer.ndc.y - pointer.y) * 0.06;
      pointer.flash *= 0.9;
    }
    Object.assign(frameState, { s, i, e, time, dt, tLoad, k: kIdx, first: (id) => FIRST[id], last: (id) => LAST[id], p: (a, b) => smooth(kIdx(a), kIdx(b), s), pointer, camera, mobile, ray });
    for (const sc of scenes) sc.update(frameState);

    // 鏡頭:球座標的樣條 → 位置;視線:球面內插;看的距離:對數內插
    poses(pullBase);
    const ia = Math.max(0, i - 1), id2 = Math.min(KEYS.length - 1, i + 2);
    const A = SPH[ia], B = SPH[i], C = SPH[i + 1], Dk = SPH[id2];
    const rr = Math.exp(herm(A[0], B[0], C[0], Dk[0], e));
    const az = (herm(A[1], B[1], C[1], Dk[1], e) * Math.PI) / 180;
    const el = (herm(A[2], B[2], C[2], Dk[2], e) * Math.PI) / 180;
    cam.set(rr * Math.cos(el) * Math.sin(az), rr * Math.sin(el), rr * Math.cos(el) * Math.cos(az));
    let d = Math.exp(lerp(Math.log(VL[i]), Math.log(VL[i + 1]), e));
    slerpDir(VD[i], VD[i + 1], e, dir).negate(); // dir:從看的那一點指向鏡頭
    look.copy(cam).addScaledVector(dir, -d);
    // 開場推進:鏡頭從 3.2 倍遠的地方滑進來
    if (!sim && s < 1 && tLoad < INTRO + 0.2) {
      d *= lerp(3.2, 1, smooth(0, INTRO, tLoad));
      cam.copy(look).addScaledVector(dir, d);
    }
    // 手持的一點點呼吸 + 滑鼠視差
    upv.copy(k0.up || UP).lerp(k1.up || UP, e).normalize();
    tmp.crossVectors(dir, upv).normalize();
    const br = d * 0.004;
    cam.addScaledVector(tmp, Math.sin(time * 0.21) * br + pointer.x * pointer.on * d * 0.03);
    cam.addScaledVector(upv, Math.sin(time * 0.17 + 1) * br * 0.7 + pointer.y * pointer.on * d * 0.018);
    camera.position.copy(cam);
    camera.up.copy(upv);
    camera.lookAt(look);
    camera.near = Math.max(0.002, d * 0.02);
    camera.far = 1000;
    camera.fov = lerp(k0.fov ?? 35, k1.fov ?? 35, e);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const fogA = lerp(k0.fog?.[0] ?? 3, k1.fog?.[0] ?? 3, e), fogB = lerp(k0.fog?.[1] ?? 16, k1.fog?.[1] ?? 16, e);
    scene.fog.near = d * fogA;
    scene.fog.far = d * fogB;
    const rCam = cam.length();
    occluder.visible = rCam > 6;
    stepPresence(dt, sim || dt === 0);
    if (sim) return;

    // 黑洞那一層
    const LU = lens.U;
    lens.sync(camera);
    LU.uTime.value = time;
    LU.uDiskT.value += dt;
    LU.uFall.value = smooth(2.6, 1.25, rCam) * (rCam < 2.6 ? 1 : 0);
    LU.uFlash.value = pointer.flash * 0.7;
    if (pointer.has && pointer.on > 0.02) {
      ray.setFromCamera(pointer.ndc, camera);
      LU.uCursor.value.set(ray.ray.direction.x, ray.ray.direction.y, ray.ray.direction.z, (mobile ? 0 : 0.0105) * smooth(0.05, 0.9, pointer.on));
    } else LU.uCursor.value.w = 0;
    for (let w = 0; w < MAX_WAVES; w++) if (LU.uWaveA.value[w] > 0 && time - waveAt[w] > 7) LU.uWaveA.value[w] = 0;
    // 開場:整片像顯影一樣從黑裡浮出來
    LU.uDisk.value = smooth(0.15, 1.6, tLoad);
    LU.uSky.value = smooth(0, 1.2, tLoad);

    // 光:主光從鏡頭左上方;吸積盤光在原點(物件朝向黑洞的那一側亮起來)
    const ch = lerp(k0.ch, k1.ch, e);
    // 主光從左上方斜打(不要太靠近鏡頭的方向,否則正對鏡頭的牌子會把它整片反射回來)
    key.position.copy(cam).addScaledVector(tmp, -d * 1.6).addScaledVector(upv, d * 1.0).addScaledVector(dir, -d * 0.6);
    key.target.position.copy(look);
    diskLight.intensity = 1.2 + 2.2 * smooth(30, 4, rCam);
    if (pointer.has) {
      ray.setFromCamera(pointer.ndc, camera);
      plane.setFromNormalAndCoplanarPoint(dir, look);
      if (ray.ray.intersectPlane(plane, hitP)) cursorLight.position.copy(hitP).addScaledVector(dir, d * 0.7);
    }
    // 游標光壓低:金色銘板很亮,太強會在金屬上打出一塊過曝的亮斑
    cursorLight.distance = d * 1.6;
    cursorLight.intensity = (0.22 + pointer.flash * 0.6) * pointer.on;
    eraSoft(ch, 0.5, cursorLight.color);

    // 轉場光流:鏡頭距離的對數變化率 = 墜落速度
    const logD = Math.log(Math.max(rCam, 0.05));
    const v = dt > 0 ? (logD - lastLogD) / dt : 0;
    lastLogD = logD;
    warpV += (v - warpV) * Math.min(1, dt * 6);
    warp.U.uWarp.value = clamp(Math.abs(warpV) * 0.5 - 0.05, 0, 1);
    warp.U.uDir.value = warpV < 0 ? 1 : -1;
    warp.U.uT.value = time;
    warp.U.uD.value = d;
    eraSoft(ch, 0.4, warp.U.uColor.value);
    grade.uniforms.uAb.value = warp.U.uWarp.value;
    grade.uniforms.uTime.value = time;

    // 滑過熱區
    if (pointer.has && pointer.on > 0.3) {
      if (pickDirty || Math.abs(s - pickS) > 1e-3 || ++pickN % 15 === 0) { pickDirty = false; pickS = s; setHover(pickHot()); }
    } else if (hover) setHover(null);

    for (const sc of scenes) sc.post?.(frameState);

    lens.render(renderer);
    composer.render(dt);

    if (hud) {
      setHud(Math.round(clamp(ch, 0, HUD.length - 1)));
      setReadout(rCam);
      hud.root.style.setProperty('--era', '#' + eraSoft(ch, 0.15, tmpC).getHexString());
      if (hud.caption) {
        const narrow = innerWidth <= 860 || innerWidth / innerHeight < 0.8;
        const ni = Math.round(s);
        const want = narrow && Math.abs(s - ni) < 0.36 ? ni : -1;
        if (want !== capIdx || capDirty) {
          capIdx = want; capDirty = false;
          const html = want >= 0 ? captionFor(KEYS[want]) : '';
          if (html) hud.caption.innerHTML = html;
          hud.caption.classList.toggle('on', !!html);
        }
      }
    }
  }
  const tmpC = new THREE.Color();
  let capIdx = -2, capDirty = false;
  for (const ev of ['langchange', 'repos:data', 'heat:data']) addEventListener(ev, () => { capDirty = true; });

  // ---------- 迴圈 + 效能調節 ----------
  // 幀率:桌機最多約 60 幀;手機約 30–40 幀。
  // 解析度:平均幀時間持續超標時,先降黑洞那一層(最貴),不夠再降整體;順了再一級一級升回來。
  // 彈簧的角頻率(越大跟得越緊):9 → 時間常數約 0.11 秒,停下來約 0.5 秒內收住,不會在最後慢慢爬
  const SPRING = 9;
  let raf = 0, last = performance.now(), prevCb = 0, running = false;
  let vsync = 1000 / 60;
  const BUDGET = mobile ? 1000 / 30 : 1000 / 60;
  const PR_MIN = Math.min(PR, mobile ? 0.75 : 1);
  const gov = { pr: PR, ema: 0, n: 0, good: 0, raised: -99, get lens() { return lensQ; } };
  function setPR(p) {
    gov.pr = p; gov.ema = 0; gov.n = 0; gov.good = 0;
    renderer.setPixelRatio(p);
    composer.setPixelRatio(p);
  }
  function setLens(q) {
    lensQ = q; gov.ema = 0; gov.n = 0; gov.good = 0;
    lens.setSize(innerWidth, innerHeight, q);
  }
  function govern(ms) {
    if (ms > 100 || tLoad < 4) return;
    gov.ema = gov.n++ ? gov.ema + (ms - gov.ema) * 0.05 : ms;
    if (gov.n < 60) return;
    if (gov.ema > BUDGET * 1.3) {
      if (lensQ > LENS_MIN + 1e-3) setLens(Math.max(LENS_MIN, +(lensQ - 0.08).toFixed(2)));
      else if (gov.pr > PR_MIN) setPR(Math.max(PR_MIN, gov.pr - 0.25));
    } else if (gov.ema < BUDGET * 1.1) {
      if ((gov.good += ms) > 5000) {
        gov.raised = time;
        if (gov.pr < PR) setPR(Math.min(PR, gov.pr + 0.25));
        else if (lensQ < LENS_MAX - 1e-3) setLens(Math.min(LENS_MAX, +(lensQ + 0.08).toFixed(2)));
        else gov.good = 0;
      }
    } else gov.good = 0;
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const iv = now - prevCb;
    prevCb = now;
    if (iv > 3 && iv < 40) vsync += (iv - vsync) * (iv < vsync ? 0.3 : 0.02);
    const n = mobile ? Math.max(1, Math.ceil(25 / vsync - 0.05)) : Math.max(1, Math.floor(1000 / 60 / vsync + 0.1));
    if (now - last < (n - 0.5) * vsync) return;
    const ms = now - last;
    const dt = Math.min(0.1, ms / 1000);
    last = now;
    govern(ms);
    time += dt;
    tLoad += dt;
    // 鏡頭跟捲動之間是一條臨界阻尼的彈簧:指數平滑在每一格滾輪都會讓速度瞬間跳起來(那一下就是「生硬」),
    // 彈簧的起步與停下都是圓的。小步積分,掉幀時也穩定。
    for (let rem = dt; rem > 1e-6; rem -= 1 / 120) {
      const h = Math.min(rem, 1 / 120);
      sVel += (SPRING * SPRING * (sTarget - sView) - 2 * SPRING * sVel) * h;
      sView += sVel * h;
    }
    if (Math.abs(sTarget - sView) < 1e-4 && Math.abs(sVel) < 1e-3) { sView = sTarget; sVel = 0; }
    draw(dt);
    if (!choresQueued && tLoad > 4) queueChores();
  }

  // ---------- 閒置工作:建延後的場景 → 預傳貼圖 ----------
  const idle = window.requestIdleCallback
    ? (fn) => requestIdleCallback(fn, { timeout: 3000 })
    : (fn) => setTimeout(() => fn({ timeRemaining: () => 10 }), 60);
  const chores = [];
  let choresQueued = false, choring = false;
  function runChores() {
    if (choring) return;
    choring = true;
    idle(function step(dl) {
      do {
        const job = chores.shift();
        if (!job) { choring = false; return; }
        job();
      } while (dl.timeRemaining() > 6);
      idle(step);
    });
  }
  function textures() {
    const set = new Set();
    const grab = (v) => { if (v?.isTexture && v.image && v.image.complete !== false) set.add(v); };
    scene.traverse((o) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        for (const k in m) grab(m[k]);
        if (m.uniforms) for (const k in m.uniforms) grab(m.uniforms[k].value);
      }
    });
    return [...set];
  }
  function queueChores() {
    choresQueued = true;
    chores.push(() => { for (const t of textures()) chores.push(() => renderer.initTexture(t)); });
    chores.push(() => { renderer.compileAsync(scene, camera).catch(() => {}); });
    runChores();
  }
  const start = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', () => layout(), { passive: true });
  addEventListener('orientationchange', () => layout());
  addEventListener('load', () => layout(), { once: true });
  const main = document.querySelector('main');
  if (main && 'ResizeObserver' in window) {
    let q = null;
    new ResizeObserver(() => { if (q == null) q = requestAnimationFrame(() => { q = null; layout(); }); }).observe(main);
  }
  canvas.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); stop(); document.documentElement.classList.add('world-fallback'); });

  layout();
  sView = sTarget;
  draw(0);
  document.documentElement.classList.add('world-ready');
  start();

  if (debug) {
    window.__world = {
      get s() { return sView; }, KEYS, anchors: () => anchors.slice(), scene, camera, renderer, composer, bloom, etch, lens, scenes: { plaque, stars, agents, station, planets, console: consoleS, horizon },
      settle() { readScroll(); sView = sTarget; sVel = 0; tLoad = Math.max(tLoad, 6); time += 0.016; draw(0.016); },
      tick(dt = 0.1) { time += dt; tLoad += dt; draw(dt); },
      go(name, f = 0) { const i = kIdx(name); const y = lerp(anchors[i], anchors[Math.min(i + 1, anchors.length - 1)], f) - innerHeight / 2; scrollTo({ top: y, behavior: 'instant' }); this.settle(); return i; },
      setS(s) { sTarget = sView = s; sVel = 0; tLoad = Math.max(tLoad, 6); time += 0.016; draw(0.016); },
      // 截圖 QA:跳到某個鏡頭、讓轉場光流與刻字都跑完,再停在那一幀
      async shot(name, f = 0) {
        this.go(name, f);
        await new Promise((r) => setTimeout(r, 250));
        this.settle();
        for (let i = 0; i < 40; i++) this.tick(0.05);
        return [name, +sView.toFixed(2), +camera.position.length().toFixed(2)];
      },
      buildMs, gov, setLens, get vsync() { return vsync; },
      // 鏡頭沿整條路徑走一遍:回報離黑洞最近的距離(07 章以外不該小於 2)
      path(step = 0.05) {
        const out = [];
        for (let s = 0; s <= KEYS.length - 1; s += step) { draw(0, s); out.push([+s.toFixed(2), +camera.position.length().toFixed(2), KEYS[Math.floor(s)].name]); }
        draw(0, sView);
        return out;
      },
      hover(nx, ny) { pointer.ndc.set(nx, ny); pointer.has = true; pointer.target = 1; pointer.on = 1; pointer.lastMove = time; },
      click(nx, ny) { pointer.ndc.set(nx, ny); pointer.has = true; ray.setFromCamera(pointer.ndc, camera); emitWave(ray.ray.direction); pointer.flash = 1; },
      pick(nx, ny) {
        ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
        return ray.intersectObjects(scene.children, true).filter((h) => h.object.isMesh && h.object.visible).slice(0, 6).map((h) => {
          let o = h.object, path = [];
          while (o && path.length < 5) { path.push(o.name || o.type); o = o.parent; }
          return { path: path.join(' < '), dist: +h.distance.toFixed(3) };
        });
      },
      scanBad() {
        const w = 320, h = Math.round(320 / camera.aspect);
        const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType });
        lens.render(renderer);
        renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
        const buf = new Float32Array(w * h * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
        rt.dispose();
        let bad = 0, maxV = 0;
        for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (!Number.isFinite(v)) bad++; else if (v > maxV) maxV = v; }
        return { bad, maxV };
      },
      info() {
        renderer.info.autoReset = false; renderer.info.reset();
        renderer.render(scene, camera);
        const r = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tex: renderer.info.memory.textures, geo: renderer.info.memory.geometries };
        renderer.info.autoReset = true;
        return r;
      },
    };
  }
}
