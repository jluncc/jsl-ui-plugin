const BACK_TOP_SVG = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 19V5M5 12l7-7 7 7"/>
</svg>`;

/** 长回复折叠：内容超过阈值时默认收起，「展开回复 / 收起回复」双向切换 */
function foldLongReplies(): void {
  const THRESHOLD = 500;
  const items = document.querySelectorAll<HTMLElement>('.aw-dynamic-topic > .aw-item');

  /** 折叠与否取决于内容实际高度（scrollHeight 不受 max-height 影响）。
   *  图片懒加载会改变高度，由下方一条委托监听统一复检；
   *  按钮已挂载说明初判已折叠，复检不再动状态，避免覆盖用户手动展开/收起 */
  const evaluate = (item: HTMLElement, content: HTMLElement, btn: HTMLButtonElement) => {
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

  for (const item of items) {
    const content = item.querySelector<HTMLElement>('.aw-dynamic-topic-content');
    if (!content) continue;

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

    // 记到元素上供委托回调复用，避免每次重查 DOM
    (content as HTMLElement & { __jslFold?: () => void }).__jslFold = () =>
      evaluate(item, content, btn);
    evaluate(item, content, btn);
  }

  // 一条委托监听覆盖所有回复里的图片加载/失败：比逐图挂监听少 N 个 handler，
  // 也能覆盖站方后续动态插入的图片（capture 阶段，load 不冒泡）
  const topic = document.querySelector('.aw-dynamic-topic');
  topic?.addEventListener(
    'load',
    (event) => {
      const target = event.target as Element;
      if (target.tagName !== 'IMG') return;
      const content = target.closest<HTMLElement>('.aw-dynamic-topic-content');
      (content as (HTMLElement & { __jslFold?: () => void }) | null)?.__jslFold?.();
    },
    true,
  );
  topic?.addEventListener(
    'error',
    (event) => {
      const target = event.target as Element;
      if (target.tagName !== 'IMG') return;
      const content = target.closest<HTMLElement>('.aw-dynamic-topic-content');
      (content as (HTMLElement & { __jslFold?: () => void }) | null)?.__jslFold?.();
    },
    true,
  );
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
