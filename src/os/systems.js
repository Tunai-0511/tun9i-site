// 作業系統博物館的展品清單。
//
// 磁碟映像是 v86 專案預先裝好的版本(i.copy.sh),整理成 1 MiB 一塊、zstd 壓縮,
// 放在 R2 的 disk/ 底下;線上由 worker.js 的 /os/disk/* 提供,開發時由 vite.config.js 提供。
// 訪客只會下載實際讀到的那幾塊。
//
// snapshot 是「已經開機到桌面」的記憶體快照,用本站釘死的 v86 版本做的(換 v86 版本要重做,
// 舊快照的格式不保證相容)。換了快照就改 snapshot 的版號:訪客瀏覽器裡的存檔帶著版號,
// 對不上就會被丟掉,改從新快照開機。
//
// 快照怎麼做:開 /os/?author#<id>,從磁碟冷開機到桌面,在主控台跑
//   await __os.save()
// 檔案會寫進 .os-images/states/,再壓成 .zst 放進 .os-images/r2/disk/state/ 上傳。

const MB = 1024 * 1024;

const chunked = (dir, size) => ({
  url: `/os/disk/${dir}/.img.zst`,
  size,
  async: true,
  fixed_chunk_size: MB,
  use_parts: true,
});

export const SYSTEMS = [
  {
    id: 'haiku',
    name: 'Haiku',
    since: 2001,
    version: 'R1/beta5',
    license: 'MIT',
    memory: 512 * MB,
    acpi: true,
    hda: chunked('haiku-v5', 1342177280),
    snapshot: 'haiku-2',
    stateBytes: 39921968,
    // 快照裡的解析度與待機時顯示的桌面截圖(public/os/,檔名帶版號,換圖就改號)
    screen: [1024, 768],
    poster: '/os/poster-haiku-v2.webp',
    homepage: 'https://www.haiku-os.org/',
    source: 'https://github.com/haiku/haiku',
  },
  {
    id: 'reactos',
    name: 'ReactOS',
    since: 1998,
    version: '0.4.15',
    license: 'GPL-2.0',
    memory: 512 * MB,
    acpi: true,
    hda: chunked('reactos-v3', 734003200),
    // 快照裡的硬體要跟做快照時一模一樣:ReactOS 裝的是 virtio 網卡(沒接網路,只是卡要在)
    net: 'virtio',
    snapshot: 'reactos-2',
    stateBytes: 16832159,
    // 快照裡的解析度與待機時顯示的桌面截圖(public/os/,檔名帶版號,換圖就改號)
    screen: [1024, 768],
    poster: '/os/poster-reactos-v2.webp',
    homepage: 'https://reactos.org/',
    source: 'https://github.com/reactos/reactos',
  },
  {
    id: 'serenity',
    name: 'SerenityOS',
    since: 2018,
    version: '1.0-dev (1dc85fc)',
    license: 'BSD-2-Clause',
    memory: 512 * MB,
    acpi: false,
    hda: chunked('serenity-v3', 734003200),
    snapshot: 'serenity-2',
    stateBytes: 11702843,
    // 快照裡的解析度與待機時顯示的桌面截圖(public/os/,檔名帶版號,換圖就改號)
    screen: [1024, 768],
    poster: '/os/poster-serenity-v2.webp',
    homepage: 'https://serenityos.org/',
    source: 'https://github.com/SerenityOS/serenity',
  },
  {
    id: 'linux',
    name: 'Linux',
    distro: 'SliTaz',
    since: 1991,
    version: 'SliTaz 5.0 · kernel 3.16',
    license: 'GPL-2.0',
    memory: 512 * MB,
    acpi: false,
    // ISO 本身是 56573952 bytes,最後一塊補零到滿 1 MiB
    hda: chunked('slitaz-2024', 54 * MB),
    snapshot: 'linux-2',
    stateBytes: 70125100,
    // 快照裡的解析度與待機時顯示的桌面截圖(public/os/,檔名帶版號,換圖就改號)
    screen: [1280, 720],
    poster: '/os/poster-linux-v2.webp',
    homepage: 'https://www.slitaz.org/',
    source: 'https://www.slitaz.org/en/devel/',
  },
  // 第五台:平常看不到,四台電腦裡的彩蛋拼出通關密語後才出現(main.js 的 PASSPHRASE)
  {
    id: 'kolibri',
    name: 'KolibriOS',
    hidden: true,
    since: 2004,
    version: '0.7.7.0+9240',
    license: 'GPL-2.0',
    memory: 128 * MB,
    acpi: false,
    // 整套系統就是一張 1.44 MB 的磁片,一次下載完
    fda: { url: '/os/disk/kolibri-20261017.img', size: 1474560, async: false },
    snapshot: 'kolibri-1',
    stateBytes: 1744260,
    screen: [1024, 768],
    poster: '/os/poster-kolibri-v1.webp',
    homepage: 'https://kolibrios.org/',
    source: 'https://git.kolibrios.org/KolibriOS/kolibrios',
  },
];

export const byId = (id) => SYSTEMS.find((s) => s.id === id);
export const stateUrl = (sys) => `/os/disk/state/${sys.snapshot}.bin.zst`;
