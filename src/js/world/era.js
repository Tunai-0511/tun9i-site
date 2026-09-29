// 色溫 = 章節。八個色標對應八個章節(00 開場 … 07 聯絡),由目前的色票決定。
// 換色票時原地改這批 Color 物件,所有讀它的著色器與材質在下一幀自動跟上。

import * as THREE from 'three';
import { PALETTES, DEFAULT_PALETTE } from './palettes.js';

export const CHAPTERS = 8;
export const STOPS = Array.from({ length: CHAPTERS }, () => new THREE.Color());
export const METAL = new THREE.Color();
export const WHITE = new THREE.Color(1, 1, 1);

export function paletteColors(key) {
  const P = PALETTES[key] || PALETTES[DEFAULT_PALETTE];
  return { stops: P.stops.map((h) => new THREE.Color(h)), metal: new THREE.Color(P.metal) };
}
export function setPaletteColors({ stops, metal }) {
  stops.forEach((c, i) => STOPS[i].copy(c));
  METAL.copy(metal);
}
setPaletteColors(paletteColors(DEFAULT_PALETTE));

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
// c:章節(可以是小數,兩章之間內插)
export function era(c, out = new THREE.Color()) {
  const x = clamp(c, 0, CHAPTERS - 1);
  const i = Math.min(CHAPTERS - 2, Math.floor(x));
  return out.copy(STOPS[i]).lerp(STOPS[i + 1], x - i);
}
// 帶一點白的版本(文字、亮邊):純色票在黑底上太飽和,讀起來吃力
export const eraSoft = (c, mixWhite = 0.35, out = new THREE.Color()) => era(c, out).lerp(WHITE, mixWhite);
export const metal = (out = new THREE.Color()) => out.copy(METAL);
