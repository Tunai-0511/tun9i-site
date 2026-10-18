// 黑洞本體 —— 每個像素沿著彎曲時空追一條光線。
//
// 單位:史瓦西半徑 r_s = 1,黑洞在原點,吸積盤在 xz 平面。光走零測地線,用 RK4 積分
//   x'' = -3/2 · h² · x / r⁵   (h = |x × x'| 守恆;等價於 u'' + u = 3/2 u²)
// 這條式子跟《EVENT HORIZON》(github.com/Tunai-0511/event-horizon)的 bh.frag 同一套,只是砍成即時版:
// 薄吸積盤(Novikov–Thorne 溫度剖面、都卜勒 + 重力紅移、相對論集束)、程序星空與銀河,沒有體積模擬。
// 盤的顏色不是黑體,而是目前色票的八個色標:外圈冷 → 內圈熱 = 色票的起點 → 終點,迎面而來的那一側往終點偏、也更亮。
//
// 觀察者:鏡頭在視界外是「靜止觀察者」(光行差 + 藍移),越接近視界越像「從無窮遠自由落下」(rain frame),
// 後者穿過視界依然成立 —— 07 章就是這樣掉進去的。
//
// 互動:游標是一顆很小的黑洞(把它背後的光彎開);點一下會發出一圈重力波(四極的拉伸與擠壓)。
// 它們只作用在這層背景上:刻字的物件在前景,不會被彎。
//
// 這一層畫在一張比較小的畫布上(uRes),再放大貼到場景最底下;解析度由引擎依幀時間調整。

import * as THREE from 'three';

export const MAX_WAVES = 4;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform mat4 uProjInv;
  uniform mat4 uCamWorld;
  uniform vec3 uCam;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uDiskT;
  uniform float uFall;
  uniform vec3 uRamp[8];
  uniform float uDisk;
  uniform float uDiskIn;
  uniform float uDiskOut;
  uniform float uDiskBright;
  uniform float uSky;
  uniform float uFlash;
  uniform vec4 uCursor;          // xyz:游標方向(世界座標) w:愛因斯坦角(弧度,0 = 關)
  uniform vec4 uWave[${MAX_WAVES}];  // xyz:點擊方向 w:發出的時間
  uniform float uWaveA[${MAX_WAVES}];
  uniform int uSteps;
  uniform int uDebug;            // 1:出射方向 2:光線足跡(除錯用)

  #define PI 3.14159265
  #define TAU 6.28318531

  float H2;
  vec3 accel(vec3 x) { float r2 = dot(x, x); return -1.5 * H2 * x / (r2 * r2 * sqrt(r2)); }

  // ---- 雜湊與雜訊(全部程序產生,沒有貼圖)----
  float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float h13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
  vec3 h33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
  // x 方向週期為 per 的值雜訊(盤的角度要接得起來)
  float vnP(vec2 p, float per) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float i0 = mod(i.x, per), i1 = mod(i.x + 1.0, per);
    float a = h12(vec2(i0, i.y)), b = h12(vec2(i1, i.y)), c = h12(vec2(i0, i.y + 1.0)), d = h12(vec2(i1, i.y + 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float vn3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h13(i), h13(i + vec3(1, 0, 0)), u.x), mix(h13(i + vec3(0, 1, 0)), h13(i + vec3(1, 1, 0)), u.x), u.y),
               mix(mix(h13(i + vec3(0, 0, 1)), h13(i + vec3(1, 0, 1)), u.x), mix(h13(i + vec3(0, 1, 1)), h13(i + vec3(1, 1, 1)), u.x), u.y), u.z);
  }
  float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn3(p); p = p * 2.03 + 0.37; a *= 0.5; } return s / 0.9375; }

  // 色票:0 = 起點(暖)… 1 = 終點(冷)
  vec3 ramp(float u) {
    u = clamp(u, 0.0, 1.0) * 7.0;
    int i = int(min(floor(u), 6.0));
    return mix(uRamp[i], uRamp[i + 1], u - float(i));
  }

  // ---- 吸積盤 ----
  // 共轉的極座標(log r, 角度)上的紋理:沿軌道拉長成一條條。
  float diskTex(float lr, float a) {
    float n = vnP(vec2(a * 5.0, lr * 2.4), 5.0) * 0.44;
    n += vnP(vec2(a * 13.0, lr * 6.5 + 3.1), 13.0) * 0.28;
    n += vnP(vec2(a * 31.0, lr * 16.0 + 7.7), 31.0) * 0.17;
    n += vnP(vec2(a * 67.0, lr * 41.0 + 1.3), 67.0) * 0.11;
    return n;
  }
  // 較差自轉會把紋理越捲越細 → 兩層錯開半個週期輪流淡入淡出(flow map),永遠不會捲成雜訊
  float density(float r, float phi) {
    float lr = log(r / uDiskIn);
    float om = pow(uDiskIn / r, 1.5) * 0.055;    // 每秒幾圈(內緣 0.055 圈)
    const float P = 22.0;
    float t1 = mod(uDiskT, P), t2 = mod(uDiskT + P * 0.5, P);
    float w = 1.0 - abs(2.0 * t1 / P - 1.0);
    float a1 = fract((phi / TAU) - om * t1 + floor(uDiskT / P) * 0.37);
    float a2 = fract((phi / TAU) - om * t2 + floor(uDiskT / P + 0.5) * 0.37 + 0.5);
    float n = diskTex(lr, a1) * w + diskTex(lr + 0.73, a2) * (1.0 - w);
    float rings = vnP(vec2(0.5, lr * 7.0), 1.0);
    float d = 0.08 + 2.0 * smoothstep(0.34, 0.68, n);
    d *= 0.6 + 0.8 * smoothstep(0.25, 0.75, rings);
    return d;
  }
  float ntProf(float r) {
    float x = uDiskIn / r;
    float p = pow(x, 0.75) * pow(max(1.0 - sqrt(x), 0.0), 0.25) / 0.488;
    return r < uDiskIn ? 0.22 * smoothstep(uDiskIn * 0.9, uDiskIn, r) : p;
  }
  float gShift(float r, float Ly, float gObs) {
    float Om = sqrt(0.5 / (r * r * r));
    float ut = 1.0 / sqrt(max(1.0 - 1.5 / r, 0.02));
    return gObs / (ut * (1.0 - Om * Ly));
  }
  // order:這條光線第幾次穿過盤面。第二次以後是光子環裡越來越細的像,用平均密度就好(否則細環會變成一串點)
  vec4 diskShade(vec3 p, float Ly, float gObs, float order) {
    float r = length(p.xz);
    if (r < uDiskIn * 0.9 || r > uDiskOut) return vec4(0.0);
    float phi = atan(p.z, p.x);
    float prof = ntProf(r);
    float d = mix(density(r, phi), 0.95, smoothstep(0.5, 1.5, order));
    // 掉進去的觀察者看到的藍移可以大到幾十倍;畫面上壓在 2.4 倍以內,否則整片過曝成白色
    float g = min(gShift(r, Ly, gObs), 2.4);
    float T = prof * g;
    vec3 c = ramp(0.08 + 0.92 * smoothstep(0.08, 1.35, T));
    float edge = 1.0 - smoothstep(uDiskOut * 0.55, uDiskOut, r);
    // 相對論集束:I ∝ g³(迎面那一側亮、遠離那一側暗)
    float I = pow(prof, 1.25) * pow(g, 3.0) * d * uDiskBright * (1.0 + uFlash * 2.0 * exp(-(r - uDiskIn) / 2.5));
    float alpha = 1.0 - exp(-2.4 * d * (0.3 + prof));
    I = I / (1.0 + 0.12 * I);  // 軟性壓縮最亮的那幾格(色調映射前先收一點,bloom 才不會糊成一片)
    return vec4(c * I * edge, alpha * edge) * uDisk;
  }

  // ---- 星空:四層星等 + 銀河。依光線的足跡(fwidth)模糊,重力透鏡放大時不會閃 ----
  vec3 sky(vec3 d, float fp) {
    vec3 col = vec3(0.0);
    vec3 a = abs(d);
    vec2 uv; float face;
    if (a.x > a.y && a.x > a.z) { uv = d.yz / a.x; face = d.x > 0.0 ? 0.0 : 1.0; }
    else if (a.y > a.z) { uv = d.xz / a.y; face = d.y > 0.0 ? 2.0 : 3.0; }
    else { uv = d.xy / a.z; face = d.z > 0.0 ? 4.0 : 5.0; }
    for (int L = 0; L < 4; L++) {
      float N = L == 0 ? 22.0 : L == 1 ? 55.0 : L == 2 ? 130.0 : 300.0;
      vec2 g = (uv * 0.5 + 0.5) * N;
      vec2 id = floor(g), f = fract(g);
      vec3 h = h33(vec3(id, face * 17.0 + float(L) * 131.0));
      float cellA = 1.5708 / N;                     // 一格大約幾弧度
      float dist = length(f - (0.2 + 0.6 * h.xy)) * cellA;
      float s = max(fp * 0.75, 0.00045);
      float b = pow(h.z, 3.0) * (L == 0 ? 7.0 : L == 1 ? 2.2 : L == 2 ? 0.8 : 0.35);
      float flux = b * 0.00045 * 0.00045;
      float pt = flux / (s * s) * exp(-dist * dist / (2.0 * s * s));
      float avg = flux * 6.2832 * 0.25 / (cellA * cellA);   // 足跡比格子大:改成平均亮度
      float k = smoothstep(0.25 * cellA, 0.9 * cellA, fp);
      float tw = h.x;
      vec3 tint = mix(vec3(1.0, 0.78, 0.58), vec3(0.72, 0.84, 1.0), smoothstep(0.15, 0.85, tw));
      col += tint * mix(pt, avg, k);
    }
    // 銀河:斜斜的一條大圓,帶塵埃帶
    vec3 n = normalize(vec3(0.32, 0.86, -0.4));
    float bz = dot(d, n);
    float band = exp(-bz * bz / 0.03);
    float cl = fbm3(d * 3.5 + 1.7);
    float dust = fbm3(d * 8.0 + 4.1);
    float mw = band * (0.2 + 0.8 * smoothstep(0.3, 0.8, cl)) * (1.0 - 0.75 * smoothstep(0.48, 0.66, dust) * exp(-bz * bz / 0.004));
    col += mw * mix(vec3(0.62, 0.55, 0.5), uRamp[1] * 0.5 + 0.3, 0.25) * 0.11;
    // 很淡的宇宙背景,讓透鏡把它彎出輪廓
    col += vec3(0.006, 0.006, 0.009) * (0.6 + 0.4 * fbm3(d * 2.0));
    return col;
  }

  // 繞著 c 軸、把 v 往 c 拉近 / 推遠到角度 beta
  vec3 setAngle(vec3 v, vec3 c, float beta) {
    vec3 p = v - c * dot(v, c);
    float lp = length(p);
    if (lp < 1e-6) return v;
    return normalize(c * cos(beta) + p / lp * sin(beta));
  }

  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec4 vp = uProjInv * vec4(ndc, 1.0, 1.0);
    vec3 rd = normalize((uCamWorld * vec4(vp.xyz / vp.w, 0.0)).xyz);
    float flash = 0.0;

    // 游標:一顆很小的黑洞(點透鏡 β = θ - θE²/θ;太靠近中心的光被它吞掉)
    if (uCursor.w > 0.0) {
      vec3 cd = uCursor.xyz;
      float th = acos(clamp(dot(rd, cd), -1.0, 1.0));
      float te = uCursor.w;
      if (th < te * 0.42) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
      if (th < te * 12.0) rd = setAngle(rd, cd, th - te * te / th);
    }
    // 點擊:重力波,一圈往外擴散的四極拉伸(+ 偏振:沿一軸拉長、另一軸壓扁)
    for (int i = 0; i < ${MAX_WAVES}; i++) {
      float A = uWaveA[i];
      if (A <= 0.0) continue;
      vec3 c = uWave[i].xyz;
      float age = uTime - uWave[i].w;
      float th = acos(clamp(dot(rd, c), -1.0, 1.0));
      float R = age * 0.55;
      float x = (th - R) / 0.06;
      float env = exp(-x * x) * A * exp(-age * 0.9);
      if (env < 1e-4) continue;
      vec3 p = rd - c * dot(rd, c);
      vec3 e1 = normalize(cross(c, abs(c.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0)));
      vec3 e2 = cross(c, e1);
      float h = env * sin(x * 2.6) * 0.05;
      rd = normalize(c * dot(rd, c) + e1 * dot(p, e1) * (1.0 + h) + e2 * dot(p, e2) * (1.0 - h));
      flash += env * 0.4 * exp(-x * x * 0.5);
    }

    vec3 x = uCam;
    float r0 = length(x);
    vec3 rh = x / r0;
    float dr = dot(rd, rh);
    vec3 perp = rd - dr * rh;
    // 靜止觀察者(視界外才存在)與自由落下的觀察者,依深度混合
    float f = r0 < 1.02 ? 1.0 : uFall;
    float aS = sqrt(max(1.0 - 1.0 / r0, 1e-4));
    vec3 rdS = normalize(aS * dr * rh + perp);
    float gS = 1.0 / aS;
    float vff = sqrt(1.0 / r0);
    if (f > 0.999 && 1.0 + vff * dr <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    vec3 rdF = normalize((dr + vff) * rh + perp);
    float gF = 1.0 / max(1.0 + vff * dr, 0.02);
    vec3 v = normalize(mix(rdS, rdF, f));
    float gObs = mix(gS, gF, f);

    vec3 hv = cross(x, v);
    H2 = dot(hv, hv);
    float sinth = sqrt(H2) / r0;
    float beff = r0 / sqrt(max(1.0 / max(sinth * sinth, 1e-8) - 1.0 / r0, 1e-8));
    float Ly = -hv.y / max(sqrt(H2), 1e-8) * beff;

    vec3 col = vec3(0.0);
    float trans = 1.0;
    bool captured = false, done = false;
    float crossings = 0.0;
    float Rfar = max(60.0, r0 * 1.05);
    for (int i = 0; i < 520; i++) {
      if (i >= uSteps) break;
      float r = length(x);
      if (r < 1.002 && dot(x, v) < 0.0) { captured = true; done = true; break; }
      if (r > Rfar && dot(x, v) > 0.0) { done = true; break; }
      float sp = length(v);
      // 遠處步子大、靠近視界步子小(穿過盤面是用前後兩步的正負號偵測,不需要小步)
      float dt = clamp(0.09 * max(r - 0.55, 0.15 * r), 0.0006, 1e5) / sp;
      vec3 xo = x;
      vec3 k1v = accel(x), k1x = v;
      vec3 k2v = accel(x + 0.5 * dt * k1x), k2x = v + 0.5 * dt * k1v;
      vec3 k3v = accel(x + 0.5 * dt * k2x), k3x = v + 0.5 * dt * k2v;
      vec3 k4v = accel(x + dt * k3x), k4x = v + dt * k3v;
      x += dt / 6.0 * (k1x + 2.0 * k2x + 2.0 * k3x + k4x);
      v += dt / 6.0 * (k1v + 2.0 * k2v + 2.0 * k3v + k4v);
      if (uDisk > 0.0 && xo.y * x.y < 0.0) {
        vec3 p = mix(xo, x, xo.y / (xo.y - x.y));
        vec4 dk = diskShade(p, Ly, gObs, crossings);
        crossings += 1.0;
        col += trans * dk.rgb;
        trans *= 1.0 - dk.a;
        if (trans < 0.004) { done = true; break; }
      }
    }
    if (!done) captured = true; // 在光子球附近繞太多圈:當作被吞掉
    if (!captured && trans > 0.004) {
      vec3 dout = normalize(v);
      float fp = max(length(fwidth(dout)), 2.0 / uRes.y * 0.5);
      if (uDebug == 1) { gl_FragColor = vec4(fract(dout * 40.0), 1.0); return; }
      if (uDebug == 2) { gl_FragColor = vec4(vec3(fp * 400.0), 1.0); return; }
      // 掉進去的觀察者看到的天空是藍移的:更亮、往色票冷端偏
      float gs = clamp(gObs, 0.2, 6.0);
      vec3 s = sky(dout, fp) * uSky * min(gs * gs * sqrt(gs), 12.0);
      col += trans * mix(s, s * (ramp(0.95) * 0.6 + 0.5), smoothstep(1.3, 4.0, gs));
    }
    col += flash * ramp(0.85) * 0.25;
    if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
    gl_FragColor = vec4(min(col, vec3(60.0)), 1.0);
  }`;

// 引擎每一幀把鏡頭與狀態寫進 U,然後 render(renderer) 畫到自己的畫布上;tex 給場景底下那片背景用
export function createLens({ mobile = false } = {}) {
  const U = {
    uProjInv: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uCam: { value: new THREE.Vector3(0, 0, 40) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uDiskT: { value: 0 },
    uFall: { value: 0 },
    uRamp: { value: Array.from({ length: 8 }, () => new THREE.Color()) },
    uDisk: { value: 1 },
    uDiskIn: { value: 3 },
    uDiskOut: { value: 16 },
    uDiskBright: { value: 0.9 },
    uSky: { value: 1 },
    uFlash: { value: 0 },
    uCursor: { value: new THREE.Vector4(0, 0, -1, 0) },
    uWave: { value: Array.from({ length: MAX_WAVES }, () => new THREE.Vector4(0, 0, -1, -99)) },
    uWaveA: { value: new Array(MAX_WAVES).fill(0) },
    uSteps: { value: mobile ? 220 : 360 },
    uDebug: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

  // 場景最底下的那一片:把小畫布放大貼滿(線性 HDR,交給後製的 bloom 與色調映射)
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { tLens: { value: rt.texture } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
      fragmentShader: /* glsl */ `uniform sampler2D tLens; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tLens, vUv).rgb, 1.0); }`,
      depthTest: false, depthWrite: false,
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -1000;

  let scale = 1;
  function setSize(w, h, s = scale) {
    scale = s;
    const W = Math.max(64, Math.round(w * s)), H = Math.max(64, Math.round(h * s));
    if (rt.width !== W || rt.height !== H) rt.setSize(W, H);
    U.uRes.value.set(W, H);
  }
  function sync(camera) {
    U.uProjInv.value.copy(camera.projectionMatrixInverse);
    U.uCamWorld.value.copy(camera.matrixWorld);
    U.uCam.value.setFromMatrixPosition(camera.matrixWorld);
  }
  function render(renderer) {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    renderer.setRenderTarget(prev);
  }
  return { U, mat, bg, rt, setSize, sync, render, get scale() { return scale; } };
}
