// 每台電腦的存檔(v86 save_state 的結果)放在訪客自己瀏覽器的 IndexedDB。
// 一筆一台:{ snapshot, savedAt, bytes, state }。state 用 gzip 壓過 —— 記憶體大多是零,
// 512 MB 的快照壓完通常剩幾十 MB,存取都快很多,也不容易撞到配額。
//
// 隱私模式或配額不足時 IndexedDB 可能整個不能用,所有函式都要能安靜地失敗。

const DB = 'tun9i-os';
const STORE = 'machines';
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

async function pipe(buffer, stream) {
  return new Response(new Blob([buffer]).stream().pipeThrough(stream)).arrayBuffer();
}

// 只讀描述(不解壓),給分頁上的「有存檔」標記用
export async function peek(id) {
  try {
    const rec = await tx('readonly', (s) => s.get(id));
    return rec ? { snapshot: rec.snapshot, savedAt: rec.savedAt, bytes: rec.bytes } : null;
  } catch {
    return null;
  }
}

export async function load(id, snapshot) {
  try {
    const rec = await tx('readonly', (s) => s.get(id));
    if (!rec) return null;
    if (rec.snapshot !== snapshot) {
      await remove(id);
      return null;
    }
    return { savedAt: rec.savedAt, state: await pipe(rec.state, new DecompressionStream('gzip')) };
  } catch {
    return null;
  }
}

export async function save(id, snapshot, state) {
  const packed = await pipe(state, new CompressionStream('gzip'));
  await tx('readwrite', (s) => s.put({ snapshot, savedAt: Date.now(), bytes: packed.byteLength, state: packed }, id));
  return packed.byteLength;
}

export async function remove(id) {
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {}
}
