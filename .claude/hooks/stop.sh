#!/usr/bin/env bash
# Stop hook
# 每次 Claude 完成响应后，检查 docs/plans/ 是否有新增文档
# 如果本轮做了实质性代码改动但没有对应文档，输出提醒

input=$(cat)
cwd=$(echo "$input" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('cwd', ''))
except:
    print('')
")

if [ -z "$cwd" ]; then
  exit 0
fi

plans_dir="$cwd/docs/plans"

# 检查最近 5 分钟内是否有新的 PLAN 文档
if [ -d "$plans_dir" ]; then
  recent_plans=$(find "$plans_dir" -name "PLAN-*.md" -newer "$plans_dir" -mmin -5 2>/dev/null | wc -l | tr -d ' ')
  if [ "$recent_plans" -gt 0 ]; then
    # 有新文档，输出提示
    plan_files=$(find "$plans_dir" -name "PLAN-*.md" -newer "$plans_dir" -mmin -5 2>/dev/null | xargs -I{} basename {})
    echo "📄 已创建计划文档：$plan_files" >&2
  fi
fi

exit 0
