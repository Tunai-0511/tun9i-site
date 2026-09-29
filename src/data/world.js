// 3D 短片的內容清單 —— 以後要新增或修改內容,只要改這個檔。
//
// 場景會依照這裡的「數量」自己排版與長出對應的物件:
//   多一張證照 → 02 章多一層金屬導線(越新的越上面、越粗);
//   多一個 AI 工具 → 03 章環道上多一個廣場,鏡頭自動多一站;
//   多一款遊戲 → 05 章 GPU 旁邊多一顆記憶體;多一類音樂 → 背板多一欄;
//   多一件週邊 → 06 章桌上多一個(沒有專屬模型的東西會用通用外形,不會壞)。
// 文案一律放 i18n 的 key(src/data/i18n/*.json),名稱這類不翻譯的字才直接寫。

// 01:CPU 爆炸圖每一層旁邊的時間線(由上到下)
export const TIMELINE = [
  { layer: 'ihs', date: '2026', text: 'tl.1' },
  { layer: 'tim', date: '2026', text: 'tl.2' },
  { layer: 'dies', date: '2026.03', text: 'tl.3' },
  { layer: 'sub', major: true, date: 'tl.4.date', school: 'tl.4.school', dept: 'tl.4.dept' },
];

// 02:證照(依時間由舊到新 → 由下到上)。major:頂層、最粗、最亮
export const CERTS = [
  { id: 'hw', name: 'cert.hw.n', org: 'cert.gov.o', date: '2024' },
  { id: 'ie', name: 'cert.ie.n', org: 'cert.gov.o', date: '2024' },
  { id: 'de', name: 'cert.de.n', org: 'cert.gov.o', date: '2025' },
  { id: 'ctf', name: 'cert.ctf.n', org: 'cert.ctf.o', date: '2025.05' },
  { id: 'ipas', name: 'cert.ipas.n', org: 'cert.ipas.o', date: '2025.12', major: true },
];
// 02:正在學的(還在沉積中的層)
export const LEARNING = [
  { title: 'lr.ml.t', desc: 'lr.ml.d' },
  { title: 'lr.ja.t', desc: 'lr.ja.d' },
];

// 03:每天在用的 AI(環道上的廣場,依序)。logo:brand = src/js/brand-icons.js 的 key;img = 圖檔
export const AI_TOOLS = [
  { id: 'claude', name: 'Claude', desc: 'ai.claude.d', color: 0xff8a65, logo: { brand: 'claude' } },
  { id: 'chatgpt', name: 'ChatGPT', desc: 'ai.gpt.d', color: 0x74d7a8, logo: { brand: 'openai', mono: '#ffffff' } },
  { id: 'gemini', name: 'Gemini', desc: 'ai.gemini.d', color: 0x7fb2ff, logo: { brand: 'gemini' } },
  { id: 'higgsfield', name: 'Higgsfield', desc: 'ai.hf.d', color: 0xd6f06a, logo: { img: '/images/brand/higgsfield-v2.webp' } },
  { id: 'hermes', name: 'Hermes Agent', desc: 'ai.hermes.d', color: 0xb89bff, logo: { img: '/images/brand/hermes-v2.webp' } },
  { id: 'openclaw', name: 'OpenClaw', desc: 'ai.claw.d', color: 0xff6f61, logo: { img: '/images/brand/openclaw-v2.webp' } },
];

// 04:精選專案(主機板上最大的那顆晶片)。其他專案是即時從 GitHub 抓的(src/js/github.js)
export const FEATURED = {
  name: 'iPAS 備考學院',
  host: 'ipas.tun9i.com',
  live: 'https://ipas.tun9i.com',
  source: 'https://github.com/Tunai-0511/ipas-study',
  lede: 'feat.lede',
  stats: [['3', 'feat.s1'], ['0', 'feat.s2'], ['550', 'feat.s3'], ['PWA', 'feat.s4']],
  notes: [['feat.n1.t', 'feat.n1.d'], ['feat.n2.t', 'feat.n2.d']],
};
export const GITHUB = { user: 'Tunai-0511', all: 'https://github.com/Tunai-0511?tab=repositories', maxChips: 4 };

// 05:興趣(GPU 兩側絲印)、遊戲(GPU 周圍的記憶體)、音樂(背板的欄位)
export const INTERESTS = [
  { title: 'int.ai.t', desc: 'int.ai.d' },
  { title: 'int.game.t', desc: 'int.game.d' },
  { title: 'int.py.t', desc: 'int.py.d' },
  { title: 'int.art.t', desc: 'int.art.d' },
];
export const GAMES = [
  { name: 'Apex Legends', tag: 'g.apex.tag', img: '/images/brand/apex-v3.webp' },
  { name: 'Palworld', tag: 'g.pal.tag', img: '/images/brand/palworld-v2.webp' },
  { name: 'Genshin Impact', tag: 'g.gi.tag', img: '/images/brand/genshin-v2.webp' },
  { name: 'Honkai Impact 3rd', tag: 'g.hi3.tag', img: '/images/brand/honkai3-v2.webp' },
  { name: 'Honkai: Star Rail', tag: 'g.hsr.tag', img: '/images/brand/starrail-v2.webp' },
  { name: 'Street Fighter 6', tag: 'g.sf6.tag', img: '/images/brand/sf6-v2.webp' },
  { name: 'MECCHA CHAMELEON', tag: 'g.mc2.tag', img: '/images/brand/meccha-v1.webp' },
  { name: 'Minecraft', tag: 'g.mc.tag', img: '/images/brand/minecraft-v2.webp' },
];
export const MUSIC = [
  { title: 'mu.jpop.t', desc: 'mu.jpop.d' },
  { title: 'mu.anime.t', desc: 'mu.anime.d' },
  { title: 'mu.game.t', desc: 'mu.game.d' },
  { title: 'mu.west.t', desc: 'mu.west.d' },
  { title: 'mu.ai.t', desc: 'mu.ai.d' },
];

// 06:主機規格(標註會指到機殼裡對應的零件:anchor)與桌上週邊(model:用哪個模型,沒有就用通用外形)
export const SPECS = [
  { anchor: 'cpu', label: 'sp.cpu', value: 'AMD Ryzen 9 9950X3D', note: 'sp.cpu.n', brand: 'amd' },
  { anchor: 'gpu', label: 'sp.gpu', value: 'NVIDIA GeForce RTX 5080', note: 'sp.gpu.n', brand: 'nvidia' },
  { anchor: 'ram', label: 'sp.ram', value: '64GB DDR5-6000', note: 'sp.ram.n' },
  { anchor: 'mb', label: 'sp.mb', value: 'MSI MPG X870E CARBON WIFI' },
  { anchor: 'ssd', label: 'sp.ssd', value: 'Crucial T705 1TB + T500 2TB × 2', note: 'sp.ssd.n' },
  { anchor: 'os', label: 'sp.os', value: 'Windows 11' },
];
export const GEAR = [
  { model: 'monitor', label: 'gr.mon1', value: 'Acer XV272U F3', note: 'gr.mon1.n', main: true },
  { model: 'monitor', label: 'gr.mon2', value: 'MSI MP273Q E2', note: 'gr.mon2.n' },
  { model: 'keyboard', label: 'gr.kb', value: 'AULA 84HE', note: 'gr.kb.n', keys: 84 },
  { model: 'mouse', label: 'gr.mouse', value: 'MCHOSE K7 Ultra', note: 'gr.mouse.n' },
  { model: 'headset', label: 'gr.hs', value: 'SteelSeries Arctis 7X+', note: 'gr.hs.n' },
  { model: 'mic', label: 'gr.mic', value: 'HyperX QuadCast', note: 'gr.mic.n' },
];

// 07:聯絡
export const CONTACT = {
  mail: 'mailto:tunai0511edu@gmail.com',
  github: 'https://github.com/Tunai-0511',
  site: 'tun9i.com',
};
