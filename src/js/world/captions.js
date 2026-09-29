// 手機字幕 —— 窄螢幕上,刻在場景裡的字太小讀不到(整個物件要塞進直向畫面,鏡頭得退很遠)。
// 所以窄螢幕在畫面下緣多一層紀錄片式的字幕:目前這個鏡頭在講什麼、連結可以直接點。
// 內容跟刻字用同一份資料(src/data/world.js + i18n),桌機不顯示。

import { t } from '../i18n.js';
import { repoCards } from '../github.js';
import { getHeat } from '../heatmap.js';
import { TIMELINE, CERTS, LEARNING, AI_TOOLS, FEATURED, GITHUB, INTERESTS, GAMES, MUSIC, SPECS, GEAR, CONTACT } from '../../data/world.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// 字幕層對螢幕閱讀器是隱藏的(真正的內容在原本的 HTML 裡),所以連結不進 Tab 順序
const link = (href, label) => `<a href="${esc(href)}" tabindex="-1"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(label)}</a>`;
const head = (eyebrow, title) => `<p class="cap-eyebrow">${esc(eyebrow)}</p>${title ? `<h3>${esc(title)}</h3>` : ''}`;
const item = (a, b) => `<li><b>${esc(a)}</b>${b ? `<span>${esc(b)}</span>` : ''}</li>`;

export function captionFor(K) {
  const n = K.name;
  if (n === 'hero') return `${head(t('hero.eyebrow'), 'Tunai')}<p><b>${esc(t('hero.tagline'))}</b></p><p>${esc(t('hero.sub'))}</p><p class="cap-links">${link('https://github.com/Tunai-0511', 'GitHub ↗')}${link('#contact', t('hero.cta2') + ' →')}</p>`;
  if (n === 'about.cut') return head('01 · ' + t('about.eyebrow'), t('about.title'));
  if (n === 'about.read') return `${head('01 · ' + t('about.eyebrow'), t('about.title'))}<p>${esc(t('about.p1'))}</p><p>${esc(t('about.p2'))}</p>`;
  if (n === 'about.layers') return `${head('01 · ' + t('about.eyebrow'))}<ul>${TIMELINE.map((L) => (L.major ? item(t(L.school), `${t(L.date)} · ${t(L.dept)}`) : item(t(L.date), t(L.text)))).join('')}</ul>`;
  if (n.startsWith('journey.') && K.layers) return `${head('02 · ' + t('jr.eyebrow'), K.layers[0] === 0 ? t('jr.title') : '')}<ul>${K.layers.map((i) => item(t(CERTS[i].name), `${CERTS[i].date} · ${t(CERTS[i].org)}`)).join('')}</ul>`;
  if (n === 'journey.learn') return `${head('02 · ' + t('jr.learning'))}<ul>${LEARNING.map((L) => item(t(L.title), t(L.desc))).join('')}</ul>`;
  if (n === 'ai.plaza') return `${head('03 · ' + t('ai.eyebrow'), t('ai.title'))}<p>${esc(t('ai.sub'))}</p>`;
  if (n.startsWith('ai.') && K.tools) return `${head('03 · ' + t('ai.eyebrow'))}<ul>${K.tools.map((i) => item(AI_TOOLS[i].name, t(AI_TOOLS[i].desc))).join('')}</ul>`;
  if (n === 'proj.board') return `${head('04 · ' + t('proj.eyebrow'), t('proj.title'))}<p>${esc(t('proj.sub'))}</p>`;
  if (n === 'proj.featured') return `${head(t('feat.tag'), FEATURED.name)}<p>${esc(t(FEATURED.lede))}</p><p class="cap-links">${link(FEATURED.live, t('feat.try') + ' ↗')}${link(FEATURED.source, t('feat.src') + ' ↗')}</p>`;
  if (n === 'proj.notes') return `${head(FEATURED.name)}<ul>${FEATURED.notes.map(([a, b]) => item(t(a), t(b))).join('')}</ul>`;
  if (n === 'proj.repos') {
    const R = (repoCards() || []).slice(0, GITHUB.maxChips);
    return `${head(t('proj.others'))}<ul>${R.map((r) => `<li><b>${link(r.url, r.title)}</b><span>${esc(r.desc)}</span></li>`).join('')}</ul>`;
  }
  if (n === 'proj.heat') {
    const h = getHeat();
    const total = h ? (h.total?.lastYear ?? h.contributions.reduce((s, d) => s + d.count, 0)) : null;
    return `${head(t('gh.head'))}${total != null ? `<p>${total} ${esc(t('gh.total'))}</p>` : ''}<p class="cap-links">${link(GITHUB.all, t('proj.more'))}</p>`;
  }
  if (n === 'int.music') return `${head(t('music.head'))}<ul>${MUSIC.map((m) => item(t(m.title), t(m.desc))).join('')}</ul>`;
  if (n === 'int.pcb') return `${head('05 · ' + t('int.eyebrow'), t('int.title'))}<ul>${INTERESTS.map((m) => item(t(m.title), t(m.desc))).join('')}</ul>`;
  if (n === 'int.games') return `${head(t('games.head'))}<ul class="cap-tags">${GAMES.map((g) => `<li>${esc(g.name)}<span>${esc(t(g.tag))}</span></li>`).join('')}</ul>`;
  if (n === 'setup.pc') return `${head('06 · ' + t('setup.eyebrow'), t('setup.title'))}<ul>${SPECS.map((S) => item(t(S.label), S.value + (S.note ? ` · ${t(S.note)}` : ''))).join('')}</ul>`;
  if (n === 'setup.desk') return `${head(t('setup.gear'))}<ul>${GEAR.map((G) => item(t(G.label), G.value + (G.note ? ` · ${t(G.note)}` : ''))).join('')}</ul>`;
  if (n === 'contact.sky') return `${head('07 · ' + t('ct.eyebrow'), t('ct.title'))}<p>${esc(t('ct.sub'))}</p><p class="cap-links">${link(CONTACT.mail, t('ct.mail') + ' →')}${link(CONTACT.github, 'GitHub ↗')}</p>`;
  return '';
}
