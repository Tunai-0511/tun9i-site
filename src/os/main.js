// tun9i.com/os/ — 作業系統博物館
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '../styles/tokens.css';
import '../styles/base.css';
import './os.css';

import { SYSTEMS, byId } from './systems.js';
import { Machine, KEY } from './machine.js';
import * as store from './store.js';
import { initI18n, t, onLang } from './i18n.js';
import { ICON } from './icons.js';

// 作者模式(只有 dev server):開到想要的樣子後用 __os.save() 存成開機快照。
//   ?author       從硬碟冷開機
//   ?author=snap  從目前的開機快照開始改(例如整理桌面)
const AUTHOR_MODE = new URLSearchParams(location.search).get('author');
const AUTHOR = import.meta.env.DEV && AUTHOR_MODE !== null;
const COLD = AUTHOR && AUTHOR_MODE !== 'snap';
// 開發時的預覽窗格常被判定成「切走分頁」;加 ?awake 就不自動暫停,方便測試
const AWAKE = import.meta.env.DEV && new URLSearchParams(location.search).has('awake');
const TOUCH = matchMedia('(pointer: coarse)').matches;
const MB = 1024 * 1024;

const $ = (id) => document.getElementById(id);
const els = {
  machine: $('machine'), switch: $('switch'), stage: $('stage'), screen: $('screen'),
  overlay: $('overlay'), hint: $('hint'), status: $('status'), statusText: $('status-text'),
  mips: $('meter-mips'), net: $('meter-net'), tools: $('tools'), about: $('about'),
  hudName: $('hud-name'), hudSpec: $('hud-spec'), hudRes: $('hud-res'), softkb: $('softkb'),
};

const app = {
  sys: null,
  machine: null,
  phase: 'idle',       // idle | loading | running | paused | saving | error
  gen: 0,              // 每次切換、重開 +1;還在路上的舊開機看到號碼不對就自己收掉
  started: false,      // 這次造訪開過機之後,切換分頁就直接開機,不再停在「開機」按鈕
  dirty: false,        // 上次存檔之後有沒有再跑過
  autoPaused: false,   // 分頁被切走時自動暫停的
  progress: null,      // { label, loaded, total }
  error: null,
  saved: {},           // id → { savedAt }
};

// 切換、重開、存檔全部排成一列依序做,避免兩台電腦同時在開機或存檔
let chain = Promise.resolve();
const serial = (fn) => (chain = chain.then(fn, fn).catch((e) => console.error(e)));

// ---------- 小工具 ----------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}
const fmtMB = (bytes) => (bytes / MB >= 10 ? Math.round(bytes / MB) : (bytes / MB).toFixed(1));
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return t('time.now');
  if (m < 60) return t('time.min', { n: m });
  if (m < 60 * 24) return t('time.hour', { n: Math.round(m / 60) });
  return t('time.day', { n: Math.round(m / 1440) });
}

let hintTimer = 0;
function hint(text, ms = 2600) {
  clearTimeout(hintTimer);
  els.hint.textContent = text;
  els.hint.classList.add('is-on');
  hintTimer = setTimeout(() => els.hint.classList.remove('is-on'), ms);
}

// ---------- 分頁(選系統) ----------
function renderTabs() {
  els.switch.replaceChildren(...SYSTEMS.map((sys, i) => {
    const on = sys === app.sys;
    return h('button', {
      type: 'button', role: 'tab', id: `tab-${sys.id}`, class: 'osm-tab',
      'aria-selected': on ? 'true' : 'false', 'aria-controls': 'machine', tabindex: on ? '0' : '-1',
      onclick: () => { cancelLoading(); serial(() => select(sys.id, { boot: app.started })); },
    },
      h('span', { class: 'osm-tab-idx' }, String(i + 1).padStart(2, '0')),
      h('span', { class: 'osm-tab-name' }, sys.name,
        app.saved[sys.id] ? h('i', { class: 'osm-tab-dot', title: `${t('tab.saved')} · ${ago(app.saved[sys.id].savedAt)}` }) : null,
        app.saved[sys.id] ? h('span', { class: 'sr-only' }, `(${t('tab.saved')})`) : null),
      h('span', { class: 'osm-tab-line' }, t(`os.${sys.id}.lineage`)),
    );
  }));
}

// 方向鍵在分頁之間移動(ARIA tabs 的慣例)
els.switch.addEventListener('keydown', (e) => {
  const i = SYSTEMS.indexOf(app.sys);
  let j = null;
  if (e.key === 'ArrowRight') j = (i + 1) % SYSTEMS.length;
  if (e.key === 'ArrowLeft') j = (i - 1 + SYSTEMS.length) % SYSTEMS.length;
  if (e.key === 'Home') j = 0;
  if (e.key === 'End') j = SYSTEMS.length - 1;
  if (j == null) return;
  e.preventDefault();
  const id = SYSTEMS[j].id;
  cancelLoading();
  serial(() => select(id, { boot: app.started })).then(() => $(`tab-${id}`)?.focus());
});

// ---------- 介紹 ----------
function renderAbout() {
  const sys = app.sys;
  const k = (key) => t(`os.${sys.id}.${key}`);
  const tips = k('tips');
  const facts = [
    ['about.since', String(sys.since)],
    ['about.version', sys.version],
    ['about.license', sys.license],
    ['about.memory', `${sys.memory / MB} MB`],
    sys.stateBytes ? ['about.download', `≈ ${fmtMB(sys.stateBytes)} MB`] : null,
  ].filter(Boolean);
  els.about.replaceChildren(
    h('div', { class: 'osm-about-head' },
      h('p', { class: 'osm-eyebrow' }, k('lineage')),
      h('h2', { class: 'osm-about-title' }, sys.name, sys.distro ? h('span', {}, ` · ${sys.distro}`) : null),
      h('p', { class: 'osm-about-tagline' }, k('tagline')),
    ),
    h('div', { class: 'osm-about-grid' },
      h('div', { class: 'osm-about-body' },
        h('p', {}, k('body')),
        Array.isArray(tips) ? [h('h3', {}, t('about.tips')), h('ul', {}, tips.map((x) => h('li', {}, x)))] : null,
      ),
      h('aside', { class: 'osm-about-side' },
        h('dl', { class: 'osm-facts' }, facts.map(([label, val]) => h('div', {}, h('dt', {}, t(label)), h('dd', {}, val)))),
        h('p', { class: 'osm-links' },
          h('a', { href: sys.homepage, target: '_blank', rel: 'noopener' }, t('about.home'), h('span', { html: ICON.out, 'aria-hidden': 'true' })),
          h('a', { href: sys.source, target: '_blank', rel: 'noopener' }, t('about.source'), h('span', { html: ICON.out, 'aria-hidden': 'true' })),
        ),
      ),
    ),
  );
}

function renderHud() {
  const sys = app.sys;
  els.hudName.textContent = sys.distro ? `${sys.name} · ${sys.distro}` : sys.name;
  els.hudSpec.textContent = `i686 · ${sys.memory / MB} MB`;
}

// ---------- 狀態與遮罩 ----------
function setPhase(phase) {
  app.phase = phase;
  els.machine.dataset.phase = phase;
  els.screen.style.backgroundImage = app.sys ? `url(${app.sys.poster})` : '';
  fit();
  els.statusText.textContent = t(`status.${phase}`);
  renderOverlay();
  renderTools();
}

function renderOverlay() {
  const sys = app.sys;
  const o = els.overlay;
  const p = app.phase;
  o.hidden = p === 'running';
  if (p === 'running') return o.replaceChildren();

  if (p === 'idle') {
    const saved = app.saved[sys.id];
    const big = h('button', { type: 'button', class: 'osm-power', onclick: () => serial(() => start()) },
      h('span', { class: 'osm-power-icon', html: ICON.power, 'aria-hidden': 'true' }),
      h('span', {}, saved ? t('overlay.resume') : t('overlay.boot')));
    o.replaceChildren(h('div', { class: 'osm-card' },
      h('p', { class: 'osm-card-eyebrow' }, t(`os.${sys.id}.lineage`)),
      h('p', { class: 'osm-card-name' }, sys.name),
      big,
      saved
        ? h('p', { class: 'osm-card-note' }, t('overlay.saved', { t: ago(saved.savedAt) }), ' · ',
          h('button', { type: 'button', class: 'osm-linkbtn', onclick: () => serial(() => restart()) }, t('overlay.fresh')))
        : sys.stateBytes ? h('p', { class: 'osm-card-note' }, t('overlay.size', { n: fmtMB(sys.stateBytes) })) : null,
      TOUCH ? h('p', { class: 'osm-card-note osm-card-warn' }, t('overlay.mobile')) : null,
    ));
    return;
  }
  if (p === 'loading') {
    const pr = app.progress ?? {};
    const frac = pr.total ? Math.min(1, pr.loaded / pr.total) : null;
    o.replaceChildren(h('div', { class: 'osm-card osm-card-loading' },
      h('p', { class: 'osm-card-name' }, sys.name),
      h('div', { class: `osm-bar-track${frac == null ? ' is-indeterminate' : ''}`, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': frac == null ? null : Math.round(frac * 100) },
        h('i', { style: frac == null ? null : `transform: scaleX(${frac})` })),
      h('p', { class: 'osm-card-note' }, pr.label ?? '', pr.total ? `  ${fmtMB(pr.loaded)} / ${fmtMB(pr.total)} MB` : ''),
    ));
    return;
  }
  if (p === 'saving') {
    o.replaceChildren(h('div', { class: 'osm-card osm-card-loading' },
      h('div', { class: 'osm-bar-track is-indeterminate' }, h('i')),
      h('p', { class: 'osm-card-note' }, t('overlay.saving', { name: sys.name }))));
    return;
  }
  if (p === 'paused') {
    o.replaceChildren(h('button', { type: 'button', class: 'osm-card osm-card-paused', onclick: () => serial(resume) },
      h('span', { class: 'osm-power-icon', html: ICON.play, 'aria-hidden': 'true' }),
      h('span', { class: 'osm-card-name' }, t('overlay.paused')),
      h('span', { class: 'osm-card-note' }, t('overlay.clickResume'))));
    return;
  }
  if (p === 'error') {
    o.replaceChildren(h('div', { class: 'osm-card' },
      h('p', { class: 'osm-card-name' }, t('overlay.errorTitle')),
      h('p', { class: 'osm-card-note' }, app.error ?? ''),
      h('button', { type: 'button', class: 'osm-power', onclick: () => serial(() => start()) },
        h('span', { class: 'osm-power-icon', html: ICON.restart, 'aria-hidden': 'true' }), h('span', {}, t('overlay.retry')))));
  }
}

// ---------- 工具列 ----------
let confirmRestartUntil = 0;
let popover = null;

function tool(id, icon, label, onclick, { text = false, disabled = false, pressed = null } = {}) {
  return h('button', {
    type: 'button', class: `osm-tool${text ? ' is-text' : ''}`, id: `tool-${id}`, 'data-tip': label,
    'aria-label': label, disabled, 'aria-pressed': pressed == null ? null : String(pressed),
    onclick: (e) => { e.stopPropagation(); onclick(e); },
  }, text ? h('span', {}, text) : h('span', { html: icon, 'aria-hidden': 'true' }));
}

function renderTools() {
  const live = app.phase === 'running' || app.phase === 'paused';
  const running = app.phase === 'running';
  const confirming = Date.now() < confirmRestartUntil;
  // replaceChildren 會把 null 變成字串 "null",條件式按鈕要先濾掉
  els.tools.replaceChildren(...[
    app.phase === 'paused'
      ? tool('pause', ICON.play, t('tool.resume'), () => serial(resume))
      : tool('pause', ICON.pause, t('tool.pause'), () => serial(pause), { disabled: !running }),
    h('button', {
      type: 'button', class: `osm-tool${confirming ? ' is-danger' : ''}`, id: 'tool-restart',
      'data-tip': confirming ? t('tool.restartConfirm') : t('tool.restart'),
      'aria-label': confirming ? t('tool.restartConfirm') : t('tool.restart'), disabled: !live,
      onclick: (e) => {
        e.stopPropagation();
        if (Date.now() < confirmRestartUntil) { confirmRestartUntil = 0; serial(() => restart()); return; }
        confirmRestartUntil = Date.now() + 3000;
        renderTools();
        setTimeout(renderTools, 3050);
      },
    }, h('span', { html: ICON.restart, 'aria-hidden': 'true' })),
    h('span', { class: 'osm-tools-sep', 'aria-hidden': 'true' }),
    tool('cad', null, t('tool.cad'), () => { app.machine?.press(KEY.ctrl, KEY.alt, KEY.del); refocus(); }, { text: 'Ctrl Alt Del', disabled: !running }),
    tool('keys', ICON.keys, t('tool.keys'), (e) => togglePopover('keys', e.currentTarget), { disabled: !running }),
    tool('type', ICON.type, t('tool.type'), (e) => togglePopover('type', e.currentTarget), { disabled: !running }),
    TOUCH ? tool('softkb', ICON.keyboard, t('tool.softkb'), () => els.softkb.focus(), { disabled: !running }) : null,
    h('span', { class: 'osm-tools-sep', 'aria-hidden': 'true' }),
    TOUCH ? null : tool('mouse', ICON.mouse, t('tool.mouse'), () => lockMouse(), { disabled: !running }),
    tool('shot', ICON.camera, t('tool.shot'), screenshot, { disabled: !live }),
    tool('full', ICON.full, t('tool.full'), fullscreen, { disabled: !live }),
  ].filter(Boolean));
  if (popover && !live) closePopover();
}

const COMBOS = [
  ['Esc', [KEY.esc]], ['Tab', [KEY.tab]], ['Win', [KEY.win]],
  ['Alt + Tab', [KEY.alt, KEY.tab]], ['Alt + F4', [KEY.alt, KEY.f4]], ['Ctrl + Esc', [KEY.ctrl, KEY.esc]],
];

function togglePopover(kind, anchor) {
  if (popover?.kind === kind) return closePopover();
  closePopover();
  let panel;
  if (kind === 'keys') {
    panel = h('div', { class: 'osm-pop osm-pop-keys', role: 'menu' },
      COMBOS.map(([label, keys]) => h('button', {
        type: 'button', role: 'menuitem', class: 'osm-key',
        onclick: () => { app.machine?.press(...keys); closePopover(); refocus(); },
      }, label)));
  } else {
    const input = h('textarea', { class: 'osm-type-input', rows: '3', placeholder: t('type.placeholder'), 'aria-label': t('tool.type') });
    const send = () => {
      const text = input.value;
      if (!text) return;
      app.machine?.type(text);
      closePopover();
      refocus();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
      if (e.key === 'Escape') closePopover();
    });
    panel = h('div', { class: 'osm-pop osm-pop-type' },
      input,
      h('div', { class: 'osm-pop-row' },
        h('span', { class: 'osm-pop-note' }, t('type.note')),
        h('button', { type: 'button', class: 'osm-pop-send', onclick: send }, t('type.send'))));
    setTimeout(() => input.focus(), 0);
  }
  anchor.setAttribute('aria-expanded', 'true');
  els.machine.append(panel);
  const a = anchor.getBoundingClientRect();
  const m = els.machine.getBoundingClientRect();
  panel.style.right = `${Math.max(8, m.right - a.right)}px`;
  panel.style.bottom = `${m.bottom - a.top + 10}px`;
  popover = { kind, panel, anchor };
}

function closePopover() {
  if (!popover) return;
  popover.panel.remove();
  popover.anchor.setAttribute('aria-expanded', 'false');
  popover = null;
}
addEventListener('mousedown', (e) => { if (popover && !popover.panel.contains(e.target)) closePopover(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && popover) closePopover(); });

function refocus() {
  if (app.phase === 'running') els.screen.focus({ preventScroll: true });
}

// v86 在客體系統有絕對座標滑鼠驅動(VMware 後門)時會把游標藏起來;那時不需要鎖定
const absoluteMouse = () => els.screen.style.cursor === 'none';
function lockMouse() {
  if (app.phase !== 'running' || TOUCH) return;
  els.screen.focus({ preventScroll: true });
  els.screen.requestPointerLock?.()?.catch?.(() => {});
}

function screenshot() {
  const canvas = app.machine?.canvas;
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `${app.sys.id}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    hint(t('hint.copied'));
  }, 'image/png');
}

async function fullscreen() {
  if (document.fullscreenElement) return document.exitFullscreen();
  try {
    await els.machine.requestFullscreen({ navigationUI: 'hide' });
    // Chrome 全螢幕時可以把 Esc、Win、Alt+Tab 也攔下來送進客體系統
    await navigator.keyboard?.lock?.().catch(() => {});
    refocus();
  } catch {}
}

// ---------- 畫面縮放 ----------
// 還沒開機(或還在載入)時用快照的解析度與待機截圖撐住版面,開機後改跟著客體系統的解析度
function fit() {
  if (!app.sys) return;
  const c = ['running', 'paused', 'saving'].includes(app.phase) ? app.machine?.canvas : null;
  const [cw, ch] = c?.width && c?.height ? [c.width, c.height] : app.sys.screen;
  const style = getComputedStyle(els.stage);
  const w = els.stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const hgt = els.stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  let s = Math.min(w / cw, hgt / ch);
  if (s >= 2) s = Math.floor(s); // 放大到兩倍以上就用整數倍,像素才不會糊
  els.screen.style.width = `${Math.floor(cw * s)}px`;
  els.screen.style.height = `${Math.floor(ch * s)}px`;
  els.screen.classList.toggle('is-pixelated', s >= 2);
  els.hudRes.textContent = `${cw} × ${ch}`;
}
new ResizeObserver(fit).observe(els.stage);
let canvasWatch = null;

// ---------- 儀表:MIPS、磁碟流量 ----------
let meterTimer = 0;
let lastIns = 0;
let lastT = 0;
let netBytes = 0;
try { performance.setResourceTimingBufferSize(4000); } catch {}
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) if (e.name.includes('/os/disk/')) netBytes += e.encodedBodySize || e.transferSize || 0;
  els.net.textContent = fmtMB(netBytes);
  if (performance.getEntriesByType('resource').length > 3000) performance.clearResourceTimings();
}).observe({ type: 'resource', buffered: true });

function startMeters() {
  clearInterval(meterTimer);
  lastIns = app.machine.instructions();
  lastT = performance.now();
  meterTimer = setInterval(() => {
    if (!app.machine) return;
    const now = performance.now();
    const ins = app.machine.instructions();
    let d = ins - lastIns;
    if (d < 0) d += 2 ** 32;
    const mips = app.phase === 'running' ? d / ((now - lastT) / 1000) / 1e6 : 0;
    els.mips.textContent = mips ? Math.round(mips) : '—';
    lastIns = ins;
    lastT = now;
  }, 1000);
}
function stopMeters() {
  clearInterval(meterTimer);
  els.mips.textContent = '—';
}

// ---------- 開機、切換、存檔 ----------
async function select(id, { boot = false } = {}) {
  const sys = byId(id) ?? SYSTEMS[0];
  if (app.sys === sys && (app.machine || !boot)) return;
  app.gen++;
  await shutdown();
  app.sys = sys;
  if (location.hash !== `#${sys.id}`) history.replaceState(null, '', `${location.pathname}${location.search}#${sys.id}`);
  renderTabs();
  renderAbout();
  renderHud();
  if (boot) await start();
  else setPhase('idle');
}

// 正在載入快照的那台直接丟掉(還沒跑過,沒有進度要存),讓排在後面的切換馬上開始
function cancelLoading() {
  if (app.phase !== 'loading' || !app.machine) return;
  app.gen++;
  const m = app.machine;
  app.machine = null;
  m.destroy();
}

async function shutdown() {
  const m = app.machine;
  if (!m) return;
  app.machine = null;
  stopMeters();
  canvasWatch?.disconnect();
  closePopover();
  if (document.pointerLockElement) document.exitPointerLock();
  if (app.dirty && (app.phase === 'running' || app.phase === 'paused')) {
    setPhase('saving');
    await m.stop();
    await persist(m);
  }
  await m.destroy();
}

async function persist(m) {
  if (AUTHOR) return;
  try {
    const state = await m.saveState();
    await store.save(m.sys.id, m.sys.snapshot, state);
    app.saved[m.sys.id] = { savedAt: Date.now() };
    app.dirty = false;
    renderTabs();
  } catch (e) {
    console.warn('save failed', e);
    hint(t('hint.saveFailed'), 4000);
  }
}

async function start({ fresh = false } = {}) {
  const gen = app.gen;
  const sys = app.sys;
  app.started = true;
  app.error = null;
  let state = null;
  if (COLD) state = 'cold';
  else if (!fresh && !AUTHOR) state = (await store.load(sys.id, sys.snapshot))?.state ?? null;
  if (gen !== app.gen) return;

  bringIntoView();
  app.progress = {
    label: state === 'cold' ? t('overlay.cold') : state ? t('overlay.restoreSaved') : t('overlay.download'),
    loaded: 0,
    total: state ? 0 : sys.stateBytes,
  };
  setPhase('loading');

  const m = new Machine(sys, els.screen);
  app.machine = m;
  let failure = null;
  // 記憶體配置失敗之類的錯誤是 v86 內部丟出來的,不會經過 boot() 的 promise。
  // 只把這類致命的當真;像音效 worklet 載不起來這種,電腦照樣能開,不要因此整台判死
  const fatal = (err) => err instanceof RangeError || /memory|allocat|WebAssembly|wasm/i.test(String(err?.message ?? err));
  const onError = (e) => {
    const err = e.reason ?? e.error ?? e;
    if (fatal(err)) failure = err;
    else console.warn('v86 (non-fatal):', err);
  };
  addEventListener('unhandledrejection', onError);
  addEventListener('error', onError);
  let watch = 0;
  try {
    const ok = await Promise.race([
      m.boot(state, (e) => {
        if (gen !== app.gen || !String(e.file_name ?? '').includes('/state/')) return;
        app.progress.loaded = e.loaded;
        if (e.total) app.progress.total = e.total;
        if (e.total && e.loaded >= e.total) app.progress.label = t('overlay.restore');
        renderOverlay();
      }),
      new Promise((_, reject) => {
        watch = setInterval(() => { if (failure) reject(failure); }, 200);
      }),
    ]);
    if (!ok || gen !== app.gen) {
      if (app.machine === m) app.machine = null;
      await m.destroy();
      return;
    }
  } catch (e) {
    if (gen !== app.gen) return;
    console.error(e);
    app.machine = null;
    await m.destroy();
    const msg = String(e?.message ?? e);
    app.error = /memory|allocat|RangeError/i.test(msg) || e instanceof RangeError
      ? t('overlay.errorMemory', { n: sys.memory / MB })
      : /download|fetch|network/i.test(msg) ? t('overlay.errorNet') : t('overlay.errorOther', { msg });
    setPhase('error');
    return;
  } finally {
    clearInterval(watch);
    removeEventListener('unhandledrejection', onError);
    removeEventListener('error', onError);
  }

  canvasWatch?.disconnect();
  canvasWatch = new MutationObserver(fit);
  canvasWatch.observe(m.canvas, { attributes: true, attributeFilter: ['width', 'height'] });
  await m.run();
  if (gen !== app.gen) return;
  app.dirty = true;
  setPhase('running');
  fit();
  startMeters();
  if (document.hidden && !AWAKE && !AUTHOR) {
    await m.stop();
    app.autoPaused = true;
    setPhase('paused');
    return;
  }
  // 焦點還在網頁本身(剛按的「開機」按鈕已經消失)才交給畫面;在分頁上就留給方向鍵切換
  const active = document.activeElement;
  if (!TOUCH && (!active || active === document.body || els.overlay.contains(active))) {
    els.screen.focus({ preventScroll: true });
  } else if (active === els.screen) {
    m.setKeyboard(true);
  }
  hint(t('hint.focus'));
}

// 開機時把整台電腦(含上下 HUD)捲到頂列下面;已經在畫面裡就不動
function bringIntoView() {
  const r = els.machine.getBoundingClientRect();
  if (r.top >= 56 && r.bottom <= innerHeight + 4) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  els.machine.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' }); // html 有 scroll-behavior: smooth,'auto' 也會平滑
}

async function restart() {
  app.gen++;
  const m = app.machine;
  app.machine = null;
  stopMeters();
  if (m) await m.destroy();
  await store.remove(app.sys.id);
  delete app.saved[app.sys.id];
  renderTabs();
  await start({ fresh: true });
}

async function pause() {
  if (app.phase !== 'running') return;
  await app.machine.stop();
  setPhase('paused');
}

async function resume() {
  if (app.phase !== 'paused' || !app.machine) return;
  app.autoPaused = false;
  await app.machine.run();
  app.dirty = true;
  setPhase('running');
  refocus();
}

// ---------- 輸入焦點 ----------
// 鍵盤只在畫面有焦點時才送進客體系統;點到網頁其他地方就還給網頁
els.screen.addEventListener('focus', () => { app.machine?.setKeyboard(true); els.stage.classList.add('is-focused'); });
els.screen.addEventListener('blur', () => { app.machine?.setKeyboard(false); els.stage.classList.remove('is-focused'); });
els.screen.addEventListener('mousedown', () => {
  if (app.phase !== 'running') return;
  els.screen.focus({ preventScroll: true });
  if (!absoluteMouse() && !document.pointerLockElement) lockMouse();
});
els.softkb.addEventListener('focus', () => app.machine?.setKeyboard(true));
els.softkb.addEventListener('blur', () => { if (document.activeElement !== els.screen) app.machine?.setKeyboard(false); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) hint(t('hint.lock'));
});

// 切走分頁:暫停並存檔;回來就繼續
document.addEventListener('visibilitychange', () => serial(async () => {
  if (AWAKE || AUTHOR) return;
  if (document.hidden) {
    if (app.phase !== 'running') return;
    await app.machine.stop();
    app.autoPaused = true;
    setPhase('paused');
    if (app.dirty) await persist(app.machine);
  } else if (app.autoPaused && app.phase === 'paused') {
    await resume();
  }
}));

addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (byId(id) && byId(id) !== app.sys) {
    cancelLoading();
    serial(() => select(id, { boot: app.started }));
  }
});

onLang(() => {
  if (!app.sys) return; // initI18n() 第一次套用語言時還沒選系統,select() 之後自己會畫
  renderTabs();
  renderAbout();
  renderHud();
  els.statusText.textContent = t(`status.${app.phase}`);
  renderOverlay();
  renderTools();
});

// ---------- 啟動 ----------
initI18n();
serial(async () => {
  for (const sys of SYSTEMS) {
    const rec = await store.peek(sys.id);
    if (rec && rec.snapshot === sys.snapshot) app.saved[sys.id] = { savedAt: rec.savedAt };
  }
  await select(location.hash.slice(1), { boot: false });
});

if (AUTHOR) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__os = {
    app,
    get m() { return app.machine; },
    // 把目前這台的狀態存成開機快照:先在瀏覽器裡 gzip(整包 512 MB 直接上傳會把分頁撐爆),
    // dev server 收到後寫成 .os-images/states/<snapshot>.bin.gz,再由 scripts/os-pack-state.mjs 轉成 zstd
    async save() {
      const st = await app.machine.saveState();
      const gz = await new Response(new Blob([st]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
      const res = await fetch(`/__os/state/${app.sys.snapshot}.bin.gz`, { method: 'POST', body: gz });
      return `${res.status} raw ${(st.byteLength / MB).toFixed(1)} MB → gz ${(gz.size / MB).toFixed(1)} MB`;
    },
    // 滑鼠按鍵(0 左、1 中、2 右),給客體系統用相對座標滑鼠時做快照前的整理
    async click(button = 0) {
      const b = [false, false, false];
      b[button] = true;
      app.machine.emu.bus.send('mouse-click', b);
      await sleep(90);
      app.machine.emu.bus.send('mouse-click', [false, false, false]);
    },
    sleep,
  };
}
