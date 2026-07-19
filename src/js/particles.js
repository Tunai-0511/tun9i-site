// 星光粒子(lavender / cosmic 限定)— 30fps 上限、分頁隱藏暫停
const THEME_STYLE = {
  lavender: { color: [200, 180, 255], count: 90 },
  cosmic: { color: [120, 140, 190], count: 60 },
  bento: null,
  sakura: { color: [225, 150, 175], count: 55 },
  aurora: { color: [150, 240, 215], count: 95 },
  noir: null,
};

export function initParticles() {
  const canvas = document.getElementById('fx-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  let raf = null;
  let last = 0;
  const FRAME = 1000 / 30;

  function resize() {
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
  }

  function seed(count) {
    stars = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.6 + 0.4,
      tw: Math.random() * Math.PI * 2,
      sp: Math.random() * 0.5 + 0.15,
      drift: (Math.random() - 0.5) * 0.00006,
    }));
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < FRAME) return;
    last = t;
    const style = THEME_STYLE[document.documentElement.dataset.theme];
    if (!style) return;
    const [r, g, b] = style.color;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      s.tw += 0.03 * s.sp;
      s.x = (s.x + s.drift + 1) % 1;
      const a = 0.25 + Math.abs(Math.sin(s.tw)) * 0.55;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.arc(s.x * W, s.y * H * 0.7, s.r * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function sync() {
    const style = THEME_STYLE[document.documentElement.dataset.theme];
    if (style && !document.hidden) {
      seed(style.count);
      canvas.classList.add('on');
      if (!raf) raf = requestAnimationFrame(frame);
    } else {
      canvas.classList.remove('on');
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  resize();
  addEventListener('resize', resize, { passive: true });
  addEventListener('themechange', sync);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    else sync();
  });
  sync();
}
