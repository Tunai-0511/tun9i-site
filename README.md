<h1 align="center">tun9i.com</h1>

<p align="center">
  <b>個人網站 — 背景是一支用程式碼即時渲染的紀錄短片《訊號簡史》</b><br/>
  <i>與 AI 協作完成:設計、程式、每一幀畫面,全部。</i>
</p>

<p align="center">
  <a href="https://tun9i.com"><img src="https://img.shields.io/badge/LIVE-tun9i.com-e8b45c?style=for-the-badge" alt="Live" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/前端-Vanilla%20JS-f7df1e" />
  <img src="https://img.shields.io/badge/框架-0-brightgreen" />
  <img src="https://img.shields.io/badge/影片檔-0-a487ff" />
  <img src="https://img.shields.io/badge/部署-Cloudflare%20Worker-f38020" />
  <img src="https://img.shields.io/badge/語言-中%20%2F%20EN%20%2F%20日-5b5bd6" />
</p>

---

## 這是什麼

我的個人網站。沒有框架、沒有追蹤、沒有 cookie —— 一個 Vite 打包的 vanilla JS 單頁,
部署成 Cloudflare Worker 的靜態資產,首屏 JS 約 27KB gzip。

整頁的背景是一段**用程式碼即時渲染**的紀錄短片,捲動就是它的時間軸。
主角是一道訊號 —— 對應我在做的事:把原始訊號變成好用的產品。

| 區塊 | 訊號經歷了什麼 |
|---|---|
| 首屏 | 一團原始雜訊,流進一支真空管 |
| 關於 | 從真空管出來,變成乾淨的正弦 |
| 歷程 | 爬上五級玻璃台階 —— 五張證照,一年比一年高 |
| AI | 在六個工具節點之間跳成金線拱橋 |
| 專案 | 走過三塊晶片,每塊是一個作品,電路紋路各不相同 |
| 興趣 | 分裂成幾道不同頻率的諧波,底下是等化器 |
| 配備 | 扇出到 16 顆核心,再收回來 |
| 聯絡 | 穿過透鏡,變成一道紫色光束;攝影機退到起點上空,整條訊號一次看完 |

色溫就是時間軸:左邊是鎢絲的琥珀色,越往後越冷,最後是紫光。
風格參考了 [Andy L 的《芯片简史》](https://x.com/AndyL5cc/status/2104437066755125601) —— 學它的語法
(全黑舞台、主體自己發光、紀錄片式的年份與雙語標註),不抄畫面。

## 特色

- **零影片檔**:沒有預渲染、沒有 AI 影片,每一幀都是 three.js 依捲動位置當場畫出來的。
  整個背景是一個約 140KB gzip 的延遲載入 chunk;任何解析度都銳利,手機直向畫面由攝影機自己重新構圖。
- **紀錄片 HUD**:左上章節編號、右上大字年份或計數、場景裡用細線引出中英雙語標註 ——
  全部是 HTML,跟 3D 用同一個 world → screen 投影定位。
- **三種語言**:繁中/英文/日文,`data-i18n` 屬性 + JSON 字典,右上角一顆鈕循環切換。
- **GitHub 即時資料**:專案卡與貢獻熱力圖 client-side 抓取,策展描述放在
  `src/data/projects.json`(GitHub 的 description 欄位不是唯一真相)。
- **彩蛋**:按 <kbd>`</kbd> 或 <kbd>Ctrl</kbd>+<kbd>K</kbd> 開終端機;Konami 密技也在。

## 背景怎麼做的(`src/js/world/`)

- `film.js` 定義場景,也定義**訊號的形狀** `signalY(x)`:它是一條分段函數,
  每一段就是一個章節(雜訊、正弦、台階、拱橋、打線、chirp、光束)。
- `engine.js` 把捲動位置換算成 `s`(第幾個關鍵影格 + 小數),在影格之間插值
  攝影機、訊號頭位置與 HUD。訊號線只畫到訊號頭為止 —— 捲下去它往前長,捲回來它倒退。
- 後製:bloom(主體自己發光)→ 暗角 + 底片顆粒 → ACES 色調映射。
- 進度探針取**視窗中心**,不是頂端 —— 比視窗矮的尾端區塊用頂端基準永遠捲不到。
- 聯絡區在有 WebGL 時會加長、文字釘住,留一段捲動跑道給結尾的拉遠鏡頭。
- 除錯:網址加 `?worlddebug`,`window.__world.settle()` 直接把畫面推到當前捲動位置的終點,
  `__world.scanBad()` 會掃描場景輸出裡的 NaN / Inf。

⚠️ **bloom 會放大 NaN**:場景裡只要有一個像素是 NaN(例如把 `Vector3` 傳進 `Color.lerp`、
或 `pow()` 吃到浮點誤差造成的負數),它會被模糊金字塔擴散成一整塊黑色方塊。
改著色器或材質顏色後,跑一次 `scanBad()`。

## 技術棧

| | |
|---|---|
| 前端 | Vite + vanilla JS、CSS custom properties(`html[data-theme='film']`,單一主題) |
| 背景 | three.js 即時渲染 + UnrealBloom 後製,延遲載入;沒有 WebGL 就停在全黑舞台 |
| 部署 | Cloudflare Worker 靜態資產模式(`run_worker_first`),worker 只做轉址與 404 快取防護 |
| 圖片 | sharp 管線:`.assets-raw/`(gitignored 原圖)→ AVIF/WebP 1920w + 960w |
| 安全 | CSP 鎖 first-party,只放行 GitHub API 與貢獻資料來源 |

## 開發

```bash
npm install
npm run dev        # Vite dev server
npm run images     # .assets-raw/ 原圖 → public/images/(AVIF/WebP)
npm run build      # 產出 dist/
npm run deploy     # build + wrangler deploy
```

## 結構

```
worker.js            轉址 + 404 no-store(邊際節點傳播空窗的 404 不准被快取)
index.html           單頁骨架 + FOUC 防護 inline script
src/js/world/        《訊號簡史》背景:index(入口 + HUD)/ engine(捲動→鏡頭)/ film(場景與訊號形狀)
src/js/              i18n / reveal / pointer / github / heatmap / terminal / konami …
src/styles/world.css 背景舞台、紀錄片 HUD、內容浮層契約
src/styles/          tokens(設計變數)+ base + components + motion
src/data/i18n/       zh / en / ja 字典(key 三語嚴格對稱)
src/data/projects.json  專案區策展資料(排除清單 + 三語描述覆寫)
scripts/og-image.mjs 分享卡:疊字在 scripts/og-film-frame.jpg(從即時場景擷取的結尾那一幀)
```

> 背景的演進:六主題靜態圖 → AI 生成的黏土世界捲動影片 → 現在的程式碼即時渲染。
> 舊主題 CSS 與背景圖還留在 repo 裡,只是不再被引用;黏土世界的影片在 git 歷史裡(commit f22121e)。

---

程式碼歡迎參考;文案、頭像與生成圖像版權保留。
