// 三語切換(zh-Hant / en / ja):data-i18n 屬性 + JSON 字典
import zh from '../data/i18n/zh.json';
import en from '../data/i18n/en.json';
import ja from '../data/i18n/ja.json';

const DICTS = { zh, en, ja };

// 循環順序。切換鈕上顯示的是「下一個語言」,不是目前的。
export const LANGS = ['zh', 'en', 'ja'];

// html lang 屬性(給螢幕閱讀器選對發音、也給搜尋引擎)
const HTML_LANG = { zh: 'zh-Hant-TW', en: 'en', ja: 'ja' };

// 鈕上的字。空間只夠一兩個字元 —— 「日本語」會把 pill 撐爆。
const NEXT_LABEL = { zh: 'EN', en: '日', ja: '中' };

function norm(lang) {
  return LANGS.includes(lang) ? lang : 'zh';
}

// 給 JS 動態產生的文案用(熱力圖、專案卡、Konami 彩蛋等)
export function t(key) {
  const lang = norm(document.documentElement.dataset.lang);
  return DICTS[lang][key] ?? DICTS.zh[key] ?? key;
}

// 語言切換時回呼
export function onLang(fn) {
  addEventListener('langchange', (e) => fn(e.detail));
}

function apply(lang) {
  lang = norm(lang);
  const dict = DICTS[lang];
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = HTML_LANG[lang];
  localStorage.setItem('tun9i-lang', lang);
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const val = dict[el.dataset.i18n];
    if (val != null) el.textContent = val;
  });
  // 無障礙名稱(aria-label / alt)也跟著語言切換
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const val = dict[el.dataset.i18nAria];
    if (val != null) el.setAttribute('aria-label', val);
  });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
    const val = dict[el.dataset.i18nAlt];
    if (val != null) el.setAttribute('alt', val);
  });
  const toggle = document.getElementById('lang-toggle');
  if (toggle) toggle.textContent = NEXT_LABEL[lang];
  dispatchEvent(new CustomEvent('langchange', { detail: lang }));
}

export function initI18n() {
  apply(document.documentElement.dataset.lang);

  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    const cur = norm(document.documentElement.dataset.lang);
    const next = LANGS[(LANGS.indexOf(cur) + 1) % LANGS.length];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 用 View Transition 讓語言切換是柔和交叉淡入,而不是文字硬跳、版面抽動
    if (!document.startViewTransition || reduced) {
      apply(next);
      return;
    }
    document.documentElement.classList.add('lang-switching');
    let done = false;
    const run = () => { if (!done) { done = true; apply(next); } };
    const vt = document.startViewTransition(run);
    setTimeout(run, 300); // 保底
    vt.finished.finally(() => document.documentElement.classList.remove('lang-switching'));
  });
}
