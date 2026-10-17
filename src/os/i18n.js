// /os/ 的三語切換。行為跟首頁的 src/js/i18n.js 一樣(同一個 localStorage 鍵、同一組語言),
// 字典分開放,首頁不必載入博物館的文案。
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

const DICTS = { zh, en, ja };
const LANGS = ['zh', 'en', 'ja'];
const HTML_LANG = { zh: 'zh-Hant-TW', en: 'en', ja: 'ja' };
const NEXT_LABEL = { zh: 'EN', en: '日', ja: '中' };

const norm = (lang) => (LANGS.includes(lang) ? lang : 'zh');
export const lang = () => norm(document.documentElement.dataset.lang);

// t('overlay.size', { n: 38 }) → 把 {n} 換掉。值也可以是陣列(介紹裡的小技巧)。
export function t(key, vars) {
  const l = lang();
  let val = DICTS[l][key] ?? DICTS.zh[key] ?? key;
  if (vars && typeof val === 'string') val = val.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  return val;
}

export function onLang(fn) {
  addEventListener('langchange', (e) => fn(e.detail));
}

function apply(next) {
  next = norm(next);
  const dict = DICTS[next];
  document.documentElement.dataset.lang = next;
  document.documentElement.lang = HTML_LANG[next];
  try { localStorage.setItem('tun9i-lang', next); } catch {}
  document.title = `${dict['bar.title']} — tun9i.com`;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const val = dict[el.dataset.i18n];
    if (val != null) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const val = dict[el.dataset.i18nAria];
    if (val != null) el.setAttribute('aria-label', val);
  });
  const toggle = document.getElementById('lang-toggle');
  if (toggle) toggle.textContent = NEXT_LABEL[next];
  dispatchEvent(new CustomEvent('langchange', { detail: next }));
}

export function initI18n() {
  apply(lang());
  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    apply(LANGS[(LANGS.indexOf(lang()) + 1) % LANGS.length]);
  });
}
