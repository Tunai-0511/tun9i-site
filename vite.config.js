import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// 作業系統博物館(/os/)開發用:
//  - /os/disk/*  從 .os-images/r2/disk/ 讀磁碟分塊與快照(線上是 worker 從 R2 讀,路徑一樣)
//  - POST /__os/state/<名字>  把瀏覽器裡 save_state() 的結果寫進 .os-images/states/,
//    拿來做「開機完成」的快照(只有 dev server 有這個接口)
function osMuseumDev() {
  const root = path.resolve('.os-images');
  return {
    name: 'os-museum-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/os/disk', (req, res, next) => {
        const rel = decodeURIComponent(req.url.split('?')[0]);
        const file = path.join(root, 'r2/disk', rel);
        if (!file.startsWith(path.join(root, 'r2/disk')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return next();
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', fs.statSync(file).size); // v86 的下載進度要靠這個算總量
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(file).pipe(res);
      });
      server.middlewares.use('/__os/state', (req, res, next) => {
        if (req.method !== 'POST') return next();
        const name = path.basename(decodeURIComponent(req.url.split('?')[0]));
        if (!/^[a-z0-9._-]+$/.test(name)) { res.statusCode = 400; return res.end('bad name'); }
        fs.mkdirSync(path.join(root, 'states'), { recursive: true });
        const out = fs.createWriteStream(path.join(root, 'states', name));
        req.pipe(out);
        out.on('finish', () => res.end('ok'));
      });
    },
  };
}

export default defineConfig({
  plugins: [osMuseumDev()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
    // 兩個頁面(首頁、/os/)各自一份 CSS。false 會把全站 CSS 合成一個檔、兩頁都載入,樣式互相污染。
    // 首頁的 CSS 全由 src/main.js 靜態匯入,拆不拆對首頁都一樣是一個檔。
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: path.resolve('index.html'),
        os: path.resolve('os/index.html'),
      },
    },
  },
  server: {
    port: 5199,
    strictPort: true,
  },
});
