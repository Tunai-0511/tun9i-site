// 工具列圖示:24×24、1.75 線寬、跟著 currentColor
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICON = {
  power: svg('<path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z"/>'),
  pause: svg('<path d="M9 5.5v13M15 5.5v13"/>'),
  restart: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
  keys: svg('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h1M10.5 10h1M14.5 10h1M7 14h10"/>'),
  keyboard: svg('<rect x="2.5" y="5" width="19" height="11" rx="2.5"/><path d="M6.5 9h1M10.5 9h1M14.5 9h1M7.5 12.5h9M9 20l3-2.5 3 2.5"/>'),
  type: svg('<path d="M5 6.5V5h14v1.5M12 5v14M9.5 19h5"/>'),
  mouse: svg('<rect x="6.5" y="3" width="11" height="18" rx="5.5"/><path d="M12 7v3.5"/>'),
  camera: svg('<path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3V19H4z"/><circle cx="12" cy="13.5" r="3.3"/>'),
  full: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  sound: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
  muted: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  out: svg('<path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/>'),
};
