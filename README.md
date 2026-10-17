<h1 align="center">tun9i.com</h1>

<p align="center">
  <b>個人網站 — 整個網站是一部用程式碼即時渲染、可以捲動的 3D 短片</b><br/>
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
部署成 Cloudflare Worker 的靜態資產,首屏 JS 約 28KB gzip。

**整個網站是一部可以捲動的 3D 短片**,用程式碼即時渲染。自我介紹、證照、作品、配備……
不是疊在畫面上的字卡,而是雷射刻在場景裡的物件上:CPU 的頂蓋、剖面、金屬導線、晶片、電路板、螢幕、天空。
刻在物件上的連結可以直接點。

鏡頭的邏輯是**尺度**:每一幕都藏在下一幕的一小塊裡。前半段一路鑽進去,後半段一路拉出來。

| 章 | 場景 | 刻在哪裡 |
|---|---|---|
| 00 開場 | 一團雜訊粒子聚合成一顆 CPU,雷射在頂蓋上刻字 | 頂蓋:名字、頭像、數據、GitHub / 聯絡連結 |
| 01 關於 | 雷射把 CPU 切開、前半塊掉出畫面,各層往上分離 | 頂蓋剖面:自我介紹;每一層旁邊:時間線 |
| 02 歷程 | 鏡頭鑽進晶粒剖面、放大上千倍:一層金屬導線 = 一張證照 | 切面左側;最上面還在沉積中的層 = 正在學的 |
| 03 AI | 從金屬層鑽出晶粒表面 —— 是一座城市,環道上的廣場 = 每天在用的 AI | 廣場地面:logo、名字、用法 |
| 04 作品 | 拉遠:CPU 合回去、插進主機板,板子開機 | 精選專案 = 大晶片 + 規格書絲印;其他 repo = 一排小晶片(即時抓 GitHub);熱力圖 = LED 陣列 |
| 05 下班之後 | 一張顯示卡飛進來、背板掀開 | 背板:音樂(每欄一組等化器);GPU 封裝:標題;記憶體 = 遊戲;兩側絲印 = 興趣 |
| 06 配備 | 拉遠成整台雙玻璃展示機殼(360 冷排、九顆 RGB 風扇、帶 LCD 的水冷頭、編織線材、顯卡支撐架)與桌面 | 零件旁的規格標註;主螢幕:標題 + 工作列;副螢幕:neofetch;每顆鍵帽都有字的 75% 鍵盤;週邊上方的標籤 |
| 07 聯絡 | 從窗戶飛出去:台中夜景(帷幕高樓、住宅、透天店面與直立霓虹招牌、車流與機車、捷運綠線、河、公園、歌劇院)| 粒子在天空重組成聯絡方式 |

色溫就是章節:每一章一個色標,由目前的色票決定。
風格參考了 [Andy L 的《芯片简史》](https://x.com/AndyL5cc/status/2104437066755125601) —— 學它的語法
(全黑舞台、主體自己發光、紀錄片式的 HUD),不抄畫面。

## 特色

- **零影片檔**:沒有預渲染、沒有 AI 影片,每一幀都是 three.js 依捲動位置當場畫出來的。
  3D 引擎是一個約 185KB gzip 的延遲載入 chunk。
- **內容是資料驅動的**:證照、AI 工具、遊戲、音樂、規格、週邊都在 `src/data/world.js`。
  多一張證照就多一層金屬導線,多一個 AI 工具就多一個廣場、鏡頭自動多一站,多一款遊戲就多一顆記憶體。
- **可以互動**:游標是一盞光、粒子會閃開;點擊空白處發出脈衝;刻在物件上的連結可以點;鏡頭跟著滑鼠微微轉向。
- **五組色調**:鎢絲→紫光(預設)、霓虹、電路板、櫻夜、白金。切換時整部片在 0.9 秒內平滑過渡,
  網站按鈕一起換,選擇記在 localStorage。導覽列的色球選單或終端機 `theme <name>` 都能切。
- **三種語言**:繁中/英文/日文。刻在場景裡的字也跟著換(每一塊刻字都會重畫);單行標題超寬會自動縮小。
- **手機**:刻字在直向小螢幕上讀不到,所以窄螢幕在下緣多一層紀錄片式字幕(同一份資料),連結可以直接點。
- **無障礙**:原本的 HTML 內容都還在(螢幕閱讀器、搜尋引擎、鍵盤都讀得到),只是視覺上藏起來;
  要求減少動態(`prefers-reduced-motion`)或沒有 WebGL2 時,維持原本的卡片版面。
- **彩蛋**:按 <kbd>`</kbd> 或 <kbd>Ctrl</kbd>+<kbd>K</kbd> 開終端機;Konami 密技也在。

## 怎麼做的(`src/js/world/`)

- `engine.js`:捲動位置 → `s`(第幾個鏡頭 + 小數)。每個鏡頭屬於一個**空間**:
  `outside`(夜景,公尺)⊃ `main`(主機、主機板、CPU,公分)⊃ `die`(晶粒上的城市)⊃ `stack`(金屬層,約 µm)。
  從金屬層到城市夜景差了十幾個數量級,不能放在同一個座標系 → 每一幀以鏡頭所在的空間為基準,
  只把相鄰的空間換算過來(rebase)。鏡頭距離用對數內插,大縮放時目標點跟著距離走(Powers of Ten)。
  縮放速度越快,身邊掠過的光流越多。
- `scenes/`:每一章一個模組(`cpu`、`stack`、`die`、`board`、`room`、`outside`),各自提供鏡頭(`keys`)、
  每幀更新(`update`)、點擊反應(`pulse`)。章節的鏡頭數會跟著內容變,場景之間用 `st.first(id)` / `st.last(id)`
  互相參照,不寫死鏡頭名字。
- `etch.js`:刻字系統。canvas 畫字 → 貼圖 → 自發光著色器(雷射掃過才出現、可點區域會亮)。
- `parts.js`:零件庫(圓角方塊、表面黏著元件、電容、電感、排針、散熱鰭片、熱導管、扇葉、程序貼圖)。
  細節多但 draw call 少:同一種小零件一律 InstancedMesh。新物件請優先用這裡的零件。
- `particles.js`:可重組的粒子(雜訊雲 → 物件表面 → 軌道;游標射線會把它們推開)與轉場光流。
- `captions.js`:窄螢幕字幕。`palettes.js` / `era.js`:色票與章節色溫(CSS 讀不到 JS,`tokens.css` 的
  `[data-palette]` 區塊要手動同步)。
- 後製:bloom(門檻偏高,只有自發光的東西會暈開)→ 暗角 + 底片顆粒 + 轉場時一點色散 → ACES 色調映射。
- 效能(原則:不改外觀):
  - 首屏只建 CPU、金屬層、晶粒城市;`board` / `room` / `outside` 的 `populate()` 等開場動畫跑完、瀏覽器閒下來才建,
    捲得太快或網址直接跳到後面時,在出場前一段距離當場建。新的大場景請照這個模式(外殼先回傳 `keys`,重的東西放 `populate`)。
  - 不會動的零件用 `P.bakeStatic()` 依材質合併成一個 mesh(會動的、實例化的、半透明的、刻字不會被合)。
  - 閒置時把每個鏡頭的「燈光組合」預先編好著色器、把貼圖先傳上 GPU,第一次進到機殼那章不會頓一下。
  - 桌機最多約 60 幀(120/144 Hz 螢幕少畫一半,動畫照時間走),手機約 30–40 幀。
    平均幀時間持續超標才一級一級降解析度、順了再升回來;跑得動的機器永遠是原本的畫質。
- 除錯:網址加 `?worlddebug`。`__world.go('ai.plaza')` 跳到某個鏡頭、`__world.setS(9.5)` 停在兩個鏡頭中間、
  `__world.scanBad()` 掃描 NaN / Inf、`__world.info()` 看 draw call 與三角形數、
  `__world.midReveal()` 列出停在哪個鏡頭時還有「雷射寫到一半」的刻字(應該要是空的)、
  `__world.pick(x, y)` 查畫面上某一點打到哪個物件、`__world.buildMs` 各場景建構耗時(`+` 是延後建的那段)、
  `__world.gov` 目前的解析度調節狀態。
  改效能前先存基準:`localStorage.perfBase = JSON.stringify(__world.snapAll())`,改完跑
  `__world.compare(JSON.parse(localStorage.perfBase))`,每個鏡頭的平均差應該在 0.2 以內
  (金屬層那章的訊號亂數每次載入都不同,跨載入會有 0.2–0.5 的差,屬正常)。

### 要加內容時

1. 改 `src/data/world.js`(清單)與 `src/data/i18n/*.json`(文案)。
2. 新的一類內容才需要動場景:在 `scenes/` 裡長出物件、`keys` 裡加鏡頭,`captions.js` 補一段字幕。
3. 跑 `?worlddebug`,用 `__world.go()` 一站一站看,再 `scanBad()`。

⚠️ **GLSL 的 `smoothstep(a, b, x)` 必須 a < b**,反過來寫是未定義行為,有的 GPU 會整個算反
(曾讓訊號還沒到的街區先亮起來)。要反向就寫 `1.0 - smoothstep(b, a, x)`。

⚠️ **bloom 會放大 NaN**:場景裡只要有一個像素是 NaN(例如把 `Vector3` 傳進 `Color.lerp`、
或 `pow()` 吃到浮點誤差造成的負數),它會被模糊金字塔擴散成一整塊黑色方塊。
改著色器或材質顏色後,跑一次 `scanBad()`。

## 作業系統博物館(`/os/`)

[tun9i.com/os](https://tun9i.com/os/) —— 四台真的 x86 電腦在瀏覽器裡開機:Haiku、ReactOS、SerenityOS、Linux(SliTaz),
外加一台要解謎才會出現的 KolibriOS。
不是截圖也不是影片,是 [v86](https://github.com/copy/v86) 在 WebAssembly 裡逐條執行機器碼。

- **秒開**:每台都有一份「已經開到桌面」的記憶體快照(zstd,11–67 MB),點下去直接還原,不用等開機。
- **隨時切換**:一次只開一台(每台要 512 MB 記憶體)。換台時先 `save_state()`(0.1 秒)就立刻換,
  gzip 和寫進 IndexedDB 在背景做(兩三百 MB 要好幾秒);還沒寫完就切回來,直接用記憶體裡那份。切走分頁會自動暫停並存檔。
- **預載**:滑鼠停在分頁或「開機」按鈕上就先下載那台的快照(`src/os/snapshots.js` 自己 fetch,v86 的 restore_state
  認得 zstd,壓縮過的 buffer 直接當 initial_state);載入時顯示速度和剩餘秒數。
- **輸入狀態**:狀態列的「鍵盤 / 滑鼠」標籤亮起代表已接到客體系統;第一次開機有一張操作提示卡;可靜音(混音器主音量,記在 localStorage)。
- **磁碟按需下載**:硬碟映像切成 1 MiB 一塊、zstd 壓縮,放在 R2(`tun9i-os` 桶子,約 1.2 GB / 2700 個物件),
  由 `worker.js` 的 `/os/disk/*` 提供(一年 immutable + 邊際節點快取)。訪客只會下載實際讀到的那幾塊。
- **操作**:點畫面接管滑鼠鍵盤(相對座標滑鼠用 Pointer Lock,支援 VMware 絕對座標的系統不鎖);
  工具列送 Ctrl+Alt+Del / Win / Alt+Tab、把文字轉成美式鍵盤掃描碼打進去、截圖、全螢幕(Chrome 會鎖鍵盤,Esc 也送得進去)。
- **CSP**:`/os/*` 另外放寬 `'wasm-unsafe-eval'`、`worker-src blob:`(v86 的 zstd 解壓在 blob Worker 裡跑)與
  `script-src blob:`(音效的 AudioWorklet 是 blob: 模組,歸 script-src 管),見 `public/_headers`。
  ⚠️ dev server 沒有 CSP,這類問題只有 `npm run preview:cf` 或 `wrangler dev --remote` 才測得出來。

| 檔案 | 內容 |
|---|---|
| `os/index.html` | 頁面骨架 |
| `src/os/systems.js` | 展品清單:磁碟、記憶體、網卡、快照版號、解析度、待機截圖 |
| `src/os/machine.js` | 一台 v86 的生命週期、按鍵掃描碼、文字輸入 |
| `src/os/main.js` | 切換 / 存檔 / 遮罩 / 工具列 / 縮放 |
| `src/os/store.js` | IndexedDB 存檔(gzip) |
| `src/os/snapshots.js` | 開機快照的下載、預載、進度 |
| `src/os/i18n/*.json` | 三語文案(key 三語嚴格對稱) |

### 彩蛋與第五台

每台電腦裡藏一個英文單字,都用那個系統自己的特色藏:

| 系統 | 藏在哪 |
|---|---|
| Haiku | `~/people/Tunai`:Haiku 的聯絡人就是帶屬性的空檔案,碎片在 `META:nickname` |
| ReactOS | 登錄檔 `HKCU\Software\tun9i` |
| SerenityOS | `~/.config/Browser.ini` 把 Browser 首頁指到 `~/Documents/tun9i.html`(一張 90 年代個人首頁)。`/res` 是唯讀的,不能直接換掉原本的歡迎頁 |
| Linux | `~/.signal`:BusyBox awk 寫的「雜訊收斂成訊號」動畫(這版 awk 沒有 `sin()`,用查表) |

四個字依分頁順序在網頁上(不是電腦畫面裡)打出來,就會解鎖第五台 **KolibriOS**(`systems.js` 裡 `hidden: true`),
密語在 `src/os/main.js` 的 `PASSPHRASE`,解鎖狀態記在 localStorage。介紹區的紫色「彩蛋」框是每台的提示(i18n 的 `os.<id>.egg`)。
彩蛋都做在開機快照裡(`*-2`),重做快照時記得保留。

### 換快照、加系統

磁碟映像與快照都不進 git,原始檔在 `.os-images/`(gitignored)。

1. `npm run dev`,開 `/os/?author#<id>` 從硬碟冷開機,或 `/os/?author=snap#<id>` 從目前的快照開始改。
2. 開到想要的樣子(越少讀硬碟越好,快照才小),主控台跑 `await __os.save()` →
   `.os-images/states/<snapshot>.bin.gz`。`__os.m` 是目前的 Machine,`__os.click(0|1|2)` 按滑鼠鍵。
3. `node scripts/os-pack-state.mjs <snapshot>` 轉成 `.os-images/r2/disk/state/<snapshot>.bin.zst`,
   把印出來的大小填進 `systems.js` 的 `stateBytes`。
4. **改 `snapshot` 版號**(R2 上是 immutable,不能原地覆蓋;訪客瀏覽器裡舊版號的存檔會自動作廢)。
5. `npx wrangler r2 object put tun9i-os/disk/state/<snapshot>.bin.zst --file … --remote`。

⚠️ 快照只能在**同一版 v86** 還原,`package.json` 把 v86 釘死在 0.5.471;升級 v86 要把四份快照全部重做。
⚠️ 快照裡的硬體要跟還原時一模一樣(記憶體大小、ACPI、網卡種類),例如 ReactOS 的快照帶著 virtio 網卡。

## 技術棧

| | |
|---|---|
| 前端 | Vite + vanilla JS、CSS custom properties(`html[data-theme='film']`,單一主題) |
| 3D | three.js 即時渲染 + UnrealBloom 後製,延遲載入;沒有 WebGL2 或要求減少動態時用卡片版面 |
| 部署 | Cloudflare Worker 靜態資產模式(`run_worker_first`),worker 做轉址、404 快取防護、從 R2 提供 `/os/` 的磁碟映像 |
| 模擬器 | v86 0.5.471(釘死版本,快照格式綁版本)+ SeaBIOS |
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
worker.js            轉址 + 404 no-store(邊際節點傳播空窗的 404 不准被快取)+ /os/disk/* 從 R2 讀磁碟映像
index.html           單頁骨架 + FOUC 防護 inline script
os/index.html        作業系統博物館(程式在 src/os/)
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
