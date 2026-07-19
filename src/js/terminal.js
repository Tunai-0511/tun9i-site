// 終端機彩蛋:按 ` 或 Ctrl+K 叫出,可以打指令
import { t } from './i18n.js';
import { THEMES } from './theme.js';
import { themeForHour } from './autotheme.js';

const BANNER = [
  "tun9i.com — type 'help' for commands, 'exit' to close.",
];

export function initTerminal({ setTheme, setAuto, isAuto, fireKonami }) {
  const el = document.createElement('div');
  el.id = 'term';
  el.hidden = true;
  el.innerHTML = `
    <div class="term-win" role="dialog" aria-modal="true" aria-label="Terminal">
      <div class="term-bar">
        <span class="term-dot" style="--d:#ff5f57"></span>
        <span class="term-dot" style="--d:#febc2e"></span>
        <span class="term-dot" style="--d:#28c840"></span>
        <span class="term-title">tunai@tun9i — zsh</span>
        <button class="term-x" type="button" aria-label="Close">✕</button>
      </div>
      <div class="term-out" id="term-out" aria-live="polite"></div>
      <form class="term-line" id="term-form" autocomplete="off">
        <span class="term-ps1">➜ ~</span>
        <input class="term-in" id="term-in" spellcheck="false" aria-label="command" />
      </form>
    </div>`;
  document.body.appendChild(el);

  const out = el.querySelector('#term-out');
  const input = el.querySelector('#term-in');
  const form = el.querySelector('#term-form');
  const history = [];
  let hIdx = -1;

  const print = (text, cls = '') => {
    const line = document.createElement('div');
    line.className = 'term-row ' + cls;
    line.textContent = text;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
  };

  // 用 openState 記意圖,不要靠讀 el.hidden 判斷:
  // close() 的隱藏是延遲 220ms 才發生,這段期間 el.hidden 仍是 false,
  // 讀 DOM 會誤判成「已開啟」而拒絕重開;而且舊計時器沒取消的話,
  // 重開後會被它又關掉。
  let openState = false;
  let hideTimer = null;

  const open = () => {
    clearTimeout(hideTimer);
    hideTimer = null;
    openState = true;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('on'));
    if (!out.childElementCount) BANNER.forEach((b) => print(b, 'dim'));
    input.focus();
  };
  const close = () => {
    openState = false;
    el.classList.remove('on');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (!openState) el.hidden = true; }, 220);
  };

  const COMMANDS = {
    help: () => [
      'help            這份說明',
      'whoami          我是誰',
      'theme <name>    換主題 (' + THEMES.join(' | ') + ')',
      'theme auto      依時間自動換主題',
      'theme list      列出所有主題',
      'games           在玩的遊戲',
      'ai              每天在用的 AI',
      'setup           電腦配備',
      'school          學歷',
      'social          連結',
      'konami          ???',
      'clear           清空畫面',
      'exit            關掉終端機',
    ],
    whoami: () => [
      'Tunai — 國立臺中科技大學 · 人工智慧應用工程學士學位學程 · 二年級',
      '軟體工程 · AI Agents · Python 系統',
      'github.com/Tunai-0511',
    ],
    school: () => ['國立臺中科技大學', '人工智慧應用工程學士學位學程 · 二年級'],
    games: () => [...document.querySelectorAll('.game-card')].map((c) => {
      const n = c.querySelector('.game-name')?.textContent.trim();
      const g = c.querySelector('.game-tag')?.textContent.trim();
      return `  ${n.padEnd(20)} ${g}`;
    }),
    ai: () => [...document.querySelectorAll('.ai-card h3')].map((h) => '  ' + h.textContent.trim()),
    // 直接讀畫面上的區塊,免得規格改了這裡忘了跟著改
    setup: () => [
      ...[...document.querySelectorAll('#setup .spec-row')].map((r) => {
        const k = r.querySelector('.spec-label')?.textContent.trim() ?? '';
        const v = r.querySelector('.spec-value')?.textContent.trim() ?? '';
        return `  ${k.padEnd(6)} ${v}`;
      }),
      '',
      ...[...document.querySelectorAll('#setup .gear-card')].map((c) => {
        const k = c.querySelector('.gear-tag')?.textContent.trim() ?? '';
        const v = c.querySelector('.gear-name')?.textContent.trim() ?? '';
        return `  ${k.padEnd(6)} ${v}`;
      }),
    ],
    social: () => ['  github   https://github.com/Tunai-0511', '  email    tunai0511edu@gmail.com'],
    clear: () => { out.innerHTML = ''; return []; },
    exit: () => { close(); return []; },
    konami: (arg) => {
      if (arg === 'go') { fireKonami?.(); return ['✨'] ; }
      return ['↑ ↑ ↓ ↓ ← → ← → B A', "(或直接輸入 'konami go')"];
    },
    theme: (arg) => {
      if (!arg || arg === 'list') return ['  ' + THEMES.join('\n  ')];
      if (arg === 'auto') {
        setAuto(true);
        // 報「要換成的」主題,不能讀 dataset.theme ——
        // 換主題走 View Transition 是非同步的,這時候讀到的還是舊主題。
        return ['已開啟:依時間自動換主題 → ' + themeForHour(new Date().getHours())];
      }
      if (arg === 'status') return ['auto: ' + (isAuto() ? 'on' : 'off'), 'current: ' + document.documentElement.dataset.theme];
      if (!THEMES.includes(arg)) return [`theme: 沒有這個主題 '${arg}'`, '可用:' + THEMES.join(', ')];
      setAuto(false);
      setTheme(arg);
      return ['主題 → ' + arg];
    },
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = input.value.trim();
    input.value = '';
    if (!raw) return;
    history.unshift(raw); hIdx = -1;
    print('➜ ~ ' + raw, 'cmd');
    const [cmd, ...rest] = raw.split(/\s+/);
    const fn = COMMANDS[cmd.toLowerCase()];
    if (!fn) { print(`zsh: command not found: ${cmd}`, 'err'); return; }
    (fn(rest.join(' ').toLowerCase()) || []).forEach((l) => print(l));
  });

  // 上下鍵翻歷史
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); if (hIdx < history.length - 1) input.value = history[++hIdx] || ''; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (hIdx > 0) input.value = history[--hIdx] || ''; else { hIdx = -1; input.value = ''; } }
    else if (e.key === 'Escape') close();
  });

  el.querySelector('.term-x').addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });

  addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
    if ((e.key === '`' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      openState ? close() : open();
    }
  });

  return { open, close };
}
