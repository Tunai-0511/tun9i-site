<h1 align="center">tun9i.com</h1>

<p align="center">
  <b>個人網站 — 捲動就是一趟飛越黏土微縮世界的鏡頭旅程</b><br/>
  <i>與 AI 協作完成:設計、程式、整個世界,全部。</i>
</p>

<p align="center">
  <a href="https://tun9i.com"><img src="https://img.shields.io/badge/LIVE-tun9i.com-8b78d0?style=for-the-badge" alt="Live" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/前端-Vanilla%20JS-f7df1e" />
  <img src="https://img.shields.io/badge/框架-0-brightgreen" />
  <img src="https://img.shields.io/badge/部署-Cloudflare%20Worker-f38020" />
  <img src="https://img.shields.io/badge/語言-中%20%2F%20EN%20%2F%20日-5b5bd6" />
</p>

---

## 這是什麼

我的個人網站。沒有框架、沒有追蹤、沒有 cookie —— 一個 Vite 打包的 vanilla JS 單頁,
部署成 Cloudflare Worker 的靜態資產,JS 全站約 27KB gzip。

整頁的背景是**一段沒有剪接的鏡頭飛行**:捲動驅動的不是動畫,是攝影機。
從校園上空俯衝進教室,拉起飛越天空,降落到下一個場景 —— 六個場景、五段空中轉場,
一鏡到底。捲回去就是倒帶飛回來。

## 特色

- **捲動即攝影機**:11 段預渲染影片(6 段俯衝 + 5 段空中連接),
  用捲動位置 scrub `currentTime`。區塊即場景:

  | 場景 | 對應區塊 |
  |---|---|
  | 校園 | `#hero` `#about` `#journey` |
  | AI 指揮室 | `#ai` |
  | 專案展示館 | `#projects` |
  | 遊戲動漫房 | `#interests` |
  | 主機房 | `#setup` |
  | 燈塔 | `#contact` |

  接縫是**逐幀對齊**的:每段連接影片的頭尾用的是相鄰俯衝影片的實際渲染幀
  (不是重新生成的場景圖),所以跨場景時看不到接點。
- **世界由 AI 生成**(Higgsfield):場景圖 `gpt_image_2`、鏡頭 `seedance_2_0`。
  所有場景共用同一段風格前言,這是整個世界看起來像同一個世界的原因。
- **三種語言**:繁中/英文/日文,`data-i18n` 屬性 + JSON 字典,右上角一顆鈕循環切換。
  日文版同時是我學日文的練習之一。
- **GitHub 即時資料**:專案卡與貢獻熱力圖 client-side 抓取,策展描述放在
  `src/data/projects.json`(GitHub 的 description 欄位不是唯一真相)。
- **彩蛋**:按 <kbd>`</kbd> 或 <kbd>Ctrl</kbd>+<kbd>K</kbd> 開終端機;Konami 密技也在。

## 影片為什麼這樣做

捲動 scrub 影片有幾個坑,`src/js/worldbg.js` 全部繞開了:

- **用 blob 載入,不直接餵 URL**。很多靜態主機不支援 HTTP range 請求,
  那會讓 `video.seekable` 變成 `[0,0]`,每次 seek 都被夾回第 0 幀 —— 看起來就是影片凍住。
  整支抓成 Blob 再放 object URL,永遠可 seek。
- **seek 合併**。解碼器還在 seeking 時絕不排下一個 seek,否則手機快滑會把 seek 堆爆然後卡死。
  目標值持續 lerp,一有空檔就跳到最新位置。
- **iOS 首次觸控 priming**。iOS 上「seek 過但從沒 play 過」的靜音影片畫不出東西,
  所以第一次觸控時對每段做一次 play→pause。在那之前海報圖一直留著,
  影片真的畫出第一幀(`seeked`)才淡出 —— 不會閃黑畫面。
- **進度探針取視窗中心,不是視窗頂端**。比視窗矮的尾端區塊(`#contact`)
  用頂端基準永遠捲不到,燈塔那一景就永遠不會播。
- **手機另一套編碼**:720p、GOP 4(關鍵幀越密,手機解碼器 seek 越便宜)。

## 素材版號規約 ⚠️

`/video/*` 與 `/images/*` 在 `public/_headers` 是 **immutable 一年快取**。
**重生任何一段影片或場景圖,一定要改版號 + 改檔名,絕對不能原地覆蓋同一個 URL**,
否則舊訪客會卡在舊素材整整一年。

改一個地方就好:`src/js/worldbg.js` 頂端的 `const V = 'v1'`,連同檔名一起改。

## 技術棧

| | |
|---|---|
| 前端 | Vite + vanilla JS、CSS custom properties(`html[data-theme='clay']`,單一主題) |
| 背景 | `worldbg.js` 捲動 scrub 11 段鏡頭鏈,blob 載入 + rAF seek 合併 |
| 部署 | Cloudflare Worker 靜態資產模式(`run_worker_first`),worker 只做轉址與 404 快取防護 |
| 圖片 | sharp 管線:`.assets-raw/`(gitignored 原圖)→ AVIF/WebP 1920w + 960w |
| 安全 | CSP 鎖 first-party(影片走 `media-src 'self' blob:`),只放行 GitHub API 與貢獻資料來源 |

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
src/js/worldbg.js    黏土世界捲動背景(11 段鏡頭鏈)
src/js/              i18n / reveal / pointer / github / heatmap / terminal / konami …
src/styles/world.css 世界舞台 + 內容浮層契約
src/styles/          tokens(設計變數)+ base + components + motion
src/data/i18n/       zh / en / ja 字典(key 三語嚴格對稱)
src/data/projects.json  專案區策展資料(排除清單 + 三語描述覆寫)
public/video/world/  11 段桌機影片 + 11 段手機輕量版
public/images/world/ 每段俯衝的首幀,當海報圖與 reduced-motion 的 fallback
```

> 舊版的六主題(薰衣草暮色、深空黑洞、暗夜便當格、櫻花柔光、極光雪原、黑白編輯)
> 已被這個世界取代。主題 CSS 與背景圖還留在 repo 裡,只是不再被引用。

---

程式碼歡迎參考;文案、頭像與生成圖像版權保留。
