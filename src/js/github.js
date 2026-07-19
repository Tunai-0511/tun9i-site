// GitHub 公開 repo:client-side fetch + localStorage 快取 1h + 靜態 fallback
//
// 顯示的描述來自 src/data/projects.json 的策展資料,不是 GitHub 的 description 欄位。
// 原因:那個欄位常常是空的(四個 repo 都沒填,站上就印出四張「(探索中的專案)」,
// 把實際上有份量的專案藏成了空殼),而且它隨時可能被改壞。
// GitHub 只負責提供「哪些 repo、什麼語言、幾顆星、何時更新」這些會變動的事實。
import fallback from '../data/repos-fallback.json';
import curated from '../data/projects.json';

const USER = 'Tunai-0511';
const API = `https://api.github.com/users/${USER}/repos?sort=updated&per_page=12`;
// 快取鍵的版號:**改動 projects.json 的 exclude 清單時一定要 +1**。
// 快取存的是「篩選後的清單」,不是原始回應 —— 舊訪客的 localStorage 會撐著
// 舊名單最多一小時。v2→v3 是因為 ipas-study 升格成精選案例後要移出 grid,
// 不然它會在同一頁出現兩次。
const CACHE_KEY = 'tun9i-repos-v3';
const TTL = 60 * 60 * 1000;
const EXCLUDE = new Set([USER, ...curated.exclude]); // profile README + 策展排除的

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  PowerShell: '#5391FE', HTML: '#e34c26', CSS: '#663399',
  'Jupyter Notebook': '#DA5B0B', Go: '#00ADD8', Rust: '#dea584',
};

function pick(list) {
  return list
    .filter((r) => !r.fork && !EXCLUDE.has(r.name))
    .slice(0, 6)
    .map((r) => ({
      name: r.name,
      description: r.description,
      html_url: r.html_url,
      language: r.language,
      stargazers_count: r.stargazers_count,
      updated_at: r.updated_at,
    }));
}

function render(repos) {
  const grid = document.getElementById('repo-grid');
  if (!grid) return;
  const lang = () => document.documentElement.dataset.lang;
  grid.innerHTML = '';
  repos.forEach((r, i) => {
    // 卡片是 div 不是 a —— 有線上網址的專案需要「卡片連 GitHub、LIVE 連線上站」
    // 兩個目標,而巢狀 <a> 是無效 HTML。改用標準做法:標題連結用 ::after 拉伸成
    // 整張卡的點擊區,LIVE 連結靠 z-index 疊在它上面。
    const a = document.createElement('div');
    a.className = 'card glass repo-card tilt reveal';
    a.style.setProperty('--stagger-i', i % 3);
    const o = curated.overrides[r.name];
    // 策展描述優先,退回 GitHub 的 description。兩者都沒有才顯示佔位字 ——
    // 但那代表有 repo 沒被策展到,是待辦而不是常態。
    const desc = o?.[lang()] ?? o?.zh ?? r.description
      ?? (lang() === 'zh' ? '(探索中的專案)' : '(work in progress)');
    const title = o?.title ?? r.name;
    const updated = new Date(r.updated_at);
    const dateStr = `${updated.getFullYear()}.${String(updated.getMonth() + 1).padStart(2, '0')}`;
    a.innerHTML = `
      <h3 class="repo-name">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/></svg>
        <a class="repo-link" href="${r.html_url}" target="_blank" rel="noopener">${title}</a>
      </h3>
      <span class="repo-desc"></span>
      <span class="repo-meta">
        ${o?.live ? `<a class="repo-live" href="${o.live}" target="_blank" rel="noopener">LIVE · ${new URL(o.live).hostname}</a>` : ''}
        ${r.language ? `<span class="repo-lang"><span class="lang-dot" style="background:${LANG_COLORS[r.language] || 'var(--accent)'}"></span>${r.language}</span>` : ''}
        ${r.stargazers_count > 0 ? `<span>★ ${r.stargazers_count}</span>` : ''}
        <span>${dateStr}</span>
      </span>`;
    a.querySelector('.repo-desc').textContent = desc;
    grid.appendChild(a);
  });
  // 動態卡片也要 reveal(setTimeout 保底,不依賴 rAF)
  setTimeout(() => grid.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')), 60);
  // 通知 pointer.js 為新卡片註冊 tilt/glare
  dispatchEvent(new CustomEvent('repos:rendered'));
}

let currentRepos = null;

function show(repos) {
  currentRepos = repos;
  render(repos);
}

export async function initGithub() {
  const grid = document.getElementById('repo-grid');
  if (!grid) return;
  // 骨架屏
  grid.innerHTML = Array.from({ length: 6 }, () => '<div class="repo-skel"></div>').join('');

  // 語言切換時,用當前資料重繪(讓 fallback 描述等文案跟著換語言)
  addEventListener('langchange', () => { if (currentRepos) render(currentRepos); });

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.t < TTL) {
      show(cached.repos);
      return;
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(String(res.status));
    const repos = pick(await res.json());
    if (!repos.length) throw new Error('empty');
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), repos }));
    show(repos);
  } catch {
    show(pick(fallback));
  }
}
