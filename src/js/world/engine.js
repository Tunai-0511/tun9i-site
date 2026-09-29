// 《訊號簡史》引擎 —— 整個網站是一部可以捲動的 3D 短片。
//
// 捲動位置 = 時間軸。時間軸上有一串關鍵鏡頭(KEYS),每個鏡頭屬於某個「空間」:
//   outside(台中夜景,公尺)⊃ main(主機、主機板、CPU,公分)⊃ die(晶粒上的城市)⊃ stack(金屬導線層)
// 空間是一層套一層的:每一幕都藏在下一幕的一小塊裡。鏡頭在兩個空間之間移動時,
// 距離用對數內插(Powers of Ten 式的縮放),看起來就是一路鑽進去、或一路拉出來。
//
// 數值精度:從金屬層到城市夜景差了十幾個數量級,不能放在同一個座標系裡算。
// 所以每一幀都以「目前鏡頭所在的空間」為基準,只把相鄰的空間換算過來(rebase)。
//
// 網站的內容不是字卡:它們用 etch.js 刻在場景裡的物件上,可以點的就是連結。

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { currentPalette } from './palettes.js';
import { era, eraSoft, paletteColors, setPaletteColors } from './era.js';
import { createEtcher, createAssets } from './etch.js';
import { makeWarp } from './particles.js';
import { captionFor } from './captions.js';
import { buildCpu } from './scenes/cpu.js';
import { buildStack } from './scenes/stack.js';
import { buildDie } from './scenes/die.js';
import { buildBoard } from './scenes/board.js';
import { buildRoom } from './scenes/room.js';
import { buildOutside } from './scenes/outside.js';
import { CERTS, AI_TOOLS, GAMES } from '../../data/world.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

// 紀錄片式 HUD:每一章一組
const HUD = [
  { n: '00', zh: '原始訊號', en: 'RAW SIGNAL', num: '2026', cap: 'TAICHUNG · TAIWAN' },
  { n: '01', zh: '剖開', en: 'CROSS-SECTION', num: '1', cap: 'WHO I AM · 關於我' },
  { n: '02', zh: '歷程', en: 'METAL LAYERS', num: String(CERTS.length), cap: 'CERTIFICATIONS · 證照與鑑定' },
  { n: '03', zh: 'AI 工作流', en: 'THE AGENTS', num: String(AI_TOOLS.length), cap: 'TOOLS · 每天在用' },
  { n: '04', zh: '作品', en: 'ON THE BOARD', num: '7+', cap: 'REPOSITORIES · GITHUB' },
  { n: '05', zh: '下班之後', en: 'AFTER HOURS', num: String(GAMES.length), cap: 'GAMES IN ROTATION · 在玩的遊戲' },
  { n: '06', zh: '配備', en: 'THE MACHINE', num: '16', cap: 'CORES · 32 THREADS · 64 GB' },
  { n: '07', zh: '訊號送出', en: 'SIGNAL OUT', num: '2026', cap: 'TUN9I.COM' },
];

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
  // 不開反鋸齒:場景是先畫進後製的畫布(那張沒有多重取樣),螢幕這層只貼一張全螢幕的圖 —— 開了只多吃記憶體,畫面一樣
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  const PR = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  renderer.setPixelRatio(PR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(0x050407, 1);
  const canvas = renderer.domElement;
  canvas.className = 'world-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050407, 20, 90);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 1000);
  scene.add(camera);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(PR);
  composer.addPass(new RenderPass(scene, camera));
  // 門檻拉高:只有自發光的東西(刻字、雷射、訊號)會暈開,金屬反光不會
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), mobile ? 0.42 : 0.5, 0.34, 0.85);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  // ---------- 光 ----------
  scene.add(new THREE.AmbientLight(0x2a2433, 0.6));
  const key = new THREE.DirectionalLight(0xfff1e0, 0.6);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffb35c, 1.1);
  scene.add(rim, rim.target);
  const cursorLight = new THREE.PointLight(0xffe6c4, 0, 1, 0);
  scene.add(cursorLight);

  // ---------- 色票 ----------
  setPaletteColors(paletteColors(currentPalette()));
  const recolor = [];

  // ---------- 刻字 + 資產 ----------
  const etch = createEtcher({ renderer, mobile });
  let redrawQ = 0;
  const assets = createAssets(() => { if (!redrawQ) redrawQ = requestAnimationFrame(() => { redrawQ = 0; etch.redrawAll(); }); });

  // ---------- 空間 ----------
  const mkSpace = (name) => { const g = new THREE.Group(); g.name = 'space:' + name; g.matrixAutoUpdate = false; scene.add(g); return g; };
  const SP = {
    outside: { g: mkSpace('outside'), parent: null, local: new THREE.Matrix4(), range: [0.3, 1e6] },
    main: { g: mkSpace('main'), parent: 'outside', local: new THREE.Matrix4(), range: [0.004, 1e5] }, // 鑽進金屬層之後就不畫(它的剖面貼圖放大上千倍只剩一片糊光)
    die: { g: mkSpace('die'), parent: 'main', local: new THREE.Matrix4(), range: [0.5, 9000] },
    // 金屬層:1 單位 ≈ 1 µm。往 +z 挪一點,讓它的切面在主空間那張晶粒剖面貼圖的前面(否則被貼圖蓋住)
    stack: { g: mkSpace('stack'), parent: 'die', local: new THREE.Matrix4().makeTranslation(0, 0, 0.08).multiply(new THREE.Matrix4().makeScale(0.01, 0.01, 0.01)), range: [0, 900] },
  };

  // ---------- 場景 ----------
  const U = { uTime: { value: 0 } };
  const ctx = { mobile, etch, assets, recolor, U, renderer };
  const buildMs = {};
  const timed = (name, fn) => { const t0 = performance.now(); const r = fn(); buildMs[name] = +(performance.now() - t0).toFixed(1); return r; };
  const cpu = timed('cpu', () => buildCpu(ctx));
  SP.main.g.add(cpu.root);
  const stack = timed('stack', () => buildStack(ctx));
  SP.stack.g.add(stack.root);
  const die = timed('die', () => buildDie(ctx));
  SP.die.g.add(die.root);
  const board = timed('board', () => buildBoard(ctx));
  SP.main.g.add(board.root);
  cpu.socket.p.copy(board.socketPos);
  cpu.socket.q.copy(board.socketQuat);
  ctx.board = board; // 06 章的規格標註要指到主機板上的零件
  const room = timed('room', () => buildRoom(ctx));
  SP.main.g.add(room.root);
  const outside = timed('outside', () => buildOutside(ctx));
  SP.outside.g.add(outside.root);
  SP.main.local.copy(outside.roomMatrix); // 房間(主空間)放在夜景裡某棟樓的窗後
  const scenes = [cpu, stack, die, board, room, outside];
  let hotMeshes = [];
  const refreshHot = () => { hotMeshes = scenes.flatMap((s) => s.hotMeshes || []); };
  refreshHot();

  // ---------- 關鍵鏡頭 ----------
  // T:看哪裡;O:從 T 往哪個方向、多遠;都在該鏡頭所屬空間的座標裡。
  // ch:章節(HUD 與色溫);id:對應的 HTML 區塊(捲動位置從它算)
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const KEYS = [
    { name: 'hero', id: 'hero', ch: 0, space: 'main', T: V(0.05, 0.05, 0.9), O: V(0.5, 0.25, 8.6) },
    { name: 'about.cut', id: 'about', ch: 1, space: 'main', T: V(0.1, 0.35, 0), O: V(4.2, 4.6, 6.4) },
    { name: 'about.read', id: 'about', ch: 1, space: 'main', T: V(0, 0.64, 0.1), O: V(0, 0.3, 4.4) },
    { name: 'about.layers', id: 'about', ch: 1, space: 'main', T: V(1.35, 0.85, 0), O: V(-0.4, 0.6, 7.6) },
    ...stack.keys.map((k) => ({ ...k, id: 'journey', ch: 2, space: 'stack' })),
    ...die.keys.map((k) => ({ ...k, id: 'ai', ch: 3, space: 'die' })),
    ...board.keys.projects.map((k) => ({ ...k, id: 'projects', ch: 4, space: 'main' })),
    ...board.keys.interests.map((k) => ({ ...k, id: 'interests', ch: 5, space: 'main' })),
    ...room.keys.map((k) => ({ ...k, id: 'setup', ch: 6, space: k.space || 'main' })),
    ...outside.keys.map((k) => ({ ...k, id: 'contact', ch: 7, space: k.space || 'outside' })),
  ];
  const KI = Object.fromEntries(KEYS.map((k, i) => [k.name, i]));
  // 每一章第一個 / 最後一個鏡頭(章節的鏡頭數會跟著內容資料變,場景別寫死名字)
  const FIRST = {}, LAST = {};
  KEYS.forEach((k, i) => { if (FIRST[k.id] == null) FIRST[k.id] = i; LAST[k.id] = i; });
  const kIdx = (name) => { const i = KI[name]; if (i == null) throw new Error('[world] no key ' + name); return i; };

  // ---------- 延後建構 ----------
  // 主機板、機殼與桌面、窗外城市要捲到後半段才出場:首屏不建,開場動畫跑完、瀏覽器閒下來再一個一個建。
  // 捲得比閒置排程快(或網址直接跳到後面的章節)時,在出場前一段距離當場建。
  const LAZY = [
    { sc: board, name: 'board', at: FIRST.ai - 0.5 },
    { sc: room, name: 'room', at: FIRST.interests - 1.2 },
    { sc: outside, name: 'outside', at: FIRST.setup - 0.8 },
  ];
  function populate(L) {
    if (L.sc.ready) return;
    const t0 = performance.now();
    L.sc.populate();
    buildMs[L.name + '+'] = +(performance.now() - t0).toFixed(1);
    refreshHot();
    applyPalette(livePal); // 新零件的顏色跟上目前的色票
  }

  // ---------- 空間換算 ----------
  const toRoot = {};
  const tmpM = new THREE.Matrix4(), inv = new THREE.Matrix4();
  // 物件相對於某個祖先的矩陣(先各自 updateMatrix)
  function relTo(obj, ancestor, out) {
    out.identity();
    let o = obj;
    const chain = [];
    while (o && o !== ancestor) { o.updateMatrix(); chain.push(o); o = o.parent; }
    for (let i = chain.length - 1; i >= 0; i--) out.multiply(chain[i].matrix);
    return out;
  }
  function computeRoots() {
    // die 空間掛在 CPU 的晶粒上 —— CPU 會動,所以每一幀重算
    relTo(cpu.dieAnchor, cpu.root.parent, SP.die.local);
    SP.die.local.multiply(tmpM.makeScale(0.01, 0.01, 0.01));
    const order = ['outside', 'main', 'die', 'stack'];
    for (const n of order) {
      const s = SP[n];
      toRoot[n] = toRoot[n] || new THREE.Matrix4();
      if (!s.parent) toRoot[n].copy(s.local);
      else toRoot[n].multiplyMatrices(toRoot[s.parent], s.local);
    }
  }
  const relCache = {};
  function rel(base, sp) {
    const key = base + '>' + sp;
    const m = relCache[key] || (relCache[key] = new THREE.Matrix4());
    return m.copy(inv.copy(toRoot[base]).invert()).multiply(toRoot[sp]);
  }
  const scaleOf = (m) => Math.hypot(m.elements[0], m.elements[1], m.elements[2]);

  // ---------- 捲動 → s ----------
  const sections = [...new Set(KEYS.map((k) => k.id))];
  const perSection = Object.fromEntries(sections.map((id) => [id, KEYS.filter((k) => k.id === id).length]));
  for (const id of sections) document.getElementById(id)?.style.setProperty('--beats', perSection[id]);
  let anchors = KEYS.map((_, i) => i);
  let sTarget = 0, sView = 0;
  function layout() {
    const vh = innerHeight;
    const maxYc = Math.max(1, document.documentElement.scrollHeight - vh) + vh / 2;
    const seen = {};
    anchors = KEYS.map((k) => {
      const el = document.getElementById(k.id);
      if (!el) return vh / 2;
      const j = (seen[k.id] = (seen[k.id] ?? -1) + 1), n = perSection[k.id];
      const r = el.getBoundingClientRect();
      return clamp(r.top + scrollY + ((j + 0.5) / n) * r.height, vh / 2, maxYc);
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
  let vw = 0, vhh = 0;
  function resize() {
    const w = innerWidth, h = innerHeight;
    if (coarse && vw && w === vw && Math.abs(h - vhh) < 140) return; // 手機網址列伸縮不重建
    vw = w; vhh = h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    // 窄螢幕下緣有字幕:把畫面往上推,主體落在上半部
    if (w <= 860 || w / h < 0.8) camera.setViewOffset(w, h, 0, h * 0.15, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  // ---------- 游標 / 熱區 / 點擊 ----------
  const pointer = { ndc: new THREE.Vector2(), has: false, on: 0, target: 0, lastMove: -99, x: 0, y: 0, flash: 0 };
  const ray = new THREE.Raycaster();
  let hover = null; // { block, hit }
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
      const reveal = b.mat.uniforms.uReveal.value;
      if (reveal < 0.95) continue;
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
    for (const s of scenes) s.pulse?.(ray, frameState);
  }, { passive: true });

  // ---------- 轉場光流 ----------
  const warp = makeWarp({ count: mobile ? 140 : 260 });
  camera.add(warp.lines);

  // ---------- HUD ----------
  let hudIdx = -1, hudTimer = 0;
  function setHud(i) {
    if (!hud || i === hudIdx) return;
    hudIdx = i;
    const H = HUD[i];
    hud.root.classList.add('is-swapping');
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => {
      hud.n.textContent = H.n; hud.zh.textContent = H.zh; hud.en.textContent = H.en;
      hud.num.textContent = H.num; hud.cap.textContent = H.cap;
      hud.root.classList.remove('is-swapping');
    }, 220);
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
  addEventListener('langchange', () => { etch.redrawAll(); requestAnimationFrame(layout); });
  document.fonts?.ready.then(() => etch.redrawAll());
  Promise.all(['500 40px "Space Grotesk"', '700 40px "Space Grotesk"', '700 40px "Playfair Display"', '600 40px "Playfair Display"'].map((f) => document.fonts?.load(f))).then(() => etch.redrawAll()).catch(() => {});

  // ---------- 每一幀 ----------
  let time = 0, tLoad = 0;
  const T0 = new THREE.Vector3(), T1 = new THREE.Vector3(), P0 = new THREE.Vector3(), P1 = new THREE.Vector3();
  const up0 = new THREE.Vector3(), up1 = new THREE.Vector3(), n0 = new THREE.Vector3(), n1 = new THREE.Vector3();
  const look = new THREE.Vector3(), cam = new THREE.Vector3(), dir = new THREE.Vector3(), upv = new THREE.Vector3(), tmp = new THREE.Vector3();
  const plane = new THREE.Plane(), hitP = new THREE.Vector3();
  let lastLogD = 0, warpV = 0;
  const frameState = {};
  const FOG_BASE = new THREE.Color(0x050407), fogColor = FOG_BASE.clone();

  function slerpDir(a, b, t, out) {
    const d = clamp(a.dot(b), -1, 1);
    const th = Math.acos(d);
    if (th < 1e-3) return out.copy(a).lerp(b, t).normalize();
    if (Math.PI - th < 1e-3) { // 幾乎相反:繞一個垂直軸轉
      const ax = Math.abs(a.y) < 0.9 ? tmp.set(0, 1, 0) : tmp.set(1, 0, 0);
      return out.copy(a).applyAxisAngle(ax.cross(a).normalize(), th * t);
    }
    const s0 = Math.sin((1 - t) * th) / Math.sin(th), s1 = Math.sin(t * th) / Math.sin(th);
    return out.set(a.x * s0 + b.x * s1, a.y * s0 + b.y * s1, a.z * s0 + b.z * s1).normalize();
  }
  const holdEase = (f, h) => smooth(h, 1 - h, f);

  // simS:只把場景與鏡頭擺到某個位置(預熱用),不畫、不動游標與轉場光流這些有狀態的東西
  function draw(dt, simS = null) {
    const sim = simS != null;
    const s = sim ? simS : sView;
    const ahead = Math.max(s, sTarget);
    for (const L of LAZY) if (!L.sc.ready && ahead > L.at) populate(L);
    if (!sim) stepPalette();
    U.uTime.value = time;
    const i = Math.min(KEYS.length - 2, Math.floor(s));
    const f = s - i;
    const k0 = KEYS[i], k1 = KEYS[i + 1];
    const e = holdEase(f, k0.hold ?? 0.14);
    const aspect = innerWidth / innerHeight;
    const pull = aspect < 1 ? Math.pow(1 / aspect, 0.9) : 1;

    // 1) 場景各自更新(CPU 會動 → die 空間跟著動,所以要在換算之前)
    if (!sim) {
      if (time - pointer.lastMove > 2.5) pointer.target = 0;
      pointer.on += (pointer.target - pointer.on) * 0.08;
      pointer.x += (pointer.ndc.x - pointer.x) * 0.06;
      pointer.y += (pointer.ndc.y - pointer.y) * 0.06;
      pointer.flash *= 0.9;
    }
    fogColor.copy(FOG_BASE);
    Object.assign(frameState, { fogColor, s, i, e, time, dt, tLoad, k: kIdx, first: (id) => FIRST[id], last: (id) => LAST[id], p: (a, b) => smooth(kIdx(a), kIdx(b), s), pointer, camera, mobile, ray });
    for (const sc of scenes) sc.update(frameState);

    // 2) 空間換算:以 k0 所在的空間為基準
    computeRoots();
    const base = k0.space;
    for (const n in SP) { SP[n].g.matrix.copy(rel(base, n)); SP[n].g.matrixWorldNeedsUpdate = true; }

    // 3) 鏡頭
    const m0 = rel(base, k0.space), m1 = rel(base, k1.space);
    T0.copy(k0.T).applyMatrix4(m0); P0.copy(k0.T).addScaledVector(k0.O, pull).applyMatrix4(m0);
    T1.copy(k1.T).applyMatrix4(m1); P1.copy(k1.T).addScaledVector(k1.O, pull).applyMatrix4(m1);
    up0.set(0, 1, 0).transformDirection(m0); up1.set(0, 1, 0).transformDirection(m1);
    n0.subVectors(P0, T0); n1.subVectors(P1, T1);
    const d0 = n0.length(), d1 = n1.length();
    n0.divideScalar(d0); n1.divideScalar(d1);
    const d = Math.exp(lerp(Math.log(d0), Math.log(d1), e));
    // 大縮放:目標點跟著距離走(縮放中心在畫面上不亂飄);一般移動:線性
    const big = Math.abs(Math.log(d1 / d0)) > 1.2;
    const u = big ? (Math.abs(d1 - d0) > 1e-12 ? (d - d0) / (d1 - d0) : e) : e;
    look.lerpVectors(T0, T1, u);
    slerpDir(n0, n1, e, dir);
    cam.copy(look).addScaledVector(dir, d);
    // 手持的一點點呼吸 + 滑鼠視差
    upv.copy(up0).lerp(up1, e).normalize();
    tmp.crossVectors(dir, upv).normalize(); // 右
    const br = d * 0.004;
    cam.addScaledVector(tmp, Math.sin(time * 0.21) * br + pointer.x * pointer.on * d * 0.03);
    cam.addScaledVector(upv, Math.sin(time * 0.17 + 1) * br * 0.7 + pointer.y * pointer.on * d * 0.018);
    camera.position.copy(cam);
    camera.up.copy(upv);
    camera.lookAt(look);
    camera.near = d * 0.02;
    camera.far = d * 700;
    camera.fov = lerp(k0.fov ?? 35, k1.fov ?? 35, e);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const fogA = lerp(k0.fog?.[0] ?? 1.6, k1.fog?.[0] ?? 1.6, e), fogB = lerp(k0.fog?.[1] ?? 9, k1.fog?.[1] ?? 9, e);
    scene.fog.color.copy(fogColor); // 場景可以在 update 裡改霧色(例如窗外的夜景)
    scene.fog.near = d * fogA;
    scene.fog.far = d * fogB;

    // 4) 各空間是否要畫:鏡頭距離換算成該空間的單位,落在範圍內才畫
    for (const n in SP) {
      const sp = SP[n];
      const dn = d / scaleOf(sp.g.matrix);
      sp.g.visible = dn >= sp.range[0] && dn <= sp.range[1];
      sp.dist = dn;
    }
    if (sim) return;

    // 5) 光:主光從左上前方、輪廓光從後方(帶章節色)
    const ch = lerp(k0.ch, k1.ch, e);
    key.position.copy(look).addScaledVector(dir, d).addScaledVector(tmp, -d * 0.8).addScaledVector(upv, d * 1.2);
    key.target.position.copy(look);
    rim.position.copy(look).addScaledVector(dir, -d).addScaledVector(upv, d * 0.6).addScaledVector(tmp, d * 0.5);
    rim.target.position.copy(look);
    era(ch, rim.color);
    // 游標光:投在「過目標、面向鏡頭」的平面上
    if (pointer.has) {
      ray.setFromCamera(pointer.ndc, camera);
      plane.setFromNormalAndCoplanarPoint(dir, look);
      // 離表面遠一點:光落在一大片上,不會在金屬上打出一個刺眼的鏡面亮點
      if (ray.ray.intersectPlane(plane, hitP)) cursorLight.position.copy(hitP).addScaledVector(dir, d * 0.45);
    }
    cursorLight.distance = d * 1.4;
    cursorLight.intensity = (0.55 + pointer.flash * 1.1) * pointer.on;
    eraSoft(ch, 0.5, cursorLight.color);

    // 6) 轉場光流:鏡頭距離的對數變化率 = 縮放速度
    const logD = Math.log(d);
    const v = dt > 0 ? (logD - lastLogD) / dt : 0;
    lastLogD = logD;
    warpV += (v - warpV) * Math.min(1, dt * 6);
    warp.U.uWarp.value = clamp(Math.abs(warpV) * 0.22 - 0.05, 0, 1);
    warp.U.uDir.value = warpV < 0 ? 1 : -1; // 距離變小 = 往前鑽
    warp.U.uT.value = time;
    warp.U.uD.value = d;
    eraSoft(ch, 0.4, warp.U.uColor.value);
    grade.uniforms.uAb.value = warp.U.uWarp.value;
    grade.uniforms.uTime.value = time;

    // 7) 滑過熱區
    // 射線只在游標動了、鏡頭在走的時候重打(停著不動就每 15 幀補一次,給還在寫入的刻字)
    if (pointer.has && pointer.on > 0.3) {
      if (pickDirty || Math.abs(s - pickS) > 1e-3 || ++pickN % 15 === 0) { pickDirty = false; pickS = s; setHover(pickHot()); }
    } else if (hover) setHover(null);

    // 8) 給場景的空間資訊(粒子大小、游標射線換算到本地座標等)
    frameState.scaleOf = (n) => scaleOf(SP[n].g.matrix);
    for (const sc of scenes) sc.post?.(frameState, SP);

    composer.render(dt);

    // HUD
    if (hud) {
      setHud(Math.round(clamp(ch, 0, HUD.length - 1)));
      hud.root.style.setProperty('--era', '#' + eraSoft(ch, 0.15, tmpC).getHexString());
      // 窄螢幕:鏡頭停下來的時候,下緣出現這一幕的字幕
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
  // 幀率:桌機最多約 60 幀 —— 120/144 Hz 的螢幕不用每一格都畫(動畫照時間走,速度不變,只是少畫一半);手機約 30–40 幀。
  // 解析度:平均幀時間持續超標才一級一級降、順了再慢慢升回來。跑得動的機器永遠是原本的畫質。
  let raf = 0, last = performance.now(), prevCb = 0, running = false;
  let vsync = 1000 / 60; // 螢幕更新間隔(估計值:跳過的那幾格很輕,量到的就是螢幕本身的節奏)
  const BUDGET = mobile ? 1000 / 30 : 1000 / 60;
  const PR_MIN = Math.min(PR, mobile ? 0.75 : 1);
  const gov = { pr: PR, cap: PR, capT: 0, ema: 0, n: 0, good: 0, raised: -99 };
  function setPR(p) {
    gov.pr = p; gov.ema = 0; gov.n = 0; gov.good = 0;
    renderer.setPixelRatio(p);
    composer.setPixelRatio(p);
  }
  function govern(ms) {
    if (ms > 100 || tLoad < 6) return; // 切分頁、建場景那種單次卡頓不算
    gov.ema = gov.n++ ? gov.ema + (ms - gov.ema) * 0.05 : ms;
    if (gov.n < 60) return; // 開始時、每次調整後,先量一秒左右再下判斷(單一慢幀不會觸發)
    if (gov.cap < PR && time > gov.capT) gov.cap = PR; // 上限只鎖一陣子(當時可能只是背景有別的程式在忙)
    if (gov.ema > BUDGET * 1.35 && gov.pr > PR_MIN) {
      // 剛升上去就撐不住 → 上限先鎖在下面那一級,免得在兩級之間來回跳
      if (time - gov.raised < 8) { gov.cap = gov.pr - 0.25; gov.capT = time + 30; gov.raised = -99; }
      setPR(Math.max(PR_MIN, gov.pr - 0.25));
    } else if (gov.ema < BUDGET * 1.12 && gov.pr < gov.cap) {
      if ((gov.good += ms) > 4000) { gov.raised = time; setPR(Math.min(gov.cap, gov.pr + 0.25)); }
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
    sView += (sTarget - sView) * (1 - Math.exp(-dt * 4.5));
    if (Math.abs(sTarget - sView) < 1e-4) sView = sTarget;
    draw(dt);
    if (!choresQueued && tLoad > 5) queueChores();
  }

  // ---------- 閒置工作:建後面的場景 → 預編著色器 → 預傳貼圖 ----------
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
  // three.js 的著色器會依「畫面上有幾盞燈」各編一版:第一次進到燈光組合不同的章節(例如機殼裡的燈亮起來),
  // 那一刻看得到的材質全要重編,捲動會頓一下。閒置時把每個鏡頭的燈光組合先編好。
  const ROOTS = [cpu.root, stack.root, die.root, board.root, room.root, outside.root];
  const warmed = new Set();
  const NOOP = () => {};
  function lightSig() {
    const c = {};
    scene.traverseVisible((o) => { if (o.isLight) c[o.type] = (c[o.type] || 0) + 1; });
    return Object.keys(c).sort().map((t) => t + c[t]).join();
  }
  function warmAt(i) {
    draw(0, i); // 場景、鏡頭、各空間的可見性都擺到第 i 個鏡頭
    const sig = lightSig();
    const want = ROOTS.filter((r) => visibleDeep(r) && !warmed.has(sig + r.name));
    if (want.length) {
      // 整個場景一起編(燈要從整個場景收),但跳過這個組合下不會出現的子樹 —— 省得編一堆用不到的版本
      const skip = ROOTS.filter((r) => !want.includes(r));
      for (const r of skip) r.traverse = NOOP;
      const rt = renderer.getRenderTarget();
      renderer.setRenderTarget(composer.renderTarget1); // 真正渲染是畫進後製的畫布:色彩空間、色調映射要一樣,編出來的版本才對得上
      try { renderer.compileAsync(scene, camera).catch(NOOP); }
      finally {
        renderer.setRenderTarget(rt);
        for (const r of skip) delete r.traverse;
      }
      for (const r of want) warmed.add(sig + r.name);
    }
    draw(0, sView); // 擺回目前的位置(點擊判定要用)
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
    for (const L of LAZY) chores.push(() => populate(L));
    chores.push(() => {
      KEYS.forEach((_, i) => chores.push(() => warmAt(i)));
      chores.push(() => { for (const t of textures()) chores.push(() => renderer.initTexture(t)); });
    });
    runChores();
  }
  const start = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', layout, { passive: true });
  addEventListener('orientationchange', layout);
  addEventListener('load', layout, { once: true });
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
      get s() { return sView; }, KEYS, anchors: () => anchors.slice(), scene, SP, cpu, stack, die, board, room, outside, camera, bloom, etch,
      // 截圖 QA:預覽窗格在背景時 rAF 會降頻,settle() 直接把狀態推到終點再畫一幀
      settle() { readScroll(); sView = sTarget; tLoad = Math.max(tLoad, 6); time += 0.016; draw(0.016); },
      tick(dt = 0.1) { time += dt; tLoad += dt; draw(dt); },
      // 網站 CSS 是平滑捲動 → 這裡要 instant,不然 scrollTo 還沒捲到就先算了
      go(name, f = 0) { const i = kIdx(name); const y = lerp(anchors[i], anchors[Math.min(i + 1, anchors.length - 1)], f) - innerHeight / 2; scrollTo({ top: y, behavior: 'instant' }); this.settle(); return i; },
      setS(s) { sTarget = sView = s; tLoad = Math.max(tLoad, 6); time += 0.016; draw(0.016); },
      buildMs, gov, get vsync() { return vsync; }, get chores() { return chores.length; }, warmed,
      loop, // 手動餵時間戳測效能調節(預覽窗格在背景時 rAF 不會跑)
      // 視覺回歸:固定時間渲染一幀,讀回畫面縮成 96×54,存成 base64(改效能時確認外觀沒變)
      snap() {
        if (gov.pr !== PR) setPR(PR); // 快照一律用原本的解析度比
        time = 20; tLoad = 20; pointer.on = 0; pointer.target = 0; pointer.flash = 0;
        draw(0); warpV = 0; // 先畫一幀讓 lastLogD 對上,再把轉場光流歸零(否則殘留的縮放速度會讓快照不可重現)
        draw(0);
        const gl = renderer.getContext();
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        const buf = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        const SW = 96, SH = 54, out = new Uint8Array(SW * SH * 3);
        for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
          let r = 0, g = 0, b = 0, n = 0;
          const x0 = Math.floor((x * w) / SW), x1 = Math.floor(((x + 1) * w) / SW), y0 = Math.floor((y * h) / SH), y1 = Math.floor(((y + 1) * h) / SH);
          for (let yy = y0; yy < y1; yy += 2) for (let xx = x0; xx < x1; xx += 2) { const i = (yy * w + xx) * 4; r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; n++; }
          out.set([r / n, g / n, b / n], (y * SW + x) * 3);
        }
        let str = ''; for (let i = 0; i < out.length; i++) str += String.fromCharCode(out[i]);
        return btoa(str);
      },
      snapAll() { const o = {}; KEYS.forEach((K, i) => { this.setS(i); o[K.name] = this.snap(); }); return o; },
      // 跟存下來的基準比:每個鏡頭的平均絕對差(0–255)與差最多的那一格
      compare(base) {
        const now = this.snapAll(), res = {};
        for (const k in base) {
          const a = atob(base[k]), b = atob(now[k] || '');
          let sum = 0, mx = 0;
          for (let i = 0; i < a.length; i++) { const d = Math.abs(a.charCodeAt(i) - b.charCodeAt(i)); sum += d; if (d > mx) mx = d; }
          res[k] = [+(sum / a.length).toFixed(2), mx];
        }
        return res;
      },
      // 停在每個鏡頭時,還在「雷射寫入中」的刻字(應該要是空的:鏡頭停下來時字都要寫完)
      midReveal() {
        const out = {};
        KEYS.forEach((K, i) => {
          this.setS(i);
          const mid = etch.blocks.filter((b) => { const r = b.mat.uniforms.uReveal.value; return r > 0.04 && r < 0.96 && visibleDeep(b.mesh); }).map((b) => b.name + ':' + b.mat.uniforms.uReveal.value.toFixed(2));
          if (mid.length) out[K.name] = mid;
        });
        return out;
      },
      // 畫面上某一點打到什麼(除錯:找出是哪個物件在發光)
      pick(nx, ny) {
        ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
        return ray.intersectObjects(scene.children, true).filter((h) => h.object.isMesh && h.object.visible).slice(0, 6).map((h) => {
          let o = h.object, path = [];
          while (o && path.length < 5) { path.push(o.name || o.type); o = o.parent; }
          const m = h.object.material;
          return { path: path.join(' < '), mat: m?.type, color: m?.color?.getHexString?.(), geo: h.object.geometry?.type, dist: +h.distance.toFixed(3) };
        });
      },
      hover(nx, ny) { pointer.ndc.set(nx, ny); pointer.has = true; pointer.target = 1; pointer.on = 1; pointer.lastMove = time; },
      scanBad() {
        const w = 320, h = Math.round(320 / camera.aspect);
        const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType });
        renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
        const buf = new Float32Array(w * h * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
        rt.dispose();
        let bad = 0, maxV = 0;
        for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (!Number.isFinite(v)) bad++; else if (v > maxV) maxV = v; }
        return { bad, maxV };
      },
      // 直接渲染一次場景來量(後製分好幾個 pass,renderer.info 只會剩最後一個 pass 的數字)
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
