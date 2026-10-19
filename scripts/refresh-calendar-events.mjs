// 刷新投资日历预览的事件数据快照。
// 站方事件由 /data/calendar/get_calendar_data/?qtype=<类型> 异步拉取，
// 本地静态预览服务没有该后端，因此把真实响应缓存到 /tmp/jsl-preview/calendar-events.json，
// 由 preview.sh 烘焙进预览页（仅本地预览，扩展本身不注入任何事件）。
// 用法: node scripts/refresh-calendar-events.mjs
import { writeFile } from 'node:fs/promises';

const TYPES = [
  'newstock_onlist',
  'newstock_apply',
  'CNV',
  'CBDIV',
  'cnreits',
  'FUND',
  'BOND',
  'STOCK',
  'OTHER',
  'newbond_apply',
  'newbond_onlist',
  'diva',
  'divhk',
  'idxfut',
  'idxopt',
];

const OUT = '/tmp/jsl-preview/calendar-events.json';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Referer: 'https://www.jisilu.cn/data/calendar/',
};

// 与 FullCalendar 月视图请求一致：6 行 × 7 天（周末列隐藏但仍占数据范围），
// start = 当月 1 日所在周的周一，end = start + 42 天。站方接口在缺少
// start/end 时只返回最近几天，会明显少于线上实际渲染量。
const now = new Date();
const monthFirst = new Date(now.getFullYear(), now.getMonth(), 1);
const mondayOffset = (monthFirst.getDay() + 6) % 7;
const rangeStart = new Date(now.getFullYear(), now.getMonth(), 1 - mondayOffset);
const rangeEnd = new Date(rangeStart.getTime() + 42 * 24 * 60 * 60 * 1000);
const START = Math.floor(rangeStart.getTime() / 1000);
const END = Math.floor(rangeEnd.getTime() / 1000);

async function fetchType(type) {
  const url =
    `https://www.jisilu.cn/data/calendar/get_calendar_data/?qtype=${type}` +
    `&start=${START}&end=${END}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`${type} 第 ${attempt} 次失败: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  return null;
}

const result = {};
for (const type of TYPES) {
  const data = await fetchType(type);
  result[type] = data;
  console.log(`${type}: ${data === null ? '失败' : data.length}`);
}

await writeFile(OUT, JSON.stringify(result, null, 1));
console.log(`已写入 ${OUT}`);
