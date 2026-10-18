/** 设置页「基本资料」：
 *  1. 站方把「会员信息」「基本信息」两段塞进同一个 .aw-mod，拆成两张独立卡；
 *  2. 绑定手机 / 介绍行做单行归整（站方用内联 50px 间距裸排，改交 CSS flex gap），
 *     并清掉空 dd（占掉 grid 一行 + 10px row-gap）。
 *  均幂等：卡带 data 标记，行带 jsl-inline-row 类。 */
export function enhanceSettingsPage(): void {
  wrapSaveButton();
  splitSettingsCards();
  normalizeRows();
}

/** 保存按钮归位成「卡片页脚条」：站方三种挂法都要覆盖——
 *  ① 已有包裹 div（基本资料页）：直接复用 CSS；
 *  ② 直接挂 .tab-content 下（隐私/提醒页）：原地补包裹 div；
 *  ③ 挂在 form 内部（安全设置页）：把按钮搬到 .tab-content 末尾的包裹 div。
 *     点按走的是 onclick="doModify()"（按 id 取表单做 serializeObjectToJson），
 *     按钮移出 form 不影响提交。 */
function wrapSaveButton(): void {
  const save = document.querySelector<HTMLElement>(
    '.aw-user-setting .tab-content .aw-user-setting-save',
  );
  if (!save) return;
  // 已在专属包裹里（父级不是 form / tab-content）→ 无需处理
  const parent = save.parentElement;
  if (!parent) return;
  const inForm = parent.tagName === 'FORM';
  const direct = parent.classList.contains('tab-content');
  if (!inForm && !direct) return;

  const wrap = document.createElement('div');
  if (inForm) {
    parent.closest<HTMLElement>('.tab-content')?.appendChild(wrap);
  } else {
    save.replaceWith(wrap);
  }
  wrap.appendChild(save);
}

function splitSettingsCards(): void {
  const mod = document.querySelector<HTMLElement>('.aw-user-setting .tab-content > .aw-mod');
  if (!mod || mod.dataset.jslSplit === '1') return;

  const children = [...mod.children];
  const secondHead = children.findIndex(
    (el, index) => index > 0 && el.classList.contains('aw-mod-head'),
  );
  if (secondHead < 0) return;

  const first = document.createElement('div');
  first.className = 'aw-mod';
  const second = document.createElement('div');
  second.className = 'aw-mod';
  children.forEach((child, index) => {
    (index < secondHead ? first : second).appendChild(child);
  });
  first.dataset.jslSplit = '1';
  second.dataset.jslSplit = '1';
  mod.replaceWith(first, second);
}

function normalizeRows(): void {
  const layouts = document.querySelectorAll<HTMLElement>(
    '.aw-user-setting .aw-user-setting-layout',
  );
  for (const layout of layouts) {
    for (const dl of layout.querySelectorAll<HTMLDListElement>(':scope > dl')) {
      // 站方模板残留的空 dd：占掉 grid 第二行 + 10px row-gap（绑定手机行）
      for (const dd of dl.querySelectorAll<HTMLElement>(':scope > dd')) {
        if (!(dd.textContent ?? '').trim() && !dd.querySelector('input, img, select, textarea, button')) {
          dd.remove();
        }
      }

      const dd = dl.querySelector<HTMLElement>(':scope > dd');
      if (!dd) continue;
      const dtText = (dl.querySelector(':scope > dt')?.textContent ?? '').trim();
      const inlineRow =
        dtText.startsWith('绑定手机') || dd.classList.contains('aw-user-setting-base-introduce');
      if (!inlineRow) continue;

      dl.classList.add('jsl-inline-row');
      // 站方在 span/a 上用内联 50px 间距排版：清掉交回 flex gap
      for (const el of dd.querySelectorAll<HTMLElement>('span, a')) {
        el.style.removeProperty('padding-left');
        el.style.removeProperty('margin-left');
      }
      // 按钮组 span 里的 &nbsp; 占位文本会变成一个 0 宽 flex 项、多出一份 gap
      for (const span of dd.querySelectorAll<HTMLElement>('span')) {
        for (const node of [...span.childNodes]) {
          if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').replace(/[\s\u00a0]/g, '')) {
            node.remove();
          }
        }
      }
    }
  }
}
