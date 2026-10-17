// 開機快照的下載:自己 fetch(而不是交給 v86 的 initial_state.url),好處是
//  - 滑鼠停在分頁上就能先下載(prefetch),點下去時直接用同一份,不會下載兩次
//  - 拿得到真正的進度、速度,算得出剩幾秒
//  - 訪客中途換台,下載照樣在背景跑完,回來時就是秒開
// v86 的 restore_state 認得 zstd 開頭,壓縮過的 buffer 直接當 initial_state 就行。

import { stateUrl } from './systems.js';

const jobs = new Map(); // id → { promise, loaded, total, listeners:Set }

function start(sys) {
  let job = jobs.get(sys.id);
  if (job) return job;
  job = { loaded: 0, total: sys.stateBytes || 0, startedAt: performance.now(), listeners: new Set() };
  const notify = () => job.listeners.forEach((fn) => fn(job));
  job.promise = (async () => {
    const res = await fetch(stateUrl(sys));
    if (!res.ok) throw new Error(`download ${res.status}`);
    job.total = Number(res.headers.get('content-length')) || job.total;
    if (!res.body) return res.arrayBuffer();
    const reader = res.body.getReader();
    // 知道總大小就直接寫進預先配好的 buffer,不必最後再拼接一次
    const out = job.total ? new Uint8Array(job.total) : null;
    const parts = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (out && job.loaded + value.length <= out.length) out.set(value, job.loaded);
      else parts.push(value);
      job.loaded += value.length;
      notify();
    }
    if (out && !parts.length && job.loaded === out.length) return out.buffer;
    const all = new Uint8Array(job.loaded);
    let at = 0;
    if (out) { all.set(out.subarray(0, Math.min(out.length, job.loaded)), 0); at = Math.min(out.length, job.loaded); }
    for (const p of parts) { all.set(p, at); at += p.length; }
    return all.buffer;
  })();
  // 失敗就把工作丟掉,下次重新下載
  job.promise.catch(() => { if (jobs.get(sys.id) === job) jobs.delete(sys.id); });
  jobs.set(sys.id, job);
  return job;
}

// 開機用:等下載完,期間回報 { loaded, total, rate(bytes/s) }
export async function fetchSnapshot(sys, onProgress) {
  const job = start(sys);
  const samples = [];
  const listener = (j) => {
    const now = performance.now();
    samples.push([now, j.loaded]);
    while (samples.length > 2 && now - samples[0][0] > 3000) samples.shift(); // 最近 3 秒的平均速度
    const [t0, b0] = samples[0];
    const rate = now > t0 ? ((j.loaded - b0) / (now - t0)) * 1000 : 0;
    onProgress?.({ loaded: j.loaded, total: j.total, rate });
  };
  job.listeners.add(listener);
  listener(job);
  try {
    return await job.promise;
  } finally {
    job.listeners.delete(listener);
  }
}

// 先偷偷下載(滑鼠停在分頁上時)。已經在下載或下載過就什麼都不做。
export function prefetchSnapshot(sys) {
  start(sys).promise.catch(() => {});
}

export function isFetched(sys) {
  const job = jobs.get(sys.id);
  return !!job && job.total > 0 && job.loaded >= job.total;
}

// 開機完就把記憶體裡那份放掉(v86 已經有自己的一份了)
export function dropSnapshot(sys) {
  jobs.delete(sys.id);
}
