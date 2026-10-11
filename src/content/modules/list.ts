/** 帖子列表页增强：合并导航行 + 参考手绘稿的卡片结构 + 会员推广并入会员卡 */
export function enhanceListPage(): void {
  const list = document.querySelector<HTMLElement>('.aw-question-list');
  if (!list) return;

  makeRowsClickable(list);
  buildCardHead(list);
  mergePromoIntoMemberCard();
}

/** 帖子行整行可点击跳转（行内已有链接保持原生行为） */
function makeRowsClickable(list: HTMLElement): void {
  for (const item of list.querySelectorAll<HTMLElement>('.aw-item')) {
    const link = item.querySelector<HTMLAnchorElement>('.aw-questoin-content h4 a');
    if (!link) continue;
    item.classList.add('jsl-clickable');
    item.addEventListener('click', (event) => {
      if ((event.target as Element).closest('a')) return;
      window.open(link.href, '_blank');
    });
  }
}

/** 手绘稿：卡片顶部两行导航——第一行分类+话题，第二行排序；BBS 开关与权益说明随分类条移除 */
function buildCardHead(list: HTMLElement): void {
  const categoryUl = document.querySelector('.row.category ul');
  const sortUl = document.querySelector('.aw-main-content > .aw-reset-nav-tabs');
  if (!categoryUl && !sortUl) return;

  const picked = new Map<string, HTMLElement>();
  const collect = (ul: Element | null, dim: string) => {
    if (!ul) return;
    for (const li of ul.querySelectorAll('li')) {
      const href = li.querySelector('a')?.getAttribute('href') || '';
      // 闲聊/新手专区虽来自排序条，实为话题入口，归入第一行
      const realDim = dim === 'sort' && href.includes('/topic/') ? 'topic' : dim;
      li.dataset.dim = realDim;
      const key = (li.textContent || '').replace(/\s+/g, '');
      if (key && !picked.has(key)) picked.set(key, li);
    }
  };
  collect(categoryUl, 'cat');
  collect(sortUl, 'sort');

  const head = document.createElement('div');
  head.className = 'jsl-card-head';
  const rowMain = document.createElement('div');
  rowMain.className = 'jsl-card-head-row';
  const rowSort = document.createElement('div');
  rowSort.className = 'jsl-card-head-row jsl-card-head-sort';
  head.append(rowMain, rowSort);

  // 顺序按手绘稿：第一行=全部、分类、话题；第二行=最新、热门、按发表时间
  const desiredMain = ['全部', '债券/可转债', '基金', '套利', '新股', '闲聊', '新手专区'];
  const desiredSort = ['最新', '热门', '按发表时间'];
  const placed = new Set<string>();
  for (const key of desiredMain) {
    const li = picked.get(key);
    if (li) {
      rowMain.appendChild(li);
      placed.add(key);
    }
  }
  for (const key of desiredSort) {
    const li = picked.get(key);
    if (li) {
      rowSort.appendChild(li);
      placed.add(key);
    }
  }
  for (const [key, li] of picked) {
    if (!placed.has(key)) rowMain.appendChild(li);
  }
  list.insertBefore(head, list.firstChild);

  // 来源容器已清空，整体移除避免残留空条（含 BBS 阅读模式、会员权益说明）
  document.querySelector('.row.category')?.remove();
  sortUl?.remove();
}

/** 手绘稿：侧栏只留「集思录会员」「热门话题」两卡，价目条并入会员卡内部 */
function mergePromoIntoMemberCard(): void {
  const promo = document.querySelector<HTMLElement>('.aw-main-content > .aw-item[style]');
  if (!promo) return;
  promo.classList.add('jsl-promo', 'jsl-promo-merged');

  // 站方把「• 会员优惠」挂在第二行末尾，语义上属于第三行；规范化为「会员优惠 • 会员福利」
  const note = promo.querySelector<HTMLSpanElement>("span[style*='color:#999']");
  if (note) {
    const welfareLink = note.parentElement?.nextElementSibling?.querySelector('a');
    if (welfareLink) welfareLink.textContent = '会员优惠 • 会员福利';
    note.remove();
  }

  const memberCard = document.querySelector<HTMLElement>(
    ".aw-side-bar > div[style*='jsl_bg_member_info']",
  );
  if (memberCard) {
    // 插在标题之下、描述/购买行之上
    memberCard.insertBefore(promo, memberCard.lastElementChild);
  } else {
    document.querySelector('.aw-side-bar')?.prepend(promo);
  }
}
