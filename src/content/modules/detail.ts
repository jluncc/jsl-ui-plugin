const BACK_TOP_SVG = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 19V5M5 12l7-7 7 7"/>
</svg>`;

/** 帖子详情页增强：回复楼层号 + 回到顶部按钮 */
export function enhanceDetailPage(): void {
  addFloorNumbers();
  addBackToTop();
}

function addFloorNumbers(): void {
  const replies = document.querySelectorAll('.aw-dynamic-topic > .aw-item');
  replies.forEach((reply, index) => {
    if (reply.querySelector('.jsl-floor')) return;
    const floor = document.createElement('span');
    floor.className = 'jsl-floor';
    floor.textContent = `#${index + 2}`;
    reply.appendChild(floor);
  });
}

function addBackToTop(): void {
  const button = document.createElement('button');
  button.className = 'jsl-back-top';
  button.type = 'button';
  button.title = '回到顶部';
  button.innerHTML = BACK_TOP_SVG;
  button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const toggle = () => button.classList.toggle('jsl-show', window.scrollY > 600);
  window.addEventListener('scroll', toggle, { passive: true });
  toggle();
  document.body.appendChild(button);
}
