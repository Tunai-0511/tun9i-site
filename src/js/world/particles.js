// 粒子 —— 同一批光點會被「重組」:雜訊雲 → 聚成物件表面 → 繞著物件流動。
//
// 位置全在 GPU 算:每顆粒子帶三組座標(from / to / 自己的軌道參數),
// uMix 把它從 from 帶到 to(每顆有自己的延遲,飛行途中被亂流推開),
// uOrbit 再把它從 to 放回軌道上繞圈。游標是一條射線,靠近的粒子會被推開;
// uBurst 是點擊時的衝擊波。

import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec4 aRand;   // xyz:軌道參數 w:亮度
  uniform float uTime, uMix, uOrbit, uNoise, uSize, uSpace, uViewH, uBurst;
  uniform vec3 uOrbitC;   // 軌道中心
  uniform vec3 uOrbitR;   // 軌道半徑(x,z)與厚度(y)
  uniform vec3 uCurO, uCurD;
  uniform float uCurK, uCurR;
  varying float vA;
  vec3 jitter(vec3 p, float s) {
    return vec3(sin(p.y * 3.1 + uTime * 2.3 + s * 11.0), sin(p.z * 2.7 - uTime * 1.9 + s * 7.0), sin(p.x * 3.7 + uTime * 2.9 + s * 5.0));
  }
  void main() {
    float s = aRand.w;
    // 雜訊雲:一直在抖、而且抖得不規則
    vec3 from = aFrom + jitter(aFrom, s) * uNoise;
    // 每顆粒子自己的出發時間 → 聚合時是一波一波的,不是整團一起飛
    float d = fract(s * 7.13) * 0.45;
    float m = clamp((uMix - d) / (1.0 - 0.45), 0.0, 1.0);
    float e = m * m * (3.0 - 2.0 * m);
    vec3 p = mix(from, aTo, e);
    p += jitter(aTo * 1.7, s) * sin(3.14159 * e) * uNoise * 1.6; // 飛行途中的亂流
    // 軌道:繞中心慢慢轉,越外圈越慢
    float ang = aRand.x * 6.2832 + uTime * (0.18 + 0.12 / (0.6 + aRand.y));
    vec3 orb = uOrbitC + vec3(cos(ang) * uOrbitR.x * (0.55 + aRand.y), (aRand.z - 0.5) * uOrbitR.y + sin(ang * 2.0 + s * 6.0) * 0.15 * uOrbitR.y, sin(ang) * uOrbitR.z * (0.55 + aRand.y));
    float o = clamp((uOrbit - fract(s * 3.7) * 0.3) / 0.7, 0.0, 1.0);
    p = mix(p, orb, o * o * (3.0 - 2.0 * o));
    // 點擊衝擊波:往外炸開再回來
    p += normalize(p - uOrbitC + 1e-4) * uBurst * (0.6 + fract(s * 13.1)) * uOrbitR.x * 0.35;
    // 游標:射線附近的粒子被推開
    vec3 v = p - uCurO;
    vec3 perp = v - uCurD * dot(v, uCurD);
    float dl = length(perp);
    p += (perp / max(dl, 1e-4)) * uCurK * uCurR * exp(-dl * dl / (uCurR * uCurR)) * 0.9;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = uSize * uSpace * (0.6 + 0.8 * fract(s * 5.3));
    gl_PointSize = clamp(size * projectionMatrix[1][1] * uViewH * 0.5 / max(-mv.z, 1e-6), 1.0, 64.0);
    vA = (0.45 + 0.55 * fract(s * 9.7)) * (1.0 + 0.8 * sin(3.14159 * e));
  }`;
const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.0, 0.5, d);
    a *= a;
    gl_FragColor = vec4(uColor * vA * uAlpha, a);
  }`;

export function makeSwarm({ count, size = 0.03, color = new THREE.Color(1, 0.8, 0.5) }) {
  const g = new THREE.BufferGeometry();
  const from = new Float32Array(count * 3), to = new Float32Array(count * 3), rnd = new Float32Array(count * 4);
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) rnd.set([r(), r(), r(), r()], i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); // 不用,只為了繪製數量
  g.setAttribute('aFrom', new THREE.BufferAttribute(from, 3));
  g.setAttribute('aTo', new THREE.BufferAttribute(to, 3));
  g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
  const U = {
    uTime: { value: 0 }, uMix: { value: 0 }, uOrbit: { value: 0 }, uNoise: { value: 0.2 },
    uSize: { value: size }, uSpace: { value: 1 }, uViewH: { value: innerHeight }, uBurst: { value: 0 },
    uOrbitC: { value: new THREE.Vector3() }, uOrbitR: { value: new THREE.Vector3(3, 1, 3) },
    uCurO: { value: new THREE.Vector3(0, 0, 1e6) }, uCurD: { value: new THREE.Vector3(0, 0, -1) }, uCurK: { value: 0 }, uCurR: { value: 0.5 },
    uColor: { value: color }, uAlpha: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  const fill = (arr, fn) => {
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) { fn(i, v, r); arr.set([v.x, v.y, v.z], i * 3); }
  };
  return {
    points, U, count,
    setFrom(fn) { fill(from, fn); g.attributes.aFrom.needsUpdate = true; },
    setTo(fn) { fill(to, fn); g.attributes.aTo.needsUpdate = true; },
  };
}

// ---------- 轉場光流:鏡頭在尺度間穿梭時,光線從身邊掠過 ----------
// 掛在攝影機底下(攝影機座標),所以不管現在是哪個尺度的空間都一樣大。
export function makeWarp({ count = 260 }) {
  const g = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 2 * 4);
  let s = 3;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, rad = 0.25 + Math.pow(r(), 0.6) * 1.6, ph = r(), br = r();
    seed.set([a, rad, ph, br], i * 8);
    seed.set([a, rad, ph, br], i * 8 + 4);
  }
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) end[i * 2 + 1] = 1;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const U = { uT: { value: 0 }, uWarp: { value: 0 }, uDir: { value: 1 }, uD: { value: 1 }, uColor: { value: new THREE.Color(1, 0.8, 0.6) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed; attribute float aEnd;
      uniform float uT, uWarp, uDir, uD;
      varying float vA;
      void main() {
        // 攝影機座標:沿 -z 的隧道。uDir>0 = 往前鑽(光往身後掠過),<0 = 往後拉
        // 整條隧道乘上 uD(鏡頭到目標的距離):不管在哪個尺度,都落在 near / far 之間
        float ph = fract(aSeed.z + uT * (0.35 + aSeed.w * 0.5) * uDir);
        float z = mix(-9.0, -0.4, ph);
        float len = (0.4 + aSeed.w * 1.4) * uWarp;
        z += aEnd * len * uDir;
        vec3 p = vec3(cos(aSeed.x) * aSeed.y, sin(aSeed.x) * aSeed.y * 0.75, min(z, -0.3)) * uD;
        gl_Position = projectionMatrix * vec4(p, 1.0);
        vA = sin(3.14159 * ph) * (0.3 + 0.7 * aSeed.w) * (1.0 - aEnd * 0.85);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uWarp; varying float vA;
      void main() { gl_FragColor = vec4(uColor * vA * uWarp * 1.6, 1.0); }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(g, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 20;
  return { lines, U };
}
