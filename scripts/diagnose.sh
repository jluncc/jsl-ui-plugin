#!/usr/bin/env bash
# 诊断预览页头部几何：输出关键元素的位置/尺寸/背景，用于定位重叠与残留
set -euo pipefail
PAGE="${1:?usage: diagnose.sh <preview.html>}"

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --dump-dom --virtual-time-budget=8000 --window-size=1440,900 \
  "file://$PAGE" 2>/dev/null | python3 -c "
import re, sys, html
dom = sys.stdin.read()
m = re.search(r'<pre id=\"jsl-diag\">(.*?)</pre>', dom, re.S)
print(html.unescape(m.group(1)) if m else 'NO DIAG OUTPUT')
"
