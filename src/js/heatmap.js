// GitHub 貢獻熱力圖
// GitHub 官方 REST API 沒有貢獻資料(GraphQL 才有,但需要 token,不能放前端),
// 所以走公開的 CORS proxy;失敗就整塊收起來,絕不留一個壞掉的空格子。
import { t, onLang } from './i18n.js';

const USER = 'Tunai-0511';
const API = `https://github-contributions-api.jogruber.de/v4/${USER}?y=last`;
const CACHE_KEY = 'tun9i-gh-heat';
const TTL = 6 * 60 * 60 * 1000; // 6h

const LEVEL_ALPHA = [0.06, 0.3, 0.5, 0.72, 1];

export async function initHeatmap() {
  const wrap = document.getElementById('heatmap');
  if (!wrap) return;

  let data = null;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.t < TTL) data = cached.d;
  } catch { /* ignore */ }

  if (!data) {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      if (!json?.contributions?.length) throw new Error('empty');
      data = json;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: data }));
    } catch {
      wrap.closest('.heatmap-block')?.remove(); // 抓不到就整塊拿掉
      return;
    }
  }

  render(wrap, data);
  onLang(() => render(wrap, data));
}

function render(wrap, data) {
  const days = data.contributions;
  const total = data.total?.lastYear ?? days.reduce((s, d) => s + d.count, 0);

  // 對齊到週:第一天往前補到週日
  const first = new Date(days[0].date);
  const pad = first.getDay();

  const cells = [
    ...Array.from({ length: pad }, () => null),
    ...days,
  ];

  wrap.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'heat-grid';
  grid.setAttribute('role', 'img');
  grid.setAttribute('aria-label', `${total} ${t('gh.total')}`);

  for (const d of cells) {
    const cell = document.createElement('span');
    cell.className = 'heat-cell';
    if (d) {
      cell.style.setProperty('--a', String(LEVEL_ALPHA[d.level] ?? 0.06));
      cell.title = `${d.date} · ${d.count}`;
    } else {
      cell.classList.add('heat-pad');
    }
    grid.appendChild(cell);
  }
  wrap.appendChild(grid);

  const legend = document.createElement('div');
  legend.className = 'heat-legend';
  legend.innerHTML = `
    <span class="heat-total"><strong>${total}</strong> ${t('gh.total')}</span>
    <span class="heat-scale">
      <span>${t('gh.less')}</span>
      ${LEVEL_ALPHA.map((a) => `<span class="heat-cell" style="--a:${a}"></span>`).join('')}
      <span>${t('gh.more')}</span>
    </span>`;
  wrap.appendChild(legend);
}
