// 作業系統博物館:把作者模式存下來的快照(.os-images/states/<名字>.bin.gz)
// 轉成 v86 讀的 zstd(.os-images/r2/disk/state/<名字>.bin.zst),順便印出大小給 systems.js 的 stateBytes。
// 用法:node scripts/os-pack-state.mjs linux-1 [haiku-2 ...]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve('.os-images');
for (const name of process.argv.slice(2)) {
  const src = path.join(root, 'states', `${name}.bin.gz`);
  const raw = zlib.gunzipSync(fs.readFileSync(src));
  const zst = zlib.zstdCompressSync(raw, {
    params: {
      // 22 + 128 MB 長距離視窗:比預設的 19 小一成多,v86 的解壓器實測吃得下
      [zlib.constants.ZSTD_c_compressionLevel]: 22,
      [zlib.constants.ZSTD_c_windowLog]: 27,
      [zlib.constants.ZSTD_c_enableLongDistanceMatching]: 1,
      [zlib.constants.ZSTD_c_checksumFlag]: 1,
    },
  });
  const out = path.join(root, 'r2/disk/state', `${name}.bin.zst`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, zst);
  console.log(`${name}: raw ${(raw.length / 2 ** 20).toFixed(1)} MB → ${out} ${zst.length} bytes (${(zst.length / 2 ** 20).toFixed(1)} MB)`);
}
