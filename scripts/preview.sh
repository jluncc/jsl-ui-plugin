#!/usr/bin/env bash
# 生成本地预览页：集思录页面快照 + JSL Polish 样式，用于无头 Chrome 截图验收。
# 用法: ./scripts/preview.sh <快照html> <输出名> [light|dark]
set -euo pipefail

SNAPSHOT="$1"
NAME="$2"
THEME="${3:-light}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="/tmp/jsl-preview"
mkdir -p "$OUT"

python3 - "$SNAPSHOT" "$OUT/$NAME.html" "$THEME" "$ROOT" <<'PY'
import sys

src, dst, theme, root = sys.argv[1:5]
html = open(src, encoding="utf-8").read()

css = ""
for name in ("tokens.css", "global.css", "community.css"):
    css += open(f"{root}/src/styles/{name}", encoding="utf-8").read() + "\n"

# 模拟 content script 全部 DOM 增强（与 src/content 保持一致）
inject_style = f"<style>{css}</style>"

# 页面标志按快照内容判断，而不是文件名（与 index.ts applyPageFlags 保持一致）
flags = "jsl"
if "aw-wecenter" in html:
    flags += " jsl-community"
if "aw-question-list" in html:
    flags += " jsl-page-list"
if "aw-question-detail-box" in html:
    flags += " jsl-page-detail"
if "wrapper_content" in html or "header_navbar_bg" in html:
    flags += " jsl-page-portal"

sim = """
<script>
(function () {
  // polishHeaderLinks：清理「»首 页」装饰；「首页」入口去掉（logo 即首页）、「社区-知识库」简化为「社区」
  document.querySelectorAll('.span6.aw-logo > a[href]:not(:first-child)').forEach(function (link) {
    var text = (link.textContent || '').replace(/»/g, '').replace(/\\s+/g, '');
    if (!text) return;
    if (text === '首页') { link.hidden = true; return; }
    if (text.indexOf('社区') === 0) { link.textContent = '社区'; return; }
    link.textContent = text;
  });

  // polishPortalNav：门户导航简化（去首页、社区-知识库 → 社区）
  var portalHome = document.getElementById('top_nav_menu_home');
  if (portalHome) portalHome.remove();
  var portalForum = document.querySelector('#top_nav_menu_forum a');
  if (portalForum) portalForum.textContent = '社区';

  // injectThemeToggle：注入主题切换按钮；预览版点击直接翻转 data-theme
  // 社区页注入 WeCenter 顶栏末尾；门户首页注入搜索框之后（右侧控件簇起点）
  var communityWrap = document.querySelector('.aw-top-menu-wrap');
  var portalSearchBox = document.querySelector('.header_navbar_content .search_box');
  var injectTarget = communityWrap || portalSearchBox;
  var injectAfter = !communityWrap && portalSearchBox;
  if (injectTarget && !injectTarget.querySelector('.jsl-theme-toggle')) {
    var SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    var MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    var b = document.createElement('button');
    b.className = 'jsl-theme-toggle';
    b.type = 'button';
    var syncBtn = function () {
      var dark = document.documentElement.dataset.theme === 'dark';
      b.title = dark ? '切换到浅色模式' : '切换到深色模式';
      b.innerHTML = dark ? SUN : MOON;
    };
    b.addEventListener('click', function () {
      var root = document.documentElement;
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      syncBtn();
    });
    syncBtn();
    if (injectAfter) injectTarget.insertAdjacentElement('afterend', b);
    else injectTarget.appendChild(b);
  }

  // list.ts：卡片顶部两行导航——第一行分类+话题，第二行排序
  var list = document.querySelector('.aw-question-list');
  if (list) {
    var catUl = document.querySelector('.row.category ul');
    var sortUl = document.querySelector('.aw-main-content > .aw-reset-nav-tabs');
    var picked = {};
    [[catUl, 'cat'], [sortUl, 'sort']].forEach(function (p) {
      if (!p[0]) return;
      p[0].querySelectorAll('li').forEach(function (li) {
        var href = (li.querySelector('a') || {}).getAttribute ? (li.querySelector('a').getAttribute('href') || '') : '';
        var dim = p[1] === 'sort' && href.indexOf('/topic/') >= 0 ? 'topic' : p[1];
        li.setAttribute('data-dim', dim);
        var key = (li.textContent || '').replace(/\\s+/g, '');
        if (key && !picked[key]) picked[key] = li;
      });
    });
    var head = document.createElement('div');
    head.className = 'jsl-card-head';
    var rowMain = document.createElement('div');
    rowMain.className = 'jsl-card-head-row';
    var rowSort = document.createElement('div');
    rowSort.className = 'jsl-card-head-row jsl-card-head-sort';
    head.appendChild(rowMain);
    head.appendChild(rowSort);
    ['全部','债券/可转债','基金','套利','新股','闲聊','新手专区'].forEach(function (k) {
      if (picked[k]) rowMain.appendChild(picked[k]);
    });
    ['最新','热门','按发表时间'].forEach(function (k) {
      if (picked[k]) rowSort.appendChild(picked[k]);
    });
    Object.keys(picked).forEach(function (k) {
      if (!rowMain.contains(picked[k]) && !rowSort.contains(picked[k])) rowMain.appendChild(picked[k]);
    });
    list.insertBefore(head, list.firstChild);

    // 「热门」天数子筛并入排序行右端
    var dayTabs = document.querySelector('.aw-main-content > .aw-tabs');
    if (dayTabs) {
      dayTabs.classList.add('jsl-card-head-days');
      rowSort.appendChild(dayTabs);
    }

    // 站方对会员数据链接做了字符混淆（自定义字体渲染），预览环境显示为乱码——还原明文
    document.querySelectorAll('.aw-side-bar a[href*="member_data"]').forEach(function (a) {
      if ((a.textContent || '').indexOf('\uFFFD') >= 0) a.textContent = '特色数据、功能特权';
    });

    // 预览专用：排序/天数点击仅切换激活态（快照数据不随排序变化，真实站点行为不变）
    rowSort.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var li = a.parentElement;
        li.parentElement.querySelectorAll('li').forEach(function (x) { x.classList.remove('active'); });
        li.classList.add('active');
      });
    });
    var rc = document.querySelector('.row.category');
    if (rc) rc.remove();
    if (sortUl) sortUl.remove();

    // list.ts：价目条并入侧栏会员卡（标题之下、购买行之上）
    var promo = document.querySelector('.aw-main-content > .aw-item[style]');
    if (promo) {
      promo.classList.add('jsl-promo', 'jsl-promo-merged');
      var note = promo.querySelector("span[style*='color:#999']");
      if (note) {
        var welfareLink = note.parentElement && note.parentElement.nextElementSibling
          ? note.parentElement.nextElementSibling.querySelector('a') : null;
        if (welfareLink) welfareLink.textContent = '会员优惠 • 会员福利';
        note.remove();
      }
      var mc = document.querySelector(".aw-side-bar > div[style*='jsl_bg_member_info']");
      if (mc) mc.insertBefore(promo, mc.lastElementChild);
      else {
        var sb = document.querySelector('.aw-side-bar');
        if (sb) sb.prepend(promo);
      }
    }
  }

  // detail.ts：楼层号 + 回到顶部 + 长回复折叠（与真实扩展一致：滚动 600px 后出现）
  document.querySelectorAll('.aw-dynamic-topic > .aw-item').forEach(function (el, i) {
    var s = document.createElement('span');
    s.className = 'jsl-floor';
    s.textContent = '#' + (i + 2);
    el.appendChild(s);
  });
  var top = document.createElement('button');
  top.className = 'jsl-back-top';
  top.type = 'button';
  top.title = '回到顶部';
  top.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  top.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  var toggleTop = function () {
    top.classList.toggle('jsl-show', window.scrollY > 600);
  };
  window.addEventListener('scroll', toggleTop, { passive: true });
  toggleTop();
  document.body.appendChild(top);

  // 搜索结果页：结果由站方 AJAX 渲染，本地预览无后端、失败后行被清空——
  // sim 时点结果已在快照里（服务端直出），克隆备份；3 秒后若被站方 JS 清空则还原
  if (document.querySelector('.search_rows')) {
    var searchBackup = [];
    document.querySelectorAll('.search_rows').forEach(function (row) {
      searchBackup.push({ row: row, html: row.innerHTML });
    });
    setTimeout(function () {
      searchBackup.forEach(function (b) {
        if (!b.row.innerHTML.trim() && b.html.trim()) b.row.innerHTML = b.html;
      });
    }, 3000);
  }

  // 个人中心信息流：同为 AJAX 渲染，本地失败后主列只剩转圈——同款还原（4 秒，
  // 条件是 .aw-item 缺失，避免与站方正常渲染互相打架）
  var mainContent = document.querySelector('.aw-main-content');
  if (mainContent && mainContent.querySelector('.aw-item')) {
    var mainBackup = mainContent.innerHTML;
    setTimeout(function () {
      if (!mainContent.querySelector('.aw-item')) mainContent.innerHTML = mainBackup;
    }, 4000);
  }

  // 门户搜索联想弹窗：由站方 JS 异步构建，本地无后端不出现——
  // 烘焙一份静态打开态（数据/问题两组样例）供样式验收，真实站点不受影响
  var portalSearchBox = document.querySelector('.search_box');
  if (portalSearchBox && !document.getElementById('jsl-baked-suggest')) {
    var dd = document.createElement('div');
    dd.id = 'jsl-baked-suggest';
    dd.innerHTML =
      '<div class="search_type data"><div class="title">数据</div><div class="more"><a href="javascript:;">更多数据&gt;&gt;</a></div>' +
      '<div class="search_item"><a href="javascript:;"><div class="search_text">可转债</div><div class="search_info">数据</div></a></div>' +
      '<div class="search_item"><a href="javascript:;"><div class="search_text">可转债ETF</div><div class="search_info">数据</div></a></div></div>' +
      '<div class="search_type question"><div class="title">问题</div><div class="more"><a href="javascript:;">更多问题&gt;&gt;</a></div>' +
      '<div class="search_item"><a href="javascript:;"><div class="search_text">聊聊财务自由的几个层次</div><div class="search_info">212 个回答</div></a></div>' +
      '<div class="search_item"><a href="javascript:;"><div class="search_text">2026 转债策略及实盘</div><div class="search_info">495 个回答</div></a></div></div>';
    portalSearchBox.appendChild(dd);
  }

  // 长回复折叠
  document.querySelectorAll('.aw-dynamic-topic > .aw-item').forEach(function (item) {
    var content = item.querySelector('.aw-dynamic-topic-content');
    if (!content) return;
    var btn = document.createElement('button');
    btn.className = 'jsl-reply-expand-btn';
    btn.type = 'button';
    btn.textContent = '展开回复';
    btn.addEventListener('click', function () {
      var collapsed = item.classList.toggle('jsl-reply-collapsed');
      btn.textContent = collapsed ? '展开回复' : '收起回复';
      // 收起后内容大幅缩短，视口可能停在已消失的区域；滚到整条回复可见
      if (collapsed) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    var evaluateFold = function () {
      if (content.scrollHeight > 500) {
        // 按钮已挂载说明初判已折叠，复检不再动状态，避免覆盖用户手动展开/收起
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
    evaluateFold();
    content.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) {
        img.addEventListener('load', evaluateFold, { once: true });
        img.addEventListener('error', evaluateFold, { once: true });
      }
    });
  });
})();
</script>
"""

# 插入 base 让相对资源指向线上；样式注到 head 末尾（真实扩展的 CSS 也晚于站方生效）
if "</head>" in html:
    html = html.replace("</head>", f"<base href='https://www.jisilu.cn/'>{inject_style}</head>", 1)
else:
    html = inject_style + html

html = html.replace("<html", f"<html data-theme='{theme}' class='{flags}' ", 1)
html = html.replace("</body>", sim + "</body>", 1)

open(dst, "w", encoding="utf-8").write(html)
print(dst)
PY
