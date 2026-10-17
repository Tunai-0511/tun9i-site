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
import { fetchSnapshot, prefetchSnapshot, dropSnapshot } from './snapshots.js';
import { initI18n, t, onLang } from './i18n.js';
import { ICON } from './icons.js';

// 作者模式(只有 dev server):開到想要的樣子後用 __os.save() 存成開機快照。
//   ?author       從硬碟冷開機
//   ?author=snap  從目前的開機快照開始改(例如放彩蛋)
const AUTHOR_MODE = new URLSearchParams(location.search).get('author');
const AUTHOR = import.meta.env.DEV && AUTHOR_MODE !== null;
const COLD = AUTHOR && AUTHOR_MODE !== 'snap';
// 開發時的預覽窗格常被判定成「切走分頁」;加 ?awake 就不自動暫停,方便測試
const AWAKE = import.meta.env.DEV && new URLSearchParams(location.search).has('awake');
const TOUCH = matchMedia('(pointer: coarse)').matches;
const MB = 1024 * 1024;

// 訪客偏好(都只是方便,讀寫失敗就當沒有)
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const PREF = { last: 'tun9i-os-last', muted: 'tun9i-os-muted', coached: 'tun9i-os-coached', unlocked: 'tun9i-os-unlocked' };

// 解鎖第五台的通關密語:四台電腦裡各藏一個字,在網頁上(不是電腦畫面裡)依序打出來
const PASSPHRASE = 'fromnoisetosignal';

const $ = (id) => document.getElementById(id);
const els = {
  machine: $('machine'), switch: $('switch'), stage: $('stage'), screen: $('screen'),
  overlay: $('overlay'), hint: $('hint'), status: $('status'), statusText: $('status-text'),
  capture: $('capture'), tools: $('tools'), about: $('about'), label: $('label'), work: $('work'),
  softkb: $('softkb'), slots: $('slots'), hunt: $('hunt'), huntState: $('hunt-state'),
};

const app = {
  sys: null,
  machine: null,
  phase: 'idle',       // idle | loading | running | paused | saving | error
  gen: 0,              // 每次切換、重開 +1;還在路上的舊開機看到號碼不對就自己收掉
  started: false,      // 這次造訪開過機之後,切換分頁就直接開機,不再停在「開機」按鈕
  dirty: false,        // 上次存檔之後有沒有再跑過
  autoPaused: false,   // 分頁被切走時自動暫停的
  progress: null,      // { label, loaded, total, rate }
  error: null,
  saved: {},           // id → { savedAt }
  muted: LS.get(PREF.muted) === '1',
  unlocked: LS.get(PREF.unlocked) === '1',
};

const visible = () => SYSTEMS.filter((s) => !s.hidden || app.unlocked);

// 切換、重開全部排成一列依序做,避免兩台電腦同時在開機
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
// 第一次開機要下載的量:開機快照,加上一次整包下載的磁片(KolibriOS)
const firstLoad = (sys) => sys.stateBytes + (sys.fda && !sys.fda.async ? sys.fda.size : 0);
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
let prefetchTimer = 0;
// 滑鼠停在分頁上(或鍵盤移到分頁上)一下下,就先把那台的開機快照抓下來
function armPrefetch(sys) {
  clearTimeout(prefetchTimer);
  if (AUTHOR || app.saved[sys.id] || pending.has(sys.id) || (sys === app.sys && app.machine)) return;
  prefetchTimer = setTimeout(() => prefetchSnapshot(sys), 180);
}

function renderTabs() {
  const list = visible();
  els.switch.style.setProperty('--tabs', list.length);
  els.switch.replaceChildren(...list.map((sys, i) => {
    const on = sys === app.sys;
    const saved = app.saved[sys.id];
    return h('button', {
      type: 'button', role: 'tab', id: `tab-${sys.id}`, class: `osm-ex${sys.hidden ? ' is-secret' : ''}`,
      'data-ex': sys.id, 'aria-selected': on ? 'true' : 'false', 'aria-controls': 'machine', tabindex: on ? '0' : '-1',
      onclick: () => { cancelLoading(); serial(() => select(sys.id, { boot: app.started })); },
      onpointerenter: () => armPrefetch(sys),
      onpointerleave: () => clearTimeout(prefetchTimer),
      onfocus: () => armPrefetch(sys),
    },
      h('span', { class: 'osm-ex-thumb' },
        h('img', { src: sys.poster, alt: '', width: sys.screen[0], height: sys.screen[1], decoding: 'async' })),
      h('span', { class: 'osm-ex-meta' },
        h('span', { class: 'osm-ex-no' }, String(i + 1).padStart(2, '0')),
        h('span', { class: 'osm-ex-name' }, sys.name,
          saved ? h('i', { class: 'osm-ex-saved', title: `${t('tab.saved')} · ${ago(saved.savedAt)}` }) : null,
          saved ? h('span', { class: 'sr-only' }, `(${t('tab.saved')})`) : null),
        h('span', { class: 'osm-ex-line' }, `${sys.since}– · ${t(`os.${sys.id}.lineage`)}`)),
    );
  }));
}

// 方向鍵在分頁之間移動(ARIA tabs 的慣例)
els.switch.addEventListener('keydown', (e) => {
  const list = visible();
  const i = list.indexOf(app.sys);
  let j = null;
  if (e.key === 'ArrowRight') j = (i + 1) % list.length;
  if (e.key === 'ArrowLeft') j = (i - 1 + list.length) % list.length;
  if (e.key === 'Home') j = 0;
  if (e.key === 'End') j = list.length - 1;
  if (j == null) return;
  e.preventDefault();
  const id = list[j].id;
  cancelLoading();
  serial(() => select(id, { boot: app.started })).then(() => $(`tab-${id}`)?.focus());
});

// ---------- 說明卡(展品旁邊那張) ----------
// 博物館的作品標籤:編號、名稱、出處與年份、一句話,再來是規格。運轉中的數字(解析度、速度、下載量)也寫在這裡。
const live = { res: '', mips: '—', net: '0' };
function renderLabel() {
  const sys = app.sys;
  const no = visible().indexOf(sys) + 1;
  const spec = (label, value, id, cls) => h('div', { class: cls }, h('dt', {}, t(label)), h('dd', { id }, value));
  els.label.replaceChildren(
    h('p', { class: 'osm-label-no' }, t('label.no', { n: String(no).padStart(2, '0') })),
    h('h2', { class: 'osm-label-name' }, sys.name),
    h('p', { class: 'osm-label-maker' }, `${t(`os.${sys.id}.lineage`)} · ${sys.since}–`),
    h('p', { class: 'osm-label-tagline' }, t(`os.${sys.id}.tagline`)),
    h('dl', { class: 'osm-label-specs' },
      spec('label.medium', t('label.mediumV')),
      spec('label.spec', `i686 · ${sys.memory / MB} MB`),
      spec('label.res', live.res || `${sys.screen[0]} × ${sys.screen[1]}`, 'label-res'),
      spec('about.version', sys.distro ? `${sys.distro} ${sys.version}` : sys.version),
      spec('about.license', sys.license),
      sys.stateBytes ? spec('about.download', `≈ ${fmtMB(firstLoad(sys))} MB`) : null,
      spec('label.speed', `${live.mips} MIPS`, 'label-mips', 'osm-label-live'),
      spec('label.loaded', `${live.net} MB`, 'label-net', 'osm-label-live')),
    h('p', { class: 'osm-label-links' },
      h('a', { href: sys.homepage, target: '_blank', rel: 'noopener' }, t('about.home'), h('span', { html: ICON.out, 'aria-hidden': 'true' })),
      h('a', { href: sys.source, target: '_blank', rel: 'noopener' }, t('about.source'), h('span', { html: ICON.out, 'aria-hidden': 'true' }))),
  );
}
function setLive(key, value) {
  live[key] = value;
  const el = $(`label-${key}`);
  if (el) el.textContent = key === 'res' ? value : `${value} ${key === 'mips' ? 'MIPS' : 'MB'}`;
}

// ---------- 展品故事(畫面下方) ----------
function renderStory() {
  const sys = app.sys;
  const k = (key) => t(`os.${sys.id}.${key}`);
  const tips = k('tips');
  const egg = k('egg');
  els.about.replaceChildren(
    h('div', { class: 'osm-story-body' },
      h('h2', { class: 'osm-h2' }, t('story.title', { name: sys.name })),
      h('p', {}, k('body'))),
    h('div', { class: 'osm-story-side' },
      Array.isArray(tips) && tips.length ? [h('h3', {}, t('about.tips')), h('ul', {}, tips.map((x) => h('li', {}, x)))] : null,
      egg !== `os.${sys.id}.egg` ? h('div', { class: 'osm-egg' }, h('h3', {}, t('about.egg')), h('p', {}, egg)) : null),
  );
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
  renderCapture();
}

// 載入中只更新進度條和文字,不重畫整張卡片
let progressUI = null;
function progressText() {
  const pr = app.progress ?? {};
  let s = pr.label ?? '';
  if (pr.total) s += `  ${fmtMB(pr.loaded ?? 0)} / ${fmtMB(pr.total)} MB`;
  if (pr.rate > 64 * 1024 && pr.total && pr.loaded < pr.total) {
    const secs = Math.ceil((pr.total - pr.loaded) / pr.rate);
    s += ` · ${(pr.rate / MB).toFixed(1)} MB/s`;
    if (secs > 1) s += ` · ${t('overlay.eta', { s: secs })}`;
  }
  return s;
}
function updateProgress() {
  if (app.phase !== 'loading' || !progressUI) return renderOverlay();
  const pr = app.progress ?? {};
  const frac = pr.total ? Math.min(1, (pr.loaded ?? 0) / pr.total) : null;
  progressUI.track.classList.toggle('is-indeterminate', frac == null);
  progressUI.bar.style.transform = frac == null ? '' : `scaleX(${frac})`;
  if (frac == null) progressUI.track.removeAttribute('aria-valuenow');
  else progressUI.track.setAttribute('aria-valuenow', Math.round(frac * 100));
  progressUI.note.textContent = progressText();
}

function renderOverlay() {
  const sys = app.sys;
  const o = els.overlay;
  const p = app.phase;
  progressUI = null;
  o.hidden = p === 'running';
  o.classList.toggle('is-veil', p === 'paused');
  if (p === 'running') return o.replaceChildren();

  const caption = (...kids) => h('div', { class: 'osm-caption' }, h('p', { class: 'osm-caption-name' }, sys.name), ...kids);

  if (p === 'idle') {
    const saved = app.saved[sys.id];
    o.replaceChildren(caption(
      h('div', { class: 'osm-caption-row' },
        h('button', {
          type: 'button', class: 'osm-power',
          onclick: () => serial(() => start()),
          onpointerenter: () => armPrefetch(sys),
          onfocus: () => armPrefetch(sys),
        },
          h('span', { class: 'osm-power-icon', html: ICON.power, 'aria-hidden': 'true' }),
          h('span', {}, saved ? t('overlay.resume') : t('overlay.boot'))),
        saved
          ? h('span', { class: 'osm-caption-note' }, t('overlay.saved', { t: ago(saved.savedAt) }), ' · ',
            h('button', { type: 'button', class: 'osm-linkbtn', onclick: () => serial(() => restart()) }, t('overlay.fresh')))
          : sys.stateBytes ? h('span', { class: 'osm-caption-note' }, t('overlay.size', { n: fmtMB(firstLoad(sys)) })) : null),
      TOUCH ? h('p', { class: 'osm-caption-warn' }, t('overlay.mobile')) : null,
    ));
    return;
  }
  if (p === 'loading') {
    const bar = h('i');
    const track = h('div', { class: 'osm-bar-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, bar);
    const note = h('p', { class: 'osm-caption-note' });
    o.replaceChildren(caption(track, note));
    progressUI = { track, bar, note };
    updateProgress();
    return;
  }
  if (p === 'saving') {
    o.replaceChildren(caption(
      h('div', { class: 'osm-bar-track is-indeterminate' }, h('i')),
      h('p', { class: 'osm-caption-note' }, t('overlay.saving', { name: sys.name }))));
    return;
  }
  if (p === 'paused') {
    o.replaceChildren(h('button', { type: 'button', class: 'osm-paused', onclick: () => serial(resume) },
      h('span', { class: 'osm-power-icon', html: ICON.play, 'aria-hidden': 'true' }),
      h('span', { class: 'osm-paused-title' }, t('overlay.paused')),
      h('span', { class: 'osm-caption-note' }, t('overlay.clickResume'))));
    return;
  }
  if (p === 'error') {
    o.replaceChildren(caption(
      h('p', { class: 'osm-caption-note' }, `${t('overlay.errorTitle')} — ${app.error ?? ''}`),
      h('div', { class: 'osm-caption-row' },
        h('button', { type: 'button', class: 'osm-power', onclick: () => serial(() => start()) },
          h('span', { class: 'osm-power-icon', html: ICON.restart, 'aria-hidden': 'true' }), h('span', {}, t('overlay.retry'))))));
  }
}

// ---------- 輸入狀態:鍵盤、滑鼠現在接在誰身上 ----------
// v86 在客體系統有絕對座標滑鼠驅動(VMware 後門)時會把游標藏起來;那時不需要鎖定
const absoluteMouse = () => els.screen.style.cursor === 'none';
function renderCapture() {
  const live = app.phase === 'running';
  const kb = live && document.activeElement === els.screen;
  const locked = live && document.pointerLockElement === els.screen;
  const abs = live && absoluteMouse();
  const name = app.sys?.name ?? '';
  const mouseOn = locked || (abs && kb);
  // replaceChildren 會把 null 變成字串 "null",條件式的元素要先濾掉
  els.capture.replaceChildren(...[
    h('span', { class: `osm-chip${kb ? ' is-on' : ''}`, title: kb ? t('capture.kbOn', { name }) : t('capture.kbOff') },
      h('span', { html: ICON.keys, 'aria-hidden': 'true' }), h('span', {}, t('capture.kb'))),
    TOUCH ? null : h('span', { class: `osm-chip${mouseOn ? ' is-on' : ''}`, title: locked ? t('capture.mouseLocked', { name }) : abs ? t('capture.mouseAbs', { name }) : t('capture.mouseOff') },
      h('span', { html: ICON.mouse, 'aria-hidden': 'true' }), h('span', {}, t('capture.mouse'))),
  ].filter(Boolean));
  els.capture.setAttribute('aria-label', [
    kb ? t('capture.kbOn', { name }) : t('capture.kbOff'),
    TOUCH ? '' : locked ? t('capture.mouseLocked', { name }) : abs ? t('capture.mouseAbs', { name }) : t('capture.mouseOff'),
  ].filter(Boolean).join(' · '));
}

// ---------- 第一次開機的操作提示 ----------
let coachEl = null;
function showCoach() {
  if (coachEl || TOUCH || LS.get(PREF.coached) === '1') return;
  const row = (key, text) => h('li', {}, h('kbd', {}, key), h('span', {}, text));
  coachEl = h('div', { class: 'osm-coach', role: 'note' },
    h('ul', {}, row(t('coach.clickKey'), t('coach.click')), row('Esc', t('coach.esc')), row('⌃⌥⌦', t('coach.keys'))),
    h('button', { type: 'button', class: 'osm-coach-ok', onclick: () => hideCoach(true) }, t('coach.ok')));
  els.stage.append(coachEl);
}
function hideCoach(remember = false) {
  if (remember) LS.set(PREF.coached, '1');
  coachEl?.remove();
  coachEl = null;
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
    tool('mute', app.muted ? ICON.muted : ICON.sound, app.muted ? t('tool.unmute') : t('tool.mute'), toggleMute, { pressed: app.muted }),
    tool('shot', ICON.camera, t('tool.shot'), screenshot, { disabled: !live }),
    tool('full', ICON.full, t('tool.full'), fullscreen, { disabled: !live }),
  ].filter(Boolean));
  if (popover && !live) closePopover();
}

function toggleMute() {
  app.muted = !app.muted;
  LS.set(PREF.muted, app.muted ? '1' : '0');
  app.machine?.setMuted(app.muted);
  renderTools();
  hint(app.muted ? t('hint.muted') : t('hint.unmuted'));
  refocus();
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
  els.work.append(panel);
  const a = anchor.getBoundingClientRect();
  const m = els.work.getBoundingClientRect();
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
    await els.work.requestFullscreen({ navigationUI: 'hide' });
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
  for (const el of [els.screen, els.overlay]) {
    el.style.width = `${Math.floor(cw * s)}px`;
    el.style.height = `${Math.floor(ch * s)}px`;
  }
  els.screen.classList.toggle('is-pixelated', s >= 2);
  setLive('res', `${cw} × ${ch}`);
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
  setLive('net', fmtMB(netBytes));
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
    setLive('mips', mips ? Math.round(mips) : '—');
    lastIns = ins;
    lastT = now;
  }, 1000);
}
function stopMeters() {
  clearInterval(meterTimer);
  setLive('mips', '—');
}

// ---------- 存檔:背景壓縮、寫進 IndexedDB ----------
// save_state 本身只要 0.1 秒,慢的是 gzip(兩三百 MB 要好幾秒)。所以換台時拿到狀態就先換,
// 壓縮和寫入在背景做;還沒寫完又切回來,就直接用記憶體裡那份。
const pending = new Map(); // id → { state, promise }

function persistLater(sys, state) {
  const job = { state };
  app.saved[sys.id] = { savedAt: Date.now() };
  job.promise = store.save(sys.id, sys.snapshot, state)
    .catch((e) => {
      console.warn('save failed', e);
      delete app.saved[sys.id];
      renderTabs();
      hint(t('hint.saveFailed'), 4000);
    })
    .finally(() => { if (pending.get(sys.id) === job) pending.delete(sys.id); });
  pending.set(sys.id, job);
  renderTabs();
}

async function snapshotNow(m) {
  if (AUTHOR) return;
  try {
    persistLater(m.sys, await m.saveState());
    app.dirty = false;
  } catch (e) {
    console.warn('save_state failed', e);
  }
}

// ---------- 開機、切換 ----------
async function select(id, { boot = false } = {}) {
  const list = visible();
  const sys = list.find((s) => s.id === id) ?? list[0];
  if (app.sys === sys && (app.machine || !boot)) return;
  app.gen++;
  await shutdown();
  app.sys = sys;
  document.body.dataset.ex = sys.id;
  live.res = '';
  LS.set(PREF.last, sys.id);
  if (location.hash !== `#${sys.id}`) history.replaceState(null, '', `${location.pathname}${location.search}#${sys.id}`);
  renderTabs();
  renderLabel();
  renderStory();
  if (boot) await start();
  else setPhase('idle');
}

// 正在載入的那台直接丟掉(還沒跑過,沒有進度要存),讓排在後面的切換馬上開始
function cancelLoading() {
  if (app.phase !== 'loading') return;
  app.gen++;
  const m = app.machine;
  app.machine = null;
  m?.destroy();
}

async function shutdown() {
  const m = app.machine;
  if (!m) return;
  app.machine = null;
  stopMeters();
  canvasWatch?.disconnect();
  closePopover();
  hideCoach();
  if (document.pointerLockElement) document.exitPointerLock();
  if (app.dirty && (app.phase === 'running' || app.phase === 'paused')) {
    setPhase('saving');
    await m.stop();
    await snapshotNow(m);
  }
  await m.destroy();
}

async function start({ fresh = false } = {}) {
  const gen = app.gen;
  const sys = app.sys;
  app.started = true;
  app.error = null;
  bringIntoView();
  app.progress = { label: t('overlay.restore') };
  setPhase('loading');

  // 開機來源:作者模式冷開機 > 還沒寫完的背景存檔 > IndexedDB 存檔 > 伺服器上的開機快照
  let state = null;
  if (COLD) {
    state = 'cold';
    app.progress = { label: t('overlay.cold') };
  } else {
    if (!fresh && !AUTHOR) {
      state = pending.get(sys.id)?.state ?? null;
      // 不靠 app.saved 判斷:頁面一開始先畫、存檔標記稍後才補上,太快按開機時它可能還是空的
      if (!state) {
        if (app.saved[sys.id]) {
          app.progress = { label: t('overlay.restoreSaved') };
          updateProgress();
        }
        state = (await store.load(sys.id, sys.snapshot))?.state ?? null;
      }
    }
    if (gen !== app.gen) return;
    if (!state) {
      app.progress = { label: t('overlay.download'), loaded: 0, total: sys.stateBytes, rate: 0 };
      updateProgress();
      try {
        state = await fetchSnapshot(sys, (pr) => {
          if (gen !== app.gen) return;
          app.progress = { label: t('overlay.download'), ...pr };
          updateProgress();
        });
      } catch (e) {
        if (gen !== app.gen) return;
        console.error(e);
        app.error = t('overlay.errorNet');
        setPhase('error');
        return;
      }
      if (gen !== app.gen) return;
      app.progress = { label: t('overlay.restore') };
    }
  }
  updateProgress();

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
      m.boot(state),
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
  dropSnapshot(sys);

  canvasWatch?.disconnect();
  canvasWatch = new MutationObserver(fit);
  canvasWatch.observe(m.canvas, { attributes: true, attributeFilter: ['width', 'height'] });
  m.setMuted(app.muted);
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
  renderCapture();
  if (!coachEl && LS.get(PREF.coached) === '1') hint(t('hint.focus'));
  showCoach();
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
  const sys = app.sys;
  app.machine = null;
  stopMeters();
  hideCoach();
  if (m) await m.destroy();
  // 還在背景寫的舊存檔要等它寫完再刪,不然刪完它又寫回去
  await pending.get(sys.id)?.promise;
  await store.remove(sys.id);
  delete app.saved[sys.id];
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
els.screen.addEventListener('focus', () => { app.machine?.setKeyboard(true); els.stage.classList.add('is-focused'); renderCapture(); });
els.screen.addEventListener('blur', () => { app.machine?.setKeyboard(false); els.stage.classList.remove('is-focused'); renderCapture(); });
els.screen.addEventListener('mousedown', () => {
  if (app.phase !== 'running') return;
  if (coachEl) hideCoach(true);
  els.screen.focus({ preventScroll: true });
  if (!absoluteMouse() && !document.pointerLockElement) lockMouse();
});
// 游標藏不藏(絕對座標滑鼠)是 v86 動態決定的,滑過畫面時順便更新狀態
let lastAbs = null;
els.screen.addEventListener('mousemove', () => {
  const abs = absoluteMouse();
  if (abs !== lastAbs) { lastAbs = abs; renderCapture(); }
});
els.softkb.addEventListener('focus', () => app.machine?.setKeyboard(true));
els.softkb.addEventListener('blur', () => { if (document.activeElement !== els.screen) app.machine?.setKeyboard(false); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) hint(t('hint.lock'));
  renderCapture();
});

// 切走分頁:暫停並(在背景)存檔;回來就繼續
document.addEventListener('visibilitychange', () => serial(async () => {
  if (AWAKE || AUTHOR) return;
  if (document.hidden) {
    if (app.phase !== 'running') return;
    await app.machine.stop();
    app.autoPaused = true;
    setPhase('paused');
    if (app.dirty) await snapshotNow(app.machine);
  } else if (app.autoPaused && app.phase === 'paused') {
    await resume();
  }
}));

addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  const sys = visible().find((s) => s.id === id);
  if (sys && sys !== app.sys) {
    cancelLoading();
    serial(() => select(id, { boot: app.started }));
  }
});

// ---------- 彩蛋:通關密語 ----------
// 在網頁上(不是電腦畫面裡、也不是輸入框裡)打出四個碎片拼成的那句話,第五台電腦就會出現。
// 打的字會即時填進「尋寶」區的格子裡;格子只顯示你打了什麼,不會提示對錯。
const WORDS = ['from', 'noise', 'to', 'signal'];
let typed = '';

function renderSlots() {
  const solved = app.unlocked;
  const letters = solved ? PASSPHRASE : typed;
  const owners = SYSTEMS.filter((s) => !s.hidden);
  let at = 0;
  els.slots.replaceChildren(...WORDS.map((word, wi) => {
    const cells = [...word].map(() => {
      const ch = letters[at++] ?? '';
      return h('span', { class: `osm-cell${ch ? ' is-typed' : ''}` }, ch);
    });
    return h('div', { class: 'osm-word' },
      h('div', { class: 'osm-word-cells' }, cells),
      h('span', { class: 'osm-word-label' }, owners[wi]?.name ?? ''));
  }));
  els.hunt.classList.toggle('is-solved', solved);
  els.huntState.textContent = solved ? t('hunt.solved') : typed ? '' : t('hunt.idle');
}

addEventListener('keydown', (e) => {
  if (app.unlocked || e.ctrlKey || e.metaKey || e.altKey) return;
  const target = e.target;
  if (target === els.screen || target?.closest?.('input, textarea, [contenteditable]')) return;
  if (e.key === 'Backspace' && typed) {
    typed = typed.slice(0, -1);
    renderSlots();
    return;
  }
  if (e.key === 'Escape' && typed) {
    typed = '';
    renderSlots();
    return;
  }
  if (!/^[a-z]$/i.test(e.key)) return;
  typed = (typed + e.key.toLowerCase()).slice(-PASSPHRASE.length);
  if (typed === PASSPHRASE) unlock();
  else renderSlots();
});

function unlock() {
  app.unlocked = true;
  LS.set(PREF.unlocked, '1');
  renderTabs();
  renderSlots();
  const secret = SYSTEMS.find((s) => s.hidden);
  const tab = secret && $(`tab-${secret.id}`);
  tab?.classList.add('is-new');
  tab?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  hint(t('egg.unlocked'), 6000);
}

onLang(() => {
  if (!app.sys) return; // initI18n() 第一次套用語言時還沒選系統,select() 之後自己會畫
  renderTabs();
  renderLabel();
  renderStory();
  renderSlots();
  els.statusText.textContent = t(`status.${app.phase}`);
  renderOverlay();
  renderTools();
  renderCapture();
  if (coachEl) { hideCoach(); showCoach(); }
});

// ---------- 啟動 ----------
initI18n();
renderSlots();
// 先把頁面畫出來,存檔資訊(IndexedDB)之後再補上 —— IndexedDB 慢或卡住時頁面也不會停在半空
// 網址指定的那台 > 上次看的那台 > 第一台
serial(() => select(location.hash.slice(1) || LS.get(PREF.last) || '', { boot: false }));
Promise.all(SYSTEMS.map(async (sys) => {
  const rec = await store.peek(sys.id);
  if (rec && rec.snapshot === sys.snapshot && !app.saved[sys.id]) app.saved[sys.id] = { savedAt: rec.savedAt };
})).then(() => {
  if (!app.sys) return;
  renderTabs();
  if (app.phase === 'idle') renderOverlay();
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
