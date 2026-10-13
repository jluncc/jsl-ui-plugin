const BACK_TOP_SVG = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 19V5M5 12l7-7 7 7"/>
</svg>`;

/** 长回复折叠：内容超过阈值时默认收起，「展开回复 / 收起回复」双向切换 */
function foldLongReplies(): void {
  const THRESHOLD = 500;

  document.querySelectorAll('.aw-dynamic-topic > .aw-item').forEach((item) => {
    const content = item.querySelector<HTMLElement>('.aw-dynamic-topic-content');
    if (!content) return;

    const btn = document.createElement('button');
    btn.className = 'jsl-reply-expand-btn';
    btn.type = 'button';
    btn.textContent = '展开回复';
    btn.addEventListener('click', () => {
      const collapsed = item.classList.toggle('jsl-reply-collapsed');
      btn.textContent = collapsed ? '展开回复' : '收起回复';
      // 收起后内容大幅缩短，视口可能停在已消失的区域；滚到整条回复可见
      if (collapsed) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    // 折叠与否取决于内容实际高度（scrollHeight 不受 max-height 影响），
    // 图片懒加载完成后高度会变，需要复检；按钮已挂载说明初判已折叠，
    // 复检不再动状态，避免覆盖用户手动展开/收起
    const evaluate = () => {
      if (content.scrollHeight > THRESHOLD) {
        if (!btn.isConnected) {
          item.classList.add('jsl-reply-collapsed');
          // 插进正文容器末尾（meta 行之后）：item/mod-body 都是 flex 行，
          // 插在外面会变成同排 flex 子项；容器内部是普通文档流，
          // 展开态按钮才能块级独占一行。收起态按钮绝对定位，不受容器
          // overflow:hidden 影响，照常浮在渐隐区上
          content.insertAdjacentElement('beforeend', btn);
        }
      } else {
        item.classList.remove('jsl-reply-collapsed');
        btn.remove();
      }
    };

    evaluate();
    content.querySelectorAll('img').forEach((img) => {
      if (!img.complete) {
        img.addEventListener('load', evaluate, { once: true });
        img.addEventListener('error', evaluate, { once: true });
      }
    });
  });
}

/** 帖子详情页增强：回复楼层号 + 回到顶部按钮 + 长回复折叠 */
export function enhanceDetailPage(): void {
  addFloorNumbers();
  addBackToTop();
  foldLongReplies();
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
