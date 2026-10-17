// 一台 v86 電腦的生命週期:建立 → 還原快照 → 執行 → 存檔 → 銷毀。
// 一次只開一台(每台要 512 MB 的 WebAssembly 記憶體),切換時舊的存檔後整台丟掉。

import wasmUrl from 'v86/build/v86.wasm?url';
import biosUrl from './bios/seabios.bin?url';
import vgaBiosUrl from './bios/vgabios.bin?url';
import { stateUrl } from './systems.js';

let libPromise = null;
const loadLib = () => (libPromise ??= import('v86').then((m) => m.V86));

// PS/2 第一組掃描碼。延伸鍵寫成 [0xe0, code]。
export const KEY = {
  esc: 0x01, tab: 0x0f, enter: 0x1c, ctrl: 0x1d, shift: 0x2a, alt: 0x38, space: 0x39,
  f1: 0x3b, f2: 0x3c, f4: 0x3e, f5: 0x3f, f10: 0x44, f11: 0x57, f12: 0x58,
  del: [0xe0, 0x53], win: [0xe0, 0x5b], menu: [0xe0, 0x5d], prtsc: [0xe0, 0x37],
};

// 美式鍵盤:字元 → [掃描碼, 要不要按 Shift]
const US_KEYS = (() => {
  const map = {};
  const row = (chars, codes, shifted) => [...chars].forEach((c, i) => { map[c] = [codes[i], shifted]; });
  const letters = 'qwertyuiopasdfghjklzxcvbnm';
  const letterCodes = [0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x31, 0x32];
  row(letters, letterCodes, false);
  row(letters.toUpperCase(), letterCodes, true);
  const top = [0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d];
  row('1234567890-=', top, false);
  row('!@#$%^&*()_+', top, true);
  const punct = [0x1a, 0x1b, 0x27, 0x28, 0x29, 0x2b, 0x33, 0x34, 0x35];
  row("[];'`\\,./", punct, false);
  row('{}:"~|<>?', punct, true);
  map[' '] = [0x39, false];
  map['\n'] = [0x1c, false];
  map['\t'] = [0x0f, false];
  return map;
})();

export class Machine {
  constructor(sys, screen) {
    this.sys = sys;
    this.screen = screen;
    this.emu = null;
    this.destroyed = false;
  }

  // state: ArrayBuffer(訪客存檔)| null(用伺服器上的開機快照)| 'cold'(不用快照,從磁碟冷開機)
  async boot(state, onProgress) {
    const V86 = await loadLib();
    if (this.destroyed) return false;

    // v86 會沿用容器裡第一個 div(文字模式)和第一個 canvas(圖形模式)
    const text = document.createElement('div');
    text.className = 'osm-textmode';
    const canvas = document.createElement('canvas');
    this.screen.replaceChildren(text, canvas);
    this.text = text;
    this.canvas = canvas;

    const MB = 1024 * 1024;
    const options = {
      wasm_path: wasmUrl,
      memory_size: this.sys.memory,
      vga_memory_size: 8 * MB,
      screen: { container: this.screen, use_graphical_text: true },
      bios: { url: biosUrl },
      vga_bios: { url: vgaBiosUrl },
      acpi: this.sys.acpi,
      net_device: { type: this.sys.net ?? 'ne2k' },
      mac_address_translation: true,
      autostart: false,
    };
    // 磁碟:硬碟映像或磁片(KolibriOS 整套系統就是一張 1.44 MB 的磁片)
    if (this.sys.hda) options.hda = { ...this.sys.hda };
    if (this.sys.fda) options.fda = { ...this.sys.fda };
    if (state instanceof ArrayBuffer) options.initial_state = { buffer: state };
    else if (state !== 'cold') options.initial_state = { url: stateUrl(this.sys) };

    const emu = new V86(options);
    this.emu = emu;
    emu.add_listener('emulator-loaded', () => {
      this.loaded = true;
      // 先不收鍵盤:游標在網頁上的按鈕時,空白鍵、Enter 不該跑進客體系統。
      // (鍵盤轉接器要到載入完才存在,太早呼叫等於沒做)
      emu.keyboard_set_enabled(false);
    });

    const loaded = await new Promise((resolve, reject) => {
      // 載入中被 destroy()(訪客換台)就馬上回報,不要等快照下載完
      this.abortBoot = () => resolve(false);
      emu.add_listener('emulator-loaded', () => resolve(true));
      emu.add_listener('download-error', (e) => reject(new Error(`download ${e?.file_name ?? ''}`)));
      emu.add_listener('download-progress', (e) => onProgress?.(e));
    });
    this.abortBoot = null;
    return loaded && !this.destroyed;
  }

  run() { return this.emu?.run(); }

  // 靜音用混音器的主音量(dB):不像 AudioContext.suspend 會在每次 run() 被 v86 自己 resume 回來
  setMuted(on) {
    const bus = this.emu?.bus;
    if (!bus) return;
    bus.send('mixer-gain-left', on ? -200 : 0);
    bus.send('mixer-gain-right', on ? -200 : 0);
  }
  stop() { return this.emu?.stop(); }
  get running() { return !!this.emu?.is_running(); }

  async saveState() {
    const wasRunning = this.running;
    await this.stop();
    const state = await this.emu.save_state();
    if (wasRunning && !this.destroyed) await this.run();
    return state;
  }

  instructions() {
    try { return this.emu?.get_instruction_counter() ?? 0; } catch { return 0; }
  }

  setKeyboard(on) { this.emu?.keyboard_set_enabled(on); }

  // 依序按下、反序放開
  press(...keys) {
    if (!this.emu) return;
    const make = [];
    const brk = [];
    for (const k of keys) {
      const [pre, code] = Array.isArray(k) ? k : [null, k];
      if (pre) make.push(pre);
      make.push(code);
      brk.unshift(...(pre ? [pre, code | 0x80] : [code | 0x80]));
    }
    this.emu.keyboard_send_scancodes([...make, ...brk]);
  }

  // v86 的 keyboard_send_text 在鍵盤停用(畫面沒焦點)時會被吞掉,
  // 而從網頁上的輸入框送字時畫面一定沒焦點 —— 所以自己照美式鍵盤轉成掃描碼,一個字一個字送
  async type(text) {
    for (const ch of text.replace(/\r\n?/g, '\n')) {
      if (!this.emu) return;
      const key = US_KEYS[ch];
      if (!key) continue;
      const [code, shift] = key;
      this.emu.keyboard_send_scancodes(shift
        ? [0x2a, code, code | 0x80, 0xaa]
        : [code, code | 0x80]);
      await new Promise((r) => setTimeout(r, 12));
    }
  }

  async destroy() {
    this.destroyed = true;
    this.abortBoot?.();
    const emu = this.emu;
    this.emu = null;
    // 只拿掉自己的畫面元素:新的那台可能已經把它的 canvas 放進同一個容器了
    this.text?.remove();
    this.canvas?.remove();
    if (!emu) return;
    if (!this.loaded) {
      // v86 還在初始化。現在 destroy 會失敗,而它之後照樣會把鍵盤滑鼠監聽掛到 window 上 ——
      // 等它自己載完(或下載失敗)再收掉
      const later = () => { emu.destroy().catch(() => {}); };
      emu.add_listener('emulator-loaded', later);
      emu.add_listener('download-error', later);
      return;
    }
    try { await emu.stop(); } catch {}
    try { await emu.destroy(); } catch {}
  }
}
