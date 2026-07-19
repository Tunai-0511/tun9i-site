// 進場編排 + count-up + scrollspy
export function initReveal() {
  // 為同層的 reveal 元素標 stagger 序號
  document.querySelectorAll('.reveal').forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    el.style.setProperty('--stagger-i', siblings.indexOf(el));
  });

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // failsafe:任何環境下(IO 失效、rAF 停擺)內容都不能永遠隱藏
  setTimeout(() => {
    document.querySelectorAll('.reveal:not(.in)').forEach((el) => el.classList.add('in'));
  }, 4000);

  // 數字 count-up
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const counters = document.querySelectorAll('[data-count]');
  const cio = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        cio.unobserve(e.target);
        const target = Number(e.target.dataset.count);
        if (reducedMotion) { e.target.textContent = String(target); continue; }
        const t0 = performance.now();
        const dur = 1400;
        const tick = (t) => {
          const p = Math.min((t - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 4);
          e.target.textContent = String(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        // rAF 停擺時的保底
        setTimeout(() => { e.target.textContent = String(target); }, dur + 600);
      }
    },
    { threshold: 0.6 }
  );
  counters.forEach((el) => cio.observe(el));

  // scrollspy
  const links = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  const sections = links
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  const sio = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) =>
          a.classList.toggle('active', a.getAttribute('href') === `#${e.target.id}`)
        );
      }
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );
  sections.forEach((s) => sio.observe(s));
}
