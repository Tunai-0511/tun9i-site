// 黑洞篇的零件 —— 所有刻字都刻在「探測器的硬體」上:陽極處理的金色銘板、鈦合金面板、太空站的模組。
// 這裡集中材質與幾個共用的造型(銘板、標示牌、引線、螺絲),場景只管擺位置與寫字,外觀才會一致。
//
// 單位:史瓦西半徑 r_s = 1。銘板大約 2–5 個單位寬,鏡頭在 5–10 個單位外讀它。

import * as THREE from 'three';
import * as P from '../parts.js';
import { eraSoft, era } from '../era.js';

const m4 = new THREE.Matrix4();

// 皺皺的金色隔熱毯(MLI):法線貼圖用 canvas 畫一堆不規則的摺痕
function crinkleNormal() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = 'rgb(128,128,255)';
  x.fillRect(0, 0, 256, 256);
  const r = P.rng(23);
  for (let i = 0; i < 420; i++) {
    const cx = r() * 256, cy = r() * 256, a = r() * Math.PI, L = 10 + r() * 46;
    const nx = Math.round(128 + Math.cos(a + 1.57) * 70 * (r() - 0.5) * 2), ny = Math.round(128 + Math.sin(a + 1.57) * 70 * (r() - 0.5) * 2);
    x.strokeStyle = `rgba(${nx},${ny},235,0.55)`;
    x.lineWidth = 2 + r() * 7;
    x.beginPath();
    x.moveTo(cx - Math.cos(a) * L, cy - Math.sin(a) * L);
    x.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 太陽能板:深藍的電池格 + 銀色匯流排
function solarTex(cols = 8, rows = 4) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#c8ccd4'; x.fillRect(0, 0, 512, 256);
  const cw = 512 / cols, ch = 256 / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const g = x.createLinearGradient(i * cw, j * ch, (i + 1) * cw, (j + 1) * ch);
    g.addColorStop(0, '#0d1a3a'); g.addColorStop(1, '#081128');
    x.fillStyle = g;
    x.fillRect(i * cw + 3, j * ch + 3, cw - 6, ch - 6);
    x.fillStyle = 'rgba(160,175,210,0.18)';
    for (let k = 1; k < 4; k++) x.fillRect(i * cw + 3, j * ch + 3 + (k * (ch - 6)) / 4, cw - 6, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeKit(ctx) {
  const { etch, recolor } = ctx;
  const M = {
    gold: new THREE.MeshStandardMaterial({ color: 0xc49a55, metalness: 0.85, roughness: 0.38, roughnessMap: P.brushedTex([2, 1]) }),
    // 深色的鈦:刻字(加法發光)要壓得過它,太亮的金屬會讓字被吸積盤的反光洗掉
    // 正對鏡頭的牌子會把主光直接反射回鏡頭(像閃光燈拍金屬)→ 金屬度壓低、粗糙一點
    // (拉絲的粗糙度貼圖會把整體粗糙度拉低一半,所以這裡不用它)
    titan: new THREE.MeshStandardMaterial({ color: 0x121418, metalness: 0.25, roughness: 0.78, envMapIntensity: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0a0b0e, metalness: 0.5, roughness: 0.3, envMapIntensity: 0.4 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x3a3d45, metalness: 0.9, roughness: 0.3 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xcfcac0, metalness: 0.1, roughness: 0.62 }),
    foil: new THREE.MeshStandardMaterial({ color: 0xc89a3e, metalness: 1, roughness: 0.26, normalMap: crinkleNormal(), normalScale: new THREE.Vector2(0.9, 0.9) }),
    solar: new THREE.MeshStandardMaterial({ color: 0xffffff, map: solarTex(), metalness: 0.45, roughness: 0.22 }),
    bolt: new THREE.MeshStandardMaterial({ color: 0x8c8f96, metalness: 1, roughness: 0.25 }),
  };
  // 共用的發光材質:顏色跟著章節色,換色票時一起換
  const glows = [];
  function glow(ch, mul = 2, white = 0.25) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(), toneMapped: true });
    const f = () => eraSoft(ch, white, m.color).multiplyScalar(mul);
    recolor.push(f); f();
    glows.push(m);
    return m;
  }
  function lineMat(ch, opacity = 0.7, white = 0.3) {
    const m = new THREE.LineBasicMaterial({ color: new THREE.Color(), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const f = () => eraSoft(ch, white, m.color);
    recolor.push(f); f();
    return m;
  }
  const textColor = (ch, white = 0.45) => {
    const c = new THREE.Color();
    const f = () => eraSoft(ch, white, c);
    recolor.push(f); f();
    return c;
  };

  // 銘板:一片有倒角的金屬板 + 四顆螺絲 + 刻字(+z 那面)。back:背面也刻字(從背後看是正的)
  // edge:左側一條發光色條(重點項目才加)
  function plate({ name, w, h, d = 0.05, r = 0.035, mat = M.titan, ch = 0, res = 260, intensity = 1.2, white = 0.45, draw, back = null, bolts = true, edge = false }) {
    const g = new THREE.Group();
    g.name = 'plate:' + name;
    const slab = P.mesh(P.rbox(w, h, d, r, 2), mat, 0, 0, 0, g);
    slab.name = name + ':slab';
    const out = { g, slab };
    if (draw) {
      out.b = etch.block({ name, w, h, res, color: textColor(ch, white), intensity, draw });
      out.b.mesh.position.z = d / 2 + 0.002;
      g.add(out.b.mesh);
    }
    if (back) {
      out.back = etch.block({ name: name + ':back', w, h, res: back.res ?? res, color: textColor(back.ch ?? ch, back.white ?? white), intensity: back.intensity ?? intensity, draw: back.draw });
      out.back.mesh.position.z = -d / 2 - 0.002;
      out.back.mesh.rotation.y = Math.PI;
      g.add(out.back.mesh);
    }
    if (bolts) {
      const k = Math.min(w, h) * 0.045, s = Math.min(0.045, k * 0.5);
      const list = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        list.push([sx * (w / 2 - k), sy * (h / 2 - k), d / 2 + 0.004]);
        if (back) list.push([sx * (w / 2 - k), sy * (h / 2 - k), -d / 2 - 0.004]);
      }
      const geo = new THREE.CylinderGeometry(s, s, 0.012, 12);
      geo.rotateX(Math.PI / 2);
      const im = new THREE.InstancedMesh(geo, M.bolt, list.length);
      list.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); im.setMatrixAt(i, m4); });
      g.add(im);
    }
    if (edge) {
      const e = P.mesh(new THREE.BoxGeometry(0.03, h * 0.82, 0.012), glow(ch, 2.4, 0.15), -w / 2 + 0.06, 0, d / 2 + 0.006, g);
      e.name = name + ':edge';
      out.edge = e;
    }
    return out;
  }

  // 引線:從物件上的一點拉到標示牌(兩端各一個小點)。update(a, b) 每幀可以改端點
  function leader(ch, opacity = 0.65) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, lineMat(ch, opacity));
    line.frustumCulled = false;
    line.renderOrder = 4;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), glow(ch, 2.2, 0.3));
    const g = new THREE.Group();
    g.add(line, dot);
    const pos = geo.attributes.position;
    return {
      g, line, dot,
      set(a, b, dotR = 0.04) {
        pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z); pos.needsUpdate = true;
        dot.position.copy(a); dot.scale.setScalar(dotR);
      },
    };
  }

  // 一圈軌道(橢圓):在 xz 平面畫好,再用 quaternion 轉到它的軌道面
  function orbitLine({ a, e = 0, ch = 2, opacity = 0.55, seg = 256, white = 0.3 }) {
    const b = a * Math.sqrt(1 - e * e), c = a * e;
    const pts = [];
    for (let i = 0; i <= seg; i++) { const th = (i / seg) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(th) * a - c, 0, Math.sin(th) * b)); }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, lineMat(ch, opacity, white));
    line.frustumCulled = false;
    return line;
  }

  return { M, glow, lineMat, textColor, plate, leader, orbitLine, era, eraSoft };
}

// 球座標 → 位置:r(r_s)、方位角 az(度,0 = +z,往 +x 轉)、仰角 el(度,往 +y)
export const sph = (r, az, el, out = new THREE.Vector3()) => {
  const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
  return out.set(r * Math.cos(e) * Math.sin(a), r * Math.sin(e), r * Math.cos(e) * Math.cos(a));
};

// 鏡頭鍵:鏡頭在 C、看向 T → 引擎要的 { T, O }
export const camKey = (name, C, T, extra = {}) => ({ name, T: T.clone(), O: C.clone().sub(T), ...extra });

// 從鏡頭 C 看向 T 時,畫面上 (sx, sy) 那一點、在 depth 遠的世界座標。
// sx、sy 以 16:9 畫面的半寬、半高為 1(垂直視角 35°);窄一點的螢幕左右會切掉一些,所以 |sx| 別超過 0.65。
const TAN = Math.tan((17.5 * Math.PI) / 180);
export function screenAt(C, T, sx, sy, depth, out = new THREE.Vector3()) {
  const f = T.clone().sub(C).normalize();
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const u = new THREE.Vector3().crossVectors(r, f);
  const hh = depth * TAN, hw = hh * (16 / 9);
  return out.copy(C).addScaledVector(f, depth).addScaledVector(r, sx * hw).addScaledVector(u, sy * hh);
}
// 從 C 看向黑洞左邊 ang 度的地方(黑洞落在畫面右側);回傳看的那一點(距離 dist)
export function besideHole(C, ang, dist = 2, lift = 0, out = new THREE.Vector3()) {
  const h = C.clone().negate().normalize();
  const right = new THREE.Vector3().crossVectors(h, new THREE.Vector3(0, 1, 0)).normalize();
  const a = (ang * Math.PI) / 180;
  const d = h.multiplyScalar(Math.cos(a)).addScaledVector(right, -Math.sin(a)).add(new THREE.Vector3(0, lift, 0)).normalize();
  return out.copy(C).addScaledVector(d, dist);
}
// 那個鏡頭的朝向(讓牌子正對它)
export function facing(C, T, out = new THREE.Quaternion()) {
  const m = new THREE.Matrix4().lookAt(C, T, new THREE.Vector3(0, 1, 0));
  return out.setFromRotationMatrix(m);
}
