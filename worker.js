// tun9i.com — 極簡 Worker
//  1. www → apex、http → https 轉址
//  2. 404 一律不准被快取
export default {
  async fetch(request, env) {
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
