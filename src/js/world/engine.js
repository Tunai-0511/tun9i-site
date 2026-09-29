// 《訊號簡史》引擎 —— 捲動位置就是時間軸。
//
// 每個區塊是一個關鍵影格(攝影機看哪裡、從哪裡看、訊號頭跑到哪),影格之間
// 平滑插值,整頁是一個沒有剪接的鏡頭。訊號線只畫到「訊號頭」為止:捲下去,
// 訊號才往右長;捲回來,它就倒退。原始雜訊那一段例外 —— 它一開始就在,而且會抖。
//
// 後製:bloom(主體自己發光)→ 暗角 + 底片顆粒 → ACES 色調映射。
// HUD(左上章節、右上年份、場景內標註)是 HTML,用同一個 world → screen 投影定位。

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildFilm, fatLine, eraColor, signalY, noiseY, X } from './film.js';

// ---------- 關鍵影格 ----------
// F:攝影機看的點;O:攝影機相對 F 的位置;hx:訊號頭的 x
const KEYS = [
  { id: 'hero', f: 0, hx: -1.6, F: [-4.6, 0.3, 0], O: [2.2, 1.2, 12.5] }, // 真空管落在畫面右側,雜訊從左邊流進去
  { id: 'about', f: 0.5, hx: 8, F: [2.6, 0.45, 0], O: [-2.4, 0.9, 7.4] },
  { id: 'journey', f: 0.5, hx: 44, F: [31, 1.5, 0], O: [-6.5, 3.0, 13] },
  { id: 'ai', f: 0.5, hx: 66.5, F: [58.5, 0.2, -1.2], O: [-1, 7.8, 10.5] },
  { id: 'projects', f: 0.2, hx: X.dieA + 2.5, F: [X.dieA, 0, 0], O: [-1.6, 6.2, 7.6] },
  { id: 'projects', f: 0.5, hx: X.dieB + 2.5, F: [X.dieB, 0, 0], O: [0, 6.6, 7.6] },
  { id: 'projects', f: 0.8, hx: X.dieC + 2.5, F: [X.dieC, 0, 0], O: [1.6, 6.2, 7.6] },
  { id: 'interests', f: 0.5, hx: 147, F: [137, 0.6, -0.8], O: [0, 1.6, 12] },
  { id: 'setup', f: 0.5, hx: 167, F: [X.rig, 0, 0], O: [3.2, 8.5, 7.5] },
  { id: 'contact', f: 0.14, hx: 181.5, F: [X.lamp + 0.5, 1.25, 0], O: [-6.2, 1.9, 8.4] },
  // 結尾:退到起點的上空往前看 —— 整條訊號從腳下的雜訊一路延伸到遠方的光束
  { id: 'contact', f: 1, hx: X.end, F: [104, 0, 0], O: [-140, 40, 66] },
];
// 紀錄片式 HUD:左上章節、右上大字(年份或計數)
const HUD = [
  { n: '00', zh: '原始訊號', en: 'RAW SIGNAL', num: '2026', cap: 'TAICHUNG · TAIWAN' },
  { n: '01', zh: '起點', en: 'THE ORIGIN', num: '2024', cap: 'FIRST SPARK · 第一張證照' },
  { n: '02', zh: '歷程', en: 'THE JOURNEY', num: '2025', cap: '5 CERTIFICATIONS · 證照與鑑定' },
  { n: '03', zh: 'AI 工作流', en: 'THE AGENTS', num: '2026', cap: '6 TOOLS · 每天在用' },
  { n: '04', zh: '作品', en: 'THE PRODUCTS', num: '7+', cap: 'IPAS.TUN9I.COM · 550 KB' },
  { n: '04', zh: '作品', en: 'THE PRODUCTS', num: '7+', cap: 'AGENTAQI · FASTAPI + AGENT' },
  { n: '04', zh: '作品', en: 'THE PRODUCTS', num: '7+', cap: 'VISION NAV · OPENCV + VOICE' },
  { n: '05', zh: '下班之後', en: 'AFTER HOURS', num: '8', cap: 'GAMES IN ROTATION · 在玩的遊戲' },
  { n: '06', zh: '配備', en: 'THE MACHINE', num: '16', cap: 'CORES · 32 THREADS · 64 GB' },
  { n: '07', zh: '訊號送出', en: 'SIGNAL OUT', num: '2026', cap: 'TUN9I.COM' },
  { n: '07', zh: '訊號簡史', en: 'FROM NOISE TO A BEAM OF LIGHT', num: '2026', cap: 'TUN9I.COM' },
];

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const easeK = (f) => lerp(f, f * f * (3 - 2 * f), 0.72);

// 暗角 + 底片顆粒(在色調映射之前、線性空間)
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.55 }, uGrain: { value: 0.035 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uVig; uniform float uGrain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - 0.5) * vec2(1.25, 1.0);
      c.rgb *= mix(1.0 - uVig, 1.0, smoothstep(0.82, 0.18, length(d)));
      c.rgb += (h(vUv * 1733.0 + fract(uTime) * 91.0) - 0.5) * uGrain;
      gl_FragColor = c;
    }`,
};

export function mountWorld(stage, { reduced = false, hud = null } = {}) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mobile = coarse || innerWidth <= 860;

  // ---------- renderer + 後製 ----------
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' });
  const PR = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.75);
  renderer.setPixelRatio(PR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x050407, 1);
  const canvas = renderer.domElement;
  canvas.className = 'world-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050407, 20, 90);
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 900);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(PR);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), mobile ? 0.8 : 0.95, 0.55, 0.16);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  // ---------- 光:黑底上只有一點點環境光,讓金屬底座有輪廓 ----------
  scene.add(new THREE.AmbientLight(0x2a2233, 0.9));
  const key = new THREE.DirectionalLight(0xbfb2d9, 0.5);
  key.position.set(-10, 20, 16);
  scene.add(key);
  const headLight = new THREE.PointLight(0xffb35c, 40, 14, 1.6);
  scene.add(headLight);

  // ---------- 場景 ----------
  const film = buildFilm({ mobile });
  scene.add(film.root);
  const A = film.anim;

  // ---------- 訊號:主線(會「長」)+ 原始雜訊(一直在、一直抖) ----------
  const STEP = mobile ? 0.08 : 0.05;
  const mainPts = [];
  for (let x = X.inlet; x <= X.end + 1e-6; x += STEP) mainPts.push(new THREE.Vector3(x, signalY(x), 0));
  const mainX0 = X.inlet, NM = mainPts.length;
  const signal = fatLine(mainPts, (p, c) => eraColor(p.x, c), mobile ? 2.2 : 2.8, { k: 2.6 });
  scene.add(signal);
  // 光束那段:同一條訊號,更粗更亮
  const beamPts = mainPts.filter((p) => p.x >= X.lamp);
  const beam = fatLine(beamPts, (p, c) => eraColor(p.x, c), mobile ? 5 : 7, { k: 3.2 });
  scene.add(beam);

  const NN = mobile ? 300 : 480;
  const noisePts = [];
  for (let i = 0; i < NN; i++) {
    const x = X.start + ((X.inlet - X.start) * i) / (NN - 1);
    noisePts.push(new THREE.Vector3(x, 0, 0));
  }
  const noise = fatLine(noisePts, (p, c) => eraColor(p.x, c), mobile ? 1.8 : 2.2, { k: 2.2 });
  scene.add(noise);
  const noiseBuf = noise.geometry.attributes.instanceStart.data; // [x0 y0 z0 x1 y1 z1] × 段數
  function updateNoise(t) {
    const arr = noiseBuf.array;
    for (let i = 0; i < NN - 1; i++) {
      arr[i * 6 + 1] = noiseY(noisePts[i].x, t);
      arr[i * 6 + 4] = noiseY(noisePts[i + 1].x, t);
    }
    noiseBuf.needsUpdate = true;
  }

  // 訊號頭:一顆亮點 + 跟著走的點光源
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  scene.add(head);

  // ---------- HUD ----------
  const labelEls = [];
  if (hud) {
    for (const L of film.labels) {
      const el = document.createElement('div');
      el.className = 'film-label' + (L.small ? ' is-small' : '');
      el.innerHTML = `<i></i><b></b>${L.en ? '<span></span>' : ''}`;
      el.querySelector('b').textContent = L.zh;
      if (L.en) el.querySelector('span').textContent = L.en;
      if (L.col) el.style.setProperty('--dot', '#' + new THREE.Color(L.col).getHexString());
      hud.labels.appendChild(el);
      labelEls.push({ el, L, shown: false });
    }
  }

  // ---------- 捲動 → s ----------
  const K = KEYS.map((k) => ({ ...k, Fv: new THREE.Vector3(...k.F), Ov: new THREE.Vector3(...k.O) }));
  let anchors = K.map((_, i) => i);
  let sTarget = 0, sView = 0;
  function layout() {
    const vh = innerHeight;
    const maxYc = Math.max(1, document.documentElement.scrollHeight - vh) + vh / 2;
    anchors = K.map((k) => {
      const el = document.getElementById(k.id);
      if (!el) return vh / 2;
      const r = el.getBoundingClientRect();
      return clamp(r.top + scrollY + k.f * r.height, vh / 2, maxYc);
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
    if (reduced) { sView = s; draw(0); }
  }

  let vw = 0, vhh = 0;
  function resize() {
    const w = innerWidth, h = innerHeight;
    if (coarse && vw && w === vw && Math.abs(h - vhh) < 140) return; // 手機網址列伸縮不重建
    vw = w; vhh = h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    scene.traverse((o) => { if (o.material && o.material.isLineMaterial) o.material.resolution.set(w, h); });
  }

  // ---------- 每一幀 ----------
  let time = 0, hudIdx = -1, hudTimer = 0;
  const cam = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3(), c3 = new THREE.Color(), proj = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();
  const WHITE = new THREE.Color(1, 1, 1);

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
    }, reduced ? 0 : 220);
  }

  function draw(dt) {
    const s = sView;
    const i = Math.min(K.length - 2, Math.floor(s));
    const e = easeK(clamp(s - i));
    const k0 = K[i], k1 = K[i + 1];
    const aspect = innerWidth / innerHeight;
    const pull = Math.pow(Math.max(1, 1.0 / aspect), 0.85); // 直向畫面把攝影機往後拉

    // 攝影機
    look.lerpVectors(k0.Fv, k1.Fv, e);
    cam.copy(k0.Fv).addScaledVector(k0.Ov, pull).lerp(tmp.copy(k1.Fv).addScaledVector(k1.Ov, pull), e);
    if (!reduced) { cam.x += Math.sin(time * 0.21) * 0.12; cam.y += Math.sin(time * 0.17 + 1) * 0.08; } // 手持的一點點呼吸
    camera.position.copy(cam);
    camera.lookAt(look);
    const dist = cam.distanceTo(look);
    scene.fog.near = dist + 6;
    scene.fog.far = dist + 75;

    // 訊號頭 + 主線生長
    const hx = lerp(k0.hx, k1.hx, e);
    const hy = hx < X.inlet ? 0 : signalY(hx);
    head.position.set(hx, hy, 0);
    eraColor(hx, c3);
    head.material.color.copy(c3).lerp(WHITE, 0.55).multiplyScalar(4); // 注意:lerp 要傳 Color,傳 Vector3 會得 NaN
    head.scale.setScalar(Math.max(1, dist / 14));
    headLight.position.set(hx, hy + 0.6, 0.8);
    headLight.color.copy(c3);
    signal.geometry.instanceCount = clamp(Math.floor((hx - mainX0) / STEP), 0, NM - 1);
    const beamOn = clamp((hx - X.lamp) / STEP, 0, beamPts.length - 1);
    beam.geometry.instanceCount = Math.floor(beamOn);
    beam.visible = beamOn > 0;
    A.beamGlow.material.opacity = 0.32 * clamp((hx - X.lamp) / 8) * (reduced ? 1 : 0.9 + 0.1 * Math.sin(time * 13));

    // 原始雜訊:一直在抖
    updateNoise(reduced ? 0 : time);

    // 真空管:極板微微閃
    A.plate.material.opacity = 0.45 + (reduced ? 0 : Math.sin(time * 7.3) * 0.05 + Math.sin(time * 19) * 0.03);

    // 證照台階:訊號經過才亮
    for (const st of A.steps) {
      const on = clamp((hx - st.x + 2) / 2);
      st.edge.material.transparent = true;
      st.edge.material.opacity = 0.25 + 0.75 * on;
      st.node.scale.setScalar(0.4 + on * (1 + (reduced ? 0 : 0.15 * Math.sin(time * 4 + st.x))));
    }
    // AI 節點:訊號跳過去時亮一下
    A.aiNodes.forEach((n, j) => {
      const near = Math.exp(-Math.pow((hx - (X.ai0 + j * X.aiStep)) / 1.6, 2));
      n.scale.setScalar(1 + near * 0.8 + (reduced ? 0 : 0.08 * Math.sin(time * 3 + j)));
    });
    // 晶片:訊號走到哪一塊,那塊的電路就亮
    for (const d of A.dies) {
      const near = Math.exp(-Math.pow((hx - d.x) / 7, 2));
      d.traces.material.transparent = true;
      d.traces.material.opacity = 0.3 + 0.7 * near;
      if (d.sweep) d.sweep.rotation.y = -time * 1.4;
    }
    // 等化器
    {
      const { mesh, N } = A.bars;
      const amp = Math.exp(-Math.pow((hx - 137) / 12, 2));
      for (let b = 0; b < N; b++) {
        const h = 0.25 + amp * (0.6 + 0.9 * Math.abs(Math.sin(time * (2.1 + (b % 5) * 0.7) + b * 1.7)) * (0.5 + 0.5 * Math.sin(b * 0.6 + time)));
        mat4.makeScale(1, h, 1).setPosition(X.play0 + 1 + b * 0.8, -1.6 + h / 2, -5);
        mesh.setMatrixAt(b, mat4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    // 16 核心:在跑的核心一直閃
    {
      const act = Math.exp(-Math.pow((hx - X.rig) / 9, 2));
      for (let j = 0; j < 16; j++) {
        const f = 0.35 + act * (0.9 + (reduced ? 0.4 : 0.9 * Math.max(0, Math.sin(time * (3 + (j % 4)) + j * 2.3))));
        A.cores.setColorAt(j, c3.setHex(0x8d6cff).multiplyScalar(f * 0.62));
      }
      A.cores.instanceColor.needsUpdate = true;
    }
    A.dust.position.y = reduced ? 0 : Math.sin(time * 0.08) * 0.4;

    grade.uniforms.uTime.value = time;
    composer.render(dt);

    // HUD:章節 / 年份跟著最近的影格;標註用同一個投影定位
    if (hud) {
      setHud(Math.round(clamp(s, 0, K.length - 1)));
      eraColor(look.x, c3);
      hud.root.style.setProperty('--era', '#' + c3.getHexString());
      const w = innerWidth, h = innerHeight;
      for (const it of labelEls) {
        const { L, el } = it;
        const vis = clamp((s - L.s0) / 0.35) * clamp((L.s1 - s) / 0.35);
        if (vis <= 0.01) { if (it.shown) { el.style.opacity = '0'; it.shown = false; } continue; }
        proj.copy(L.pos).project(camera);
        if (proj.z > 1 || Math.abs(proj.x) > 1.1 || Math.abs(proj.y) > 1.1) { el.style.opacity = '0'; it.shown = false; continue; }
        el.style.transform = `translate3d(${((proj.x + 1) / 2) * w}px, ${((1 - proj.y) / 2) * h}px, 0)`;
        el.style.opacity = String(vis * 0.82);
        it.shown = true;
      }
    }
  }

  // ---------- 迴圈 ----------
  let raf = 0, last = performance.now(), running = false;
  const frameGap = mobile ? 1000 / 34 : 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < frameGap) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    sView += (sTarget - sView) * (1 - Math.exp(-dt * 5.5));
    if (Math.abs(sTarget - sView) < 1e-4) sView = sTarget;
    draw(dt);
  }
  const start = () => { if (running || reduced) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', layout, { passive: true });
  addEventListener('orientationchange', layout);
  addEventListener('load', layout, { once: true });
  addEventListener('langchange', () => requestAnimationFrame(layout));
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

  if (/[?&]worlddebug\b/.test(location.search)) {
    // 截圖 QA:預覽窗格在背景時 rAF 會降頻,settle() 直接把狀態推到終點再畫一幀
    window.__world = {
      get s() { return sView; }, anchors: () => anchors.slice(), K, scene, bloom, film, signal, beam, noise, head,
      // 掃描場景輸出裡的 NaN / Inf(bloom 會把它們擴散成黑色方塊)
      scanBad() {
        const w = 360, h = Math.round(360 / camera.aspect);
        const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType });
        renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
        const buf = new Float32Array(w * h * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
        rt.dispose();
        let bad = 0, maxV = 0, at = null;
        for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (!Number.isFinite(v)) { bad++; if (!at) at = [((i >> 2) % w) / w, 1 - Math.floor((i >> 2) / w) / h]; } else if (v > maxV) maxV = v; }
        return { bad, maxV, at };
      },
      settle() { readScroll(); sView = sTarget; time += 0.016; draw(0.016); },
    };
  }
}
