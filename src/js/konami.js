// Konami 彩蛋:↑↑↓↓←→←→BA
import { t } from './i18n.js';

const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const DURATION = 6000;

export function initKonami() {
  let seq = [];
  let timer = null;

  const fire = () => {
    const root = document.documentElement;
    root.classList.add('konami');

    let toast = document.getElementById('konami-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'konami-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = t('konami.toast');
    requestAnimationFrame(() => toast.classList.add('on'));

    clearTimeout(timer);
    timer = setTimeout(() => {
      root.classList.remove('konami');
      toast.classList.remove('on');
    }, DURATION);
  };

  addEventListener('keydown', (e) => {
    // 在終端機/輸入框打字時不要誤觸
    if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
    seq.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    if (seq.length > CODE.length) seq.shift();
    if (seq.join(',') !== CODE.join(',')) return;
    seq = [];
    fire();
  });

  return { fire };
}
