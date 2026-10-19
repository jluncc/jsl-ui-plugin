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
import json
import os
import re
import sys

src, dst, theme, root = sys.argv[1:5]
html = open(src, encoding="utf-8").read()

# 投资日历事件快照（scripts/refresh-calendar-events.mjs 抓取）。
# 预览服务没有站方 AJAX 后端，用这份真实响应替代 eventSources。
calendar_events = {}
calendar_events_path = os.path.join(os.path.dirname(dst), "calendar-events.json")
if os.path.exists(calendar_events_path):
    try:
        calendar_events = json.load(open(calendar_events_path, encoding="utf-8"))
    except (OSError, ValueError):
        calendar_events = {}
calendar_events_json = json.dumps(calendar_events, ensure_ascii=False)

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
if "aw-topic-detail-title" in html:
    flags += " jsl-page-topic"
if "wrapper_content" in html or "header_navbar_bg" in html:
    flags += " jsl-page-portal"
if "content_box" in html:
    flags += " jsl-page-auth"
if re.search(r"""id=["']calendar["']""", html):
    flags += " jsl-page-calendar"
if "auto-content-width" in html:
    flags += " jsl-page-data"
elif 'layout-default' in html and 'header_subnavbar_bg' in html:
    flags += " jsl-page-data"
if "data_content" in html and "header_subnavbar_bg" in html and "wrapper_content" not in html:
    flags += " jsl-page-data-legacy"

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
  // 数据页（Vue 架构）菜单没有 id，按文案兜底（与 index.ts 同步）
  document.querySelectorAll('.header_navbar_content .menu ul li a').forEach(function (link) {
    var text = (link.textContent || '').trim();
    var href = link.getAttribute('href') || '';
    if (text === '首页' && href === '/') {
      var li = link.closest('li');
      if (li) li.remove();
    } else if (text.indexOf('社区') === 0 && text !== '社区') {
      link.textContent = '社区';
    }
  });

  // injectThemeToggle：注入主题切换按钮；预览版点击直接翻转 data-theme
  // 社区页注入 WeCenter 顶栏末尾；门户首页注入搜索框之后（右侧控件簇起点）
  var communityWrap = document.querySelector('.aw-top-menu-wrap');
  var portalSearchBox = document.querySelector('.header_navbar_content .search_box, .header_navbar_content .search');
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

  // 投资日历：事件由站方 AJAX（/data/calendar/get_calendar_data/）拉取，
  // 本地静态服务没有后端 → 在站方 ready 初始化 FullCalendar 之前劫持 $.ajax，
  // 用真实响应快照应答。必须在首帧前喂入：renderEvent 后补事件不会触发
  // 月视图行高重算，密集日期会溢出单元格（实测 46 条/天时溢出 800px+）。
  // 只影响本地预览页，扩展不注入任何事件。
  var CAL_EVENTS = __CALENDAR_EVENTS__;
  if (window.jQuery && document.getElementById('calendar')) {
    (function ($) {
      var origAjax = $.ajax;
      $.ajax = function (opts) {
        if (opts && typeof opts === 'object' && typeof opts.url === 'string' &&
            opts.url.indexOf('/data/calendar/get_calendar_data/') >= 0) {
          var m = /[?&]qtype=([^&]+)/.exec(opts.url);
          var type = m ? decodeURIComponent(m[1]) : '';
          var data = CAL_EVENTS[type] || [];
          var xhr = $.Deferred();
          setTimeout(function () {
            if (opts.success) opts.success(data, 'success', xhr);
            if (opts.complete) opts.complete(xhr, 'success');
            xhr.resolve(data, 'success', xhr);
          }, 0);
          return xhr.promise();
        }
        return origAjax.apply(this, arguments);
      };
    })(window.jQuery);
  }

  // FullCalendar 按容器宽度算事件内联 left/width，
  // CSS 收窄容器后需要 resize 让它重算（与 index.ts reflowCalendar 同步）
  if (document.getElementById('calendar')) {
    var fireResize = function () { window.dispatchEvent(new Event('resize')); };
    fireResize();
    window.addEventListener('load', fireResize, { once: true });
    setTimeout(fireResize, 600);
    setTimeout(fireResize, 1500);

    // 跨周续接段（无 fc-event-start）是 left:0、起始段是 left:3px，
    // 圆角卡片下续接段会凸出 3px——内缩 3px 且宽度 -3，右缘不动（与 index.ts 同步）
    var normalizeEventInsets = function () {
      document.querySelectorAll('#calendar .fc-event:not(.fc-event-start)').forEach(function (el) {
        if (parseFloat(el.style.left || '0') !== 0) return;
        var w = parseFloat(el.style.width);
        if (!isFinite(w)) return;
        el.style.left = '3px';
        el.style.width = (w - 3) + 'px';
      });
    };
    normalizeEventInsets();
    var queued = false;
    var scheduleNormalize = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; normalizeEventInsets(); });
    };
    new MutationObserver(scheduleNormalize).observe(document.getElementById('calendar'), {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
    window.addEventListener('load', scheduleNormalize, { once: true });
    setTimeout(scheduleNormalize, 600);
    setTimeout(scheduleNormalize, 1500);
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

  // portal.ts：门户首页内容区重排（与 src/content/modules/portal.ts 双实现同步）——
  // 收费数据移除 / 温度计上移左栏「市场温度」区 / 日历折叠开关移除 / APP 链接入页脚
  (function () {
    var memberTitle = document.getElementById('home-member-data');
    if (memberTitle && memberTitle.parentElement) memberTitle.parentElement.remove();

    var indBox = document.querySelector('.first_column .right .title_box .indicator');
    var leftCol = document.querySelector('.first_column .left');
    if (indBox && leftCol) {
      var section = document.createElement('div');
      section.className = 'jsl-temp-panel';
      var secTitle = document.createElement('div');
      secTitle.className = 'title';
      secTitle.textContent = '市场温度';
      var cells = document.createElement('div');
      cells.className = 'cells';
      Array.prototype.slice.call(indBox.children).forEach(function (a) {
        cells.appendChild(a);
      });
      section.appendChild(secTitle);
      section.appendChild(cells);
      leftCol.insertBefore(section, leftCol.firstElementChild);
      indBox.remove();
    }

    var calToggle = document.getElementById('cal-btn-toggle');
    if (calToggle) calToggle.remove();

    // 「社区-知识库」tab 文案简化为「社区」（与 portal.ts polishCommunityTab 同步；
    // 页面有两个 .tag_top，按文案命中）
    document.querySelectorAll('.tag_top .active').forEach(function (el) {
      if (/社区/.test(el.textContent || '')) el.textContent = '社区';
    });

    // 本周热点正文 → 竖排编号列表（与 portal.ts layoutInvestmentEvents 同步）：
    // 4 条事件均分行高、细线分隔，标题条简化为区名「本周热点」
    var eventText = document.querySelector('.first_column .right .content .text');
    if (eventText && !eventText.querySelector('.jsl-event-list')) {
      var segments = [];
      var buffer = [];
      var flushBuf = function () {
        if (!buffer.length) return;
        var wrap = document.createElement('div');
        buffer.forEach(function (n) { wrap.appendChild(n.cloneNode(true)); });
        var html = wrap.innerHTML.replace(/^[\\s\\u00a0]+/, '').trim();
        if (html) segments.push(html);
        buffer = [];
      };
      Array.prototype.slice.call(eventText.childNodes).forEach(function (node) {
        if (node.nodeName === 'BR') { flushBuf(); return; }
        buffer.push(node);
      });
      flushBuf();
      if (segments.length) {
        var list = document.createElement('div');
        list.className = 'jsl-event-list';
        segments.forEach(function (seg, i) {
          var row = document.createElement('div');
          row.className = 'jsl-event-row';
          var idx = document.createElement('span');
          idx.className = 'idx';
          idx.textContent = String(i + 1).padStart(2, '0');
          var txt = document.createElement('span');
          txt.className = 'txt';
          txt.innerHTML = seg;
          var first = txt.firstChild;
          if (first && first.nodeType === 3) {
            var raw = (first.textContent || '').trim();
            var cut = raw.indexOf('\uFF1A');
            if (cut > 0) {
              var name = document.createElement('span');
              name.className = 'name';
              name.textContent = raw.slice(0, cut);
              first.textContent = '\uFF1A' + raw.slice(cut + 1);
              txt.insertBefore(name, first);
            }
          }
          row.appendChild(idx);
          row.appendChild(txt);
          list.appendChild(row);
        });
        eventText.replaceWith(list);
      }
      var hotTitle = document.querySelector('.first_column .right .title_box .title a');
      if (hotTitle) hotTitle.textContent = '本周热点';
      // 「全文>>」按钮：标题条仍可进入原帖，入口冗余（与 portal.ts 同步移除）
      var moreBtn = document.querySelector('.first_column .right .content .more');
      if (moreBtn) moreBtn.remove();
    }

    var editLinks = document.querySelector('.first_column .right .edit_links');
    var footerLeft = document.querySelector('.footer_bg .footer_left');
    if (editLinks && footerLeft) {
      var keep = [];
      editLinks.querySelectorAll('a').forEach(function (a) {
        var t = (a.textContent || '').trim();
        if (t === '苹果APP' || t === '安卓APP' || t.indexOf('用户指引') === 0) keep.push(a);
      });
      if (keep.length) {
        var row = document.createElement('div');
        row.className = 'jsl-footer-apps';
        keep.forEach(function (a) {
          a.querySelectorAll('font').forEach(function (f) {
            while (f.firstChild) f.parentNode.insertBefore(f.firstChild, f);
            f.remove();
          });
          row.appendChild(a);
        });
        var legalRow = null;
        Array.prototype.slice.call(footerLeft.children).forEach(function (d) {
          if (!legalRow && /用户协议/.test(d.textContent || '')) legalRow = d;
        });
        if (legalRow) legalRow.insertAdjacentElement('afterend', row);
        else footerLeft.appendChild(row);
      }
      editLinks.remove();
    }

    // 页脚文案整理：7 行压成 4 行（与 portal.ts reorganizeFooter 同步）——
    // 版权·邮箱 / 产品与法律链接（并入 APP 行）/ 备案合行 / 声明；删浏览器推荐行
    var sponsorTitle = document.querySelector('.footer_ad_box .title');
    if (sponsorTitle) sponsorTitle.textContent = '赞助商';
    if (footerLeft && !footerLeft.querySelector('.jsl-footer-meta')) {
      var fRows = Array.prototype.slice.call(footerLeft.children);
      var fPlain = function (e) { return (e.textContent || '').replace(/\\s+/g, ''); };
      var fFind = function (re) { return fRows.find(function (d) { return re.test(fPlain(d)); }); };
      var fCopyright = fFind(/版权所有/);
      var fEmail = fFind(/客服邮箱/);
      var fLegal = fFind(/用户协议/);
      var fBeianGov = fRows.find(function (d) { return d.querySelector('a[href*="beian.gov.cn"]'); });
      var fBeianMiit = fFind(/京ICP证/);
      var appsRow = footerLeft.querySelector('.jsl-footer-apps');
      // 登录/注册页没有文章卡（无 APP 链接行）：新建一个只放法律链接的同款行
      if (!appsRow) { appsRow = document.createElement('div'); appsRow.className = 'jsl-footer-apps'; }
      var statement = footerLeft.querySelector('.statement');
      if (fCopyright && fEmail && fLegal) {
        var dotEl = function () { var s = document.createElement('span'); s.className = 'jsl-footer-dot'; s.textContent = '·'; return s; };
        var metaRow = document.createElement('div');
        metaRow.className = 'jsl-footer-meta';
        metaRow.appendChild(document.createTextNode(fPlain(fCopyright)));
        metaRow.appendChild(dotEl());
        metaRow.appendChild(document.createTextNode(fPlain(fEmail)));
        fLegal.querySelectorAll('a').forEach(function (a) { appsRow.appendChild(a); });
        var beianRow = document.createElement('div');
        beianRow.className = 'jsl-footer-beian';
        if (fBeianGov) Array.prototype.slice.call(fBeianGov.childNodes).forEach(function (n) { beianRow.appendChild(n.cloneNode(true)); });
        if (fBeianMiit) {
          beianRow.appendChild(dotEl());
          Array.prototype.slice.call(fBeianMiit.childNodes).forEach(function (n) { beianRow.appendChild(n.cloneNode(true)); });
        }
        if (statement) statement.remove();
        Array.prototype.slice.call(footerLeft.children).forEach(function (c) { c.remove(); });
        footerLeft.appendChild(metaRow);
        footerLeft.appendChild(appsRow);
        footerLeft.appendChild(beianRow);
        if (statement) footerLeft.appendChild(statement);
      }
    }

    // 预览烘焙：温度数据走站方 AJAX，本地无后端 canvas 空白——按站方 indicator.js
    // 的半环仪表样式（四段色带/外向刻度/指针/温度文案）画仿真占位，真实站点不受影响
    document.querySelectorAll('.jsl-temp-panel .cells > a').forEach(function (a, i) {
      var canvas = a.querySelector('canvas');
      if (!canvas) {
        // curl 快照是服务端原始 HTML，canvas 由站方 indicator.js 运行时创建——缺则自建
        //（2x 属性尺寸 + 100px CSS 宽，匹配左栏格子宽度），真实站点不受影响
        canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 160;
        canvas.style.width = '100px';
        canvas.style.height = '80px';
        var host = a.firstElementChild || a;
        host.appendChild(canvas);
      }
      var ctx = canvas.getContext('2d');
      if (!ctx) return;
      var label = i === 0 ? 'A股温度' : '转债温度';
      var value = i === 0 ? 38 : 78;
      var dark = document.documentElement.dataset.theme === 'dark';
      var ink = dark ? '#8b949e' : '#57606a';
      var dpr = canvas.width / 100;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, 100, 80);
      // 盘面 center 58%（模拟 nudgeGaugeLabels 的 center ['50%','58%']，默认 50%
      // 时上方 2px/下方 14px 头重脚轻）——cy=46 让盘面+文字整体上下居中
      var cx = 50, cy = 46, r = 38;
      var segs = [[0, '#00CCFF'], [0.25, '#468847'], [0.5, '#F89406'], [0.75, '#B94A48']];
      segs.forEach(function (s, idx) {
        var end = idx < segs.length - 1 ? segs[idx + 1][0] : 1;
        ctx.beginPath();
        ctx.strokeStyle = s[1];
        ctx.lineWidth = 4;
        ctx.arc(cx, cy, r, Math.PI * (1 + s[0]), Math.PI * (1 + end));
        ctx.stroke();
      });
      segs.forEach(function (s) {
        [0, 0.5].forEach(function (off) {
          var frac = s[0] + off;
          if (frac > 1) return;
          var ang = Math.PI * (1 + frac);
          ctx.beginPath();
          ctx.strokeStyle = s[1];
          ctx.lineWidth = 1;
          ctx.moveTo(cx + Math.cos(ang) * (r + 2), cy + Math.sin(ang) * (r + 2));
          ctx.lineTo(cx + Math.cos(ang) * (r + 7), cy + Math.sin(ang) * (r + 7));
          ctx.stroke();
        });
      });
      var vAng = Math.PI * (1 + value / 100);
      ctx.beginPath();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(vAng) * (r - 10), cy + Math.sin(vAng) * (r - 10));
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = ink;
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.font = '600 12px -apple-system, "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      // 文字基线 cy+22：模拟 offsetCenter [0,'50%']（站方 35%），盘面与文字留出空隙
      ctx.fillText(label + ' ' + value + '\u2103', cx, cy + 22);
      ctx.restore();
    });
    // 门户搜索框：curl 快照是服务端 HTML，站方 JS 运行时才构建表单（与真实站点结构一致）；
    // 预览里补烘焙一份，样式与列表页搜索胶囊同源
    var portalSearchBox = document.querySelector('.header_navbar_content .search_box');
    if (portalSearchBox && !portalSearchBox.querySelector('form')) {
      portalSearchBox.innerHTML =
        '<form action="/search/all/" id="global_search_form" method="post" class="search">' +
        '<div class="input-group input-group-sm">' +
        '<input id="search_type" name="t" type="hidden" value="">' +
        '<input id="search_input" name="q" type="text" class="form-control" placeholder="搜索问题、话题或人" autocomplete="off">' +
        '<span class="input-group-btn"><button class="btn btn-default" type="button">' +
        '<span class="jisilu-icons">&#xe718;</span></button></span>' +
        '</div></form>';
    }
    // 「发起」入口移到 header 搜索框右侧（与 portal.ts movePublishToHeader 同步），
    // 登录态弹窗菜单里的按钮项移除；匿名态弹窗不存在时也补按钮（三页 header 一致）
    var pMenu = document.querySelector('.header_navbar_content .popover-menu');
    var searchBox = document.querySelector('.header_navbar_content .search_box, .header_navbar_content .search');
    var publishLink = pMenu ? pMenu.querySelector('a.btn[href="/publish/"]') : null;
    if (searchBox && !(searchBox.parentElement && searchBox.parentElement.querySelector('.jsl-header-publish'))) {
      var pub = document.createElement('a');
      pub.className = 'jsl-header-publish';
      pub.href = '/publish/';
      pub.textContent = '发起';
      searchBox.insertAdjacentElement('afterend', pub);
    }
    if (publishLink) {
      var pubLi = publishLink.closest('li');
      if (pubLi) pubLi.remove();
    }
    // 弹窗顶部用户信息行/会员推广行移除（与 portal.ts stripPopoverHeader 同步）——
    // 对齐列表/详情页用户下拉的纯链接列表
    if (pMenu) {
      var uiRow = pMenu.querySelector('.user_info');
      if (uiRow) uiRow.remove();
      var memberBox = pMenu.querySelector('.member_box');
      if (memberBox) memberBox.remove();
    }

    // 弹窗菜单排序（与 portal.ts reorderMenuItems 同步）：单列合并 + 统一顺序
    if (pMenu) {
      var menuUl = pMenu.querySelector('.menu_links ul');
      var order = ['个人主页', '个人设置', '我的关注', '我的收藏', '我的购买', '我的金币', '黑名单', '退出'];
      if (menuUl) {
        var byText = {};
        pMenu.querySelectorAll('.menu_links li, .bottom_links li').forEach(function (li) {
          var t = (li.textContent || '').trim();
          if (t && !byText[t]) byText[t] = li;
        });
        order.forEach(function (t) {
          if (byText[t]) menuUl.appendChild(byText[t]);
        });
        var bottomLinks = pMenu.querySelector('.bottom_links');
        if (bottomLinks) bottomLinks.remove();
      }
    }
  })();

  // reorderUserNavMenu：用户下拉文案与排序对齐门户用户弹窗（index.ts 同步）
  var userMenuUl = document.querySelector('.aw-user-nav-dropdown .dropdown-menu ul');
  if (userMenuUl) {
    var uOrder = [['主页', '个人主页'], ['设置', '个人设置'], ['我的关注', '我的关注'], ['我的收藏', '我的收藏'], ['我的购买', '我的购买'], ['我的金币', '我的金币'], ['黑名单', '黑名单'], ['退出', '退出']];
    var uItems = {};
    userMenuUl.querySelectorAll('li').forEach(function (li) {
      var t = (li.textContent || '').trim();
      if (t && !uItems[t]) uItems[t] = li;
    });
    uOrder.forEach(function (pair) {
      var li = uItems[pair[0]];
      if (!li) return;
      if (pair[1] !== pair[0]) {
        var a = li.querySelector('a');
        var tn = a && Array.prototype.slice.call(a.childNodes).find(function (n) { return n.nodeType === 3 && (n.textContent || '').trim(); });
        if (tn) tn.textContent = pair[1];
      }
      userMenuUl.appendChild(li);
    });
  }

  // detail.ts：楼层号 + 回到顶部 + 长回复折叠（与真实扩展一致：仅详情页，滚动 600px 后出现）
  document.querySelectorAll('.aw-dynamic-topic > .aw-item').forEach(function (el, i) {
    var s = document.createElement('span');
    s.className = 'jsl-floor';
    s.textContent = '#' + (i + 2);
    el.appendChild(s);
  });
  if (document.querySelector('.aw-dynamic-topic')) {
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
  }

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

  // 设置页：会员信息 / 基本信息拆成两张独立卡 + 单行信息归整（与 settings.ts 同步）
  (function () {
    // 保存按钮无包裹 div / 在 form 内时，补一层包裹 div 到 tab-content 末尾
    //（与 settings.ts wrapSaveButton 同步）
    var save = document.querySelector('.aw-user-setting .tab-content .aw-user-setting-save');
    if (save) {
      var sp = save.parentElement;
      var inForm = sp && sp.tagName === 'FORM';
      var direct = sp && sp.classList && sp.classList.contains('tab-content');
      if (inForm || direct) {
        var wrap = document.createElement('div');
        if (inForm) {
          var tc0 = sp.closest('.tab-content');
          if (tc0) tc0.appendChild(wrap);
        } else {
          save.replaceWith(wrap);
        }
        wrap.appendChild(save);
      }
    }
    var mod = document.querySelector('.aw-user-setting .tab-content > .aw-mod');
    if (mod && mod.dataset.jslSplit !== '1') {
      var children = Array.prototype.slice.call(mod.children);
      var secondHead = -1;
      children.forEach(function (el, index) {
        if (index > 0 && secondHead < 0 && el.classList.contains('aw-mod-head')) secondHead = index;
      });
      if (secondHead > 0) {
        var first = document.createElement('div');
        first.className = 'aw-mod';
        var second = document.createElement('div');
        second.className = 'aw-mod';
        children.forEach(function (child, index) {
          (index < secondHead ? first : second).appendChild(child);
        });
        first.dataset.jslSplit = '1';
        second.dataset.jslSplit = '1';
        mod.replaceWith(first, second);
      }
    }
    document.querySelectorAll('.aw-user-setting .aw-user-setting-layout').forEach(function (layout) {
      Array.prototype.slice.call(layout.querySelectorAll(':scope > dl')).forEach(function (dl) {
        Array.prototype.slice.call(dl.querySelectorAll(':scope > dd')).forEach(function (dd) {
          if (!(dd.textContent || '').trim() && !dd.querySelector('input, img, select, textarea, button')) dd.remove();
        });
        var dd = dl.querySelector(':scope > dd');
        if (!dd) return;
        var dtText = ((dl.querySelector(':scope > dt') || {}).textContent || '').trim();
        var inlineRow = dtText.indexOf('绑定手机') === 0 || dd.classList.contains('aw-user-setting-base-introduce');
        if (!inlineRow) return;
        dl.classList.add('jsl-inline-row');
        dd.querySelectorAll('span, a').forEach(function (el) {
          el.style.removeProperty('padding-left');
          el.style.removeProperty('margin-left');
        });
        dd.querySelectorAll('span').forEach(function (span) {
          Array.prototype.slice.call(span.childNodes).forEach(function (node) {
            if (node.nodeType === 3 && !(node.textContent || '').replace(/[\s\u00a0]/g, '')) node.remove();
          });
        });
      });
    });
  })();

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

# 烘焙的日历事件 JSON：转义 </script> 防止提前闭合脚本标签
sim = sim.replace("__CALENDAR_EVENTS__", calendar_events_json.replace("</", "<\\/"))

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
