// scroll-driven fallback:不支援 animation-timeline 時用 rAF 模擬
export function initParallax() {
  if (CSS.supports('animation-timeline: scroll()')) return;
  document.documentElement.classList.add('no-scroll-timeline');

  const bg = document.querySelector('.hero-bg-img');
  const inner = document.querySelector('.hero-inner');
  const progress = document.getElementById('scroll-progress');
  let ticking = false;

  const update = () => {
    ticking = false;
    const vh = innerHeight;
    const y = scrollY;
    const p = Math.min(y / (vh * 0.9), 1);
    if (bg) bg.style.transform = `translateY(${p * 11}%) scale(${1 + p * 0.06})`;
    if (inner) {
      inner.style.transform = `translateY(${-p * 6}vh) scale(${1 - p * 0.05})`;
      inner.style.opacity = String(1 - p);
    }
    const doc = document.documentElement;
    const total = doc.scrollHeight - vh;
    if (progress) progress.style.transform = `scaleX(${total > 0 ? y / total : 0})`;
  };

  addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}
