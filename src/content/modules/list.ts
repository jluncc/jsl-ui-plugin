/** 帖子列表页增强：合并导航行 + 参考手绘稿的卡片结构 + 会员推广并入会员卡 */
export function enhanceListPage(): void {
  const list = document.querySelector<HTMLElement>('.aw-question-list');
  if (!list) return;

  makeRowsClickable(list);
  buildCardHead(list);
  mergePromoIntoMemberCard();
}

/** 帖子行整行可点击跳转（行内已有链接保持原生行为）。
 *  用事件委托：一个监听覆盖所有行，避免 30+ 行各挂一个 handler；
 *  noopener/noreferrer 阻止新窗口通过 window.opener 反向控制本页 */
function makeRowsClickable(list: HTMLElement): void {
  for (const item of list.querySelectorAll<HTMLElement>('.aw-item')) {
    item.classList.add('jsl-clickable');
  }

  list.addEventListener('click', (event) => {
    const target = event.target as Element;
    // 行内链接/按钮走原生行为（含中键、修饰键）
    if (target.closest('a, button')) return;
    const item = target.closest<HTMLElement>('.aw-item');
    if (!item || !list.contains(item)) return;
    const link = item.querySelector<HTMLAnchorElement>('.aw-questoin-content h4 a');
    if (link) window.open(link.href, '_blank', 'noopener,noreferrer');
  });
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
  // 话题页 / 个人中心等也有 .aw-question-list 但没有分类与排序条：
  // 没有收集到任何项时不生成卡片头，否则会留一条空灰带
  if (picked.size === 0) return;

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

  // 「热门」的天数子筛（30天/7天/当天，.aw-tabs）：并入排序行右端
  const dayTabs = document.querySelector('.aw-main-content > .aw-tabs');
  if (dayTabs) {
    dayTabs.classList.add('jsl-card-head-days');
    rowSort.appendChild(dayTabs);
  }

  // 来源容器已清空，整体移除避免残留空条（含 BBS 阅读模式、会员权益说明）
  document.querySelector('.row.category')?.remove();
  sortUl?.remove();

  // 站方对会员数据链接做了字符混淆（自定义字体渲染），扩展环境下显示为乱码——还原明文
  document
    .querySelectorAll<HTMLAnchorElement>('.aw-side-bar a[href*="member_data"]')
    .forEach((link) => {
      if (link.textContent?.includes('\uFFFD')) {
        link.textContent = '特色数据、功能特权';
      }
    });
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
