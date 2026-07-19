<h1 align="center">tun9i.com</h1>

<p align="center">
  <b>個人網站 — 六個主題、三種語言、一個 Cloudflare Worker</b><br/>
  <i>與 AI 協作完成:設計、程式、背景圖,全部。</i>
</p>

<p align="center">
  <a href="https://tun9i.com"><img src="https://img.shields.io/badge/LIVE-tun9i.com-e8b45c?style=for-the-badge" alt="Live" /></a>
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

## 特色

- **六個主題**:薰衣草暮色、深空黑洞、暗夜便當格、櫻花柔光、極光雪原、黑白編輯。
  切換用 View Transitions API 的圓形擴散;不手動選的話,依一天的時段自動換。
- **三種語言**:繁中/英文/日文,`data-i18n` 屬性 + JSON 字典,右上角一顆鈕循環切換。
  日文版同時是我學日文的練習之一。
- **背景圖全部 AI 生成**(Higgsfield),經 sharp 壓成 AVIF/WebP 雙格式。
- **GitHub 即時資料**:專案卡與貢獻熱力圖 client-side 抓取,策展描述放在
  `src/data/projects.json`(GitHub 的 description 欄位不是唯一真相)。
- **彩蛋**:按 <kbd>`</kbd> 或 <kbd>Ctrl</kbd>+<kbd>K</kbd> 開終端機;Konami 密技也在。
- **捲動背景舞台**:每個區塊一層背景,交叉淡入 + 視差,不用任何 rAF 迴圈
  (位移同步寫入,平滑交給 CSS transition 在合成層跑)。

## 技術棧

| | |
|---|---|
| 前端 | Vite + vanilla JS、CSS custom properties 主題系統(`html[data-theme]`) |
| 部署 | Cloudflare Worker 靜態資產模式(`run_worker_first`),worker 只做轉址與 404 快取防護 |
| 圖片 | sharp 管線:`.assets-raw/`(gitignored 原圖)→ AVIF/WebP 1920w + 960w |
| 安全 | CSP 鎖 first-party,只放行 GitHub API 與貢獻資料來源 |

## 開發

```bash
npm install
npm run dev        # Vite dev server
npm run images     # .assets-raw/ 原圖 → public/images/(AVIF/WebP)
npm run build      # 產出 dist/
npx wrangler deploy
```

## 結構

```
worker.js            轉址 + 404 no-store(邊際節點傳播空窗的 404 不准被快取)
index.html           單頁骨架 + FOUC 防護 inline script
src/js/              theme / i18n / scrollbg / reveal / pointer / github / heatmap / terminal / konami …
src/styles/          tokens(主題變數)+ base + components + motion + 六個主題覆寫
src/data/i18n/       zh / en / ja 字典(key 三語嚴格對稱)
src/data/projects.json  專案區策展資料(排除清單 + 三語描述覆寫)
```

---

程式碼歡迎參考;文案、頭像與生成圖像版權保留。
