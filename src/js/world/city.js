// 晶片城市 —— 背景的「整體」。
//
// 整個畫面是一座一望無際的晶片城:上萬顆電晶體方塊、街道上的發光走線、
// 細格線的晶片底座。film.js 的地標(真空管、台階、AI 節點、晶片、核心、透鏡)
// 是城裡各街區的中心,訊號沿著中央大道穿過它們。
//
// 城市的光全部在著色器裡算(一次 draw call,上萬顆方塊也不卡),由幾個共用 uniform 驅動:
//   uHead   訊號頭的 x —— 它經過的街區整片亮起來,而且不會再暗(狀態是累積的)
//   uCursor 游標投在地面上的位置 —— 一盞跟著滑鼠走的光
//   uPulse  點擊發出的脈衝(最多 6 個)—— 一圈一圈往外擴散的波
// 真空管以前的「原始雜訊區」不會被點亮,只會亂閃:還沒被處理過的訊號就長那樣。

import * as THREE from 'three';
import { X, paletteStops } from './film.js';
import { STOP_X } from './palettes.js';

export const MAX_PULSES = 6;

// 所有城市著色器共用的光照函式
const LIGHT_GLSL = /* glsl */ `
  uniform float uHead;
  uniform float uTime;
  uniform vec2 uCursor;
  uniform float uCursorOn;
  uniform vec4 uPulse[${MAX_PULSES}];
  uniform vec3 uStops[${STOP_X.length}];
  // 色溫:跟 film.js 的 eraColor 同一條漸層,由目前色票決定
  vec3 eraTint(float x) {
    float xs[${STOP_X.length}] = float[${STOP_X.length}](${STOP_X.map((v) => v.toFixed(1)).join(', ')});
    if (x <= xs[0]) return uStops[0];
    for (int i = 0; i < ${STOP_X.length - 1}; i++) {
      if (x <= xs[i + 1]) return mix(uStops[i], uStops[i + 1], (x - xs[i]) / (xs[i + 1] - xs[i]));
    }
    return uStops[${STOP_X.length - 1}];
  }
  // 注意:GLSL 的 smoothstep 要求 edge0 < edge1,反過來寫是「未定義行為」(有的 GPU 會整個算反)
  float cityLit(float x) { return (1.0 - smoothstep(uHead - 5.0, uHead + 1.5, x)) * smoothstep(-3.0, 1.0, x); }
  // 波前:只往訊號頭「後面」拖長,前面(訊號還沒到的地方)幾乎不亮
  float cityFront(float x) { float d = (x - uHead) / (x < uHead ? 3.2 : 0.7); return exp(-d * d) * smoothstep(-3.0, 1.0, x); }
  float cityRaw(float x) { return 1.0 - smoothstep(-6.0, 0.0, x); }
  float cityCursor(vec2 p) { vec2 d = p - uCursor; return uCursorOn * exp(-dot(d, d) / 22.0); }
  float cityPulse(vec2 p) {
    float s = 0.0;
    for (int i = 0; i < ${MAX_PULSES}; i++) {
      vec4 q = uPulse[i];
      float age = uTime - q.z;
      if (age > 0.0 && age < 3.4) {
        float d = length(p - q.xy) - age * 17.0;
        s += exp(-d * d / 0.9) * (1.0 - age / 3.4) * q.w; // 窄的波環,才看得出是「一圈」
      }
    }
    return s;
  }
  float cityHash(float n) { return fract(sin(n) * 43758.5453); }
`;

export function makeCityUniforms() {
  return {
    uHead: { value: -2 },
    uTime: { value: 0 },
    uCursor: { value: new THREE.Vector2(-999, -999) },
    uCursorOn: { value: 0 },
    uPulse: { value: Array.from({ length: MAX_PULSES }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uStops: { value: paletteStops }, // 同一批 Color 物件:換色票時原地改值,城市自動跟著變
    uFogNear: { value: 30 },
    uFogFar: { value: 120 },
  };
}

// ---------- 地標周圍要留空(不長方塊) ----------
function keepClear(x, z) {
  if (Math.abs(z) < 2.6) return true; // 中央大道
  if (x > 17 && x < 45 && Math.abs(z) < 3.8) return true; // 證照台階
  if (x > 46.5 && x < 70.5 && z > -5.8 && z < 2.8) return true; // AI 基板
  for (const d of [X.dieA, X.dieB, X.dieC]) if (Math.abs(x - d) < 4.6 && Math.abs(z) < 4.6) return true;
  if (x > 126 && x < 148 && z > -6.2 && z < 3.4) return true; // 諧波 + 等化器
  if (Math.abs(x - X.rig) < 6 && Math.abs(z) < 6) return true; // 16 核心
  if (Math.abs(x - X.lamp) < 3.2 && Math.abs(z) < 3.2) return true; // 透鏡
  return false;
}

// 平滑的值雜訊(決定城市的天際線)
function hash2(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function buildCity({ mobile = false, U }) {
  const root = new THREE.Group();
  const S = mobile ? 1.7 : 1.2; // 格距
  const X0 = -46, X1 = 276, Z0 = -36, Z1 = 16;
  const nx = Math.floor((X1 - X0) / S), nz = Math.floor((Z1 - Z0) / S);
  const STREET_X = 8, STREET_Z = 6;

  // ---------- 方塊 ----------
  const cells = [];
  for (let i = 0; i < nx; i++) {
    if (i % STREET_X === 0) continue;
    for (let j = 0; j < nz; j++) {
      if (j % STREET_Z === 0) continue;
      const x = X0 + (i + 0.5) * S, z = Z0 + (j + 0.5) * S;
      if (keepClear(x, z)) continue;
      const r = hash2(i * 1.3, j * 2.7);
      let h = 0.18 + 1.45 * Math.pow(vnoise(x * 0.09, z * 0.09), 2.2) + 0.25 * r;
      const tower = hash2(i * 7.1, j * 3.3) < 0.035 && z < -3;
      if (tower) h = 2.4 + hash2(j, i) * 3.2;
      // 靠近大道、以及攝影機這一側(z>0)的方塊壓低,才不會擋到地標
      h *= 0.35 + 0.65 * Math.min(1, (Math.abs(z) - 2.6) / 7);
      if (z > 0) h = Math.min(h, 0.75);
      const w = S * (0.62 + 0.22 * hash2(i * 5.7, j * 1.9));
      cells.push([x, z, h, w, r]);
    }
  }
  const N = cells.length;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const seed = new Float32Array(N);
  const mat4 = new THREE.Matrix4();
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x14111b, metalness: 0.55, roughness: 0.42 });
  const blocks = new THREE.InstancedMesh(box, blockMat, N);
  cells.forEach(([x, z, h, w, r], k) => {
    mat4.makeScale(w, h, w).setPosition(x, h / 2, z);
    blocks.setMatrixAt(k, mat4);
    seed[k] = r * 97.0 + k * 0.013;
  });
  box.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  blockMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = `attribute float aSeed;
      varying float vSeed; varying vec3 vCityW; varying float vTopN; varying float vLocalY; varying vec2 vFaceUv;
      ` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vSeed = aSeed; vTopN = normal.y; vLocalY = position.y + 0.5; vFaceUv = uv;
        vCityW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;`);
    sh.fragmentShader = `varying float vSeed; varying vec3 vCityW; varying float vTopN; varying float vLocalY; varying vec2 vFaceUv;
      ${LIGHT_GLSL}
      ` + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float x = vCityW.x;
          float lit = cityLit(x), front = cityFront(x), raw = cityRaw(x);
          float cur = cityCursor(vCityW.xz), pls = cityPulse(vCityW.xz);
          // 頂面像晶片的單元格:一圈細邊 + 內嵌的方塊
          vec2 e = min(vFaceUv, 1.0 - vFaceUv);
          float edge = min(e.x, e.y);
          float rim = 1.0 - smoothstep(0.05, 0.1, edge);
          float core = smoothstep(0.2, 0.24, edge) * step(0.45, cityHash(vSeed * 3.1));
          float top = step(0.5, vTopN);
          // 已點亮的街區裡,有些方塊在「運算」:隨機閃
          float tick = floor(uTime * (0.8 + fract(vSeed) * 2.5) + vSeed);
          float busy = step(0.82, cityHash(vSeed + tick * 7.13));
          // 原始雜訊區:高頻亂閃,沒有秩序
          float noisy = step(0.94, cityHash(vSeed + floor(uTime * 9.0 + vSeed) * 3.7)) * raw;
          float g = top * (rim * (0.05 + lit * 0.55 + front * 1.6) + core * (lit * (0.25 + 0.9 * busy) + front * 1.2))
                  + top * (noisy * (0.25 + 0.3 * rim) + (cur * 1.1 + pls * 1.1) * (0.3 + rim + core))
                  + (1.0 - top) * vLocalY * (lit * 0.05 + front * 0.35 + cur * 0.25 + pls * 0.3);
          totalEmissiveRadiance += eraTint(x) * g;
        }`);
  };
  blocks.frustumCulled = false;
  root.add(blocks);

  // ---------- 走線:沿著每一條街 ----------
  const lp = [];
  for (let i = 0; i <= nx; i += STREET_X) { const x = X0 + i * S; lp.push(x, 0.02, Z0, x, 0.02, Z1); }
  for (let j = 0; j <= nz; j += STREET_Z) { const z = Z0 + j * S; if (Math.abs(z) < 2.6) continue; lp.push(X0, 0.02, z, X1, 0.02, z); }
  // 中央大道兩側的匯流排
  for (const z of [-2.2, 2.2]) lp.push(X0, 0.03, z, X1, 0.03, z);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  const traceMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vW; varying float vDepth;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vW; varying float vDepth; uniform float uFogNear; uniform float uFogFar;
      ${LIGHT_GLSL}
      void main(){
        float lit = cityLit(vW.x), front = cityFront(vW.x);
        // 已點亮的走線上有資料封包在跑
        float along = abs(vW.z) > 2.0 ? vW.x : vW.z * 3.0 + vW.x;
        float packet = pow(max(0.0, sin(along * 0.9 - uTime * 6.0)), 18.0) * lit;
        float g = 0.06 + lit * 0.32 + front * 1.4 + packet * 1.6 + cityCursor(vW.xz) * 1.1 + cityPulse(vW.xz) * 1.5;
        float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
        gl_FragColor = vec4(eraTint(vW.x) * g * fog, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  root.add(new THREE.LineSegments(lineGeo, traceMat));

  // ---------- 地面:晶片底座 + 細格線 ----------
  const groundGeo = new THREE.PlaneGeometry(X1 - X0 + 60, Z1 - Z0 + 60);
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate((X0 + X1) / 2, -0.01, (Z0 + Z1) / 2);
  const groundMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vW; varying float vDepth;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vW; varying float vDepth; uniform float uFogNear; uniform float uFogFar;
      ${LIGHT_GLSL}
      float gridLine(vec2 p, float s, float w){ vec2 g = abs(fract(p / s - 0.5) - 0.5) * s; return 1.0 - smoothstep(0.0, w, min(g.x, g.y)); }
      void main(){
        float lit = cityLit(vW.x);
        float fine = gridLine(vW.xz, 0.6, 0.02) * 0.5 + gridLine(vW.xz, 3.0, 0.035);
        float light = 0.05 + lit * 0.12 + cityCursor(vW.xz) * 0.6 + cityPulse(vW.xz) * 0.55;
        vec3 base = vec3(0.022, 0.018, 0.03);
        vec3 tint = eraTint(vW.x);
        vec3 col = base + tint * fine * light + tint * cityCursor(vW.xz) * 0.08;
        float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
        gl_FragColor = vec4(col * fog, 1.0);
      }`,
  });
  root.add(new THREE.Mesh(groundGeo, groundMat));

  // ---------- 游標的光環(貼在地面上) ----------
  const ringTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(64, 64, 20, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  })();
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: ringTex, color: new THREE.Color(0xffe2b0).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  root.add(ring);

  return { root, blocks, ring, count: N };
}
