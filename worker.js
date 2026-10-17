// tun9i.com — 極簡 Worker
//  1. www → apex、http → https 轉址
//  2. 404 一律不准被快取
//  3. /os/disk/* 從 R2 提供作業系統博物館的磁碟分塊與記憶體快照
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // 本機開發不能轉 https:wrangler dev 只跑 http,一轉就把自己導向不存在的
    // https 位址,整個 worker 在本機完全測不了。
    // 不能用 hostname 判斷 —— wrangler dev 會把 request.url 改寫成 wrangler.jsonc
    // 裡 route 的主機名(實測打 127.0.0.1,worker 看到的是 http://tun9i.com/),
    // 所以 hostname 永遠不會等於 127.0.0.1。改用 .dev.vars 的旗標,那個檔案
    // 只有本機會載入,線上不存在。
    const isLocal = env.LOCAL_DEV === '1';
    const needsHttps = url.protocol === 'http:' && !isLocal;
    const needsApex = url.hostname === 'www.tun9i.com';
    if (needsHttps || needsApex) {
      url.protocol = 'https:';
      if (needsApex) url.hostname = 'tun9i.com';
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname.startsWith('/os/disk/')) return osDisk(request, env, ctx, url);

    const res = await env.ASSETS.fetch(request);

    // _headers 給 /images/* 設了 7 天快取,那條規則會連 404 一起套用。
    // 部署時各邊際節點更新有時間差,這段空窗期內任何請求都可能拿到 404 ——
    // 然後那個 404 就被瀏覽器記整整一週,連重新部署都救不回來(踩過三次:
    // 頭像、桌寵精靈圖、品牌 icon)。
    // 在這裡把所有 404 改成 no-store,從根本上斷掉這個問題。
    if (res.status === 404) {
      const patched = new Response(res.body, res);
      patched.headers.set('Cache-Control', 'no-store, must-revalidate');
      return patched;
    }
    return res;
  },
};

// 作業系統博物館(/os/)的磁碟分塊與開機快照:總共一點多 GB、兩千多個檔,
// 放不進靜態資產(單檔上限 25 MiB、也不該每次部署都帶著),所以放 R2 的 tun9i-os 桶子。
// 物件名稱都帶版號(haiku-v5/…、state/haiku-1.bin.zst),內容永遠不變 → 一年 immutable。
// 換快照一定要換檔名,不要原地覆蓋。
async function osDisk(request, env, ctx, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const key = 'disk/' + decodeURIComponent(url.pathname.slice('/os/disk/'.length));
  if (key.includes('..') || key.endsWith('/')) return osNotFound();

  // 邊際節點快取:同一塊磁碟被很多人讀,不必每次都打 R2
  const cacheKey = new Request(url.origin + url.pathname, { method: 'GET' });
  const cached = await caches.default.match(cacheKey);
  if (cached) return request.method === 'HEAD' ? new Response(null, cached) : cached;

  const obj = await env.OS_DISK.get(key);
  if (!obj) return osNotFound();
  const headers = new Headers({
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'ETag': obj.httpEtag,
    'X-Content-Type-Options': 'nosniff',
  });
  const res = new Response(obj.body, { headers });
  ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  return request.method === 'HEAD' ? new Response(null, { headers }) : res;
}

function osNotFound() {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store, must-revalidate' } });
}
