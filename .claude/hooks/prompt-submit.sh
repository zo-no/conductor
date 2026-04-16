#!/usr/bin/env bash
# UserPromptSubmit hook
# 检测是否是新需求，如果是，注入"先写 PLAN 文档"的上下文指令

input=$(cat)
prompt=$(echo "$input" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('prompt', ''))
except:
    print('')
")

# 判断是否像一个新需求（包含动作性关键词，且长度够）
is_new_requirement=false
char_count=${#prompt}

if [ "$char_count" -gt 10 ]; then
  if echo "$prompt" | grep -qiE \
    '新增|添加|实现|开发|设计|重构|改造|优化|修改|删除|去掉|移除|支持|接入|集成|迁移|升级|拆分|合并|调整|增加|做一个|写一个|帮我|需要|应该|想要|要做|功能|特性|页面|接口|API|组件|模块'; then
    is_new_requirement=true
  fi
fi

if [ "$is_new_requirement" = true ]; then
  cat <<'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "【文档先行规则】收到新需求后，在动手之前必须先完成以下步骤：\n\n1. 在 docs/plans/ 目录下创建 PLAN-<功能名>.md\n2. 文档包含：需求描述、方案设计、涉及文件、边界情况、验收标准\n3. 输出文档内容让用户确认\n4. 用户确认后再开始实现\n\n如果需求很小（< 5行改动），可以用一句话说明方案后直接执行，无需完整文档。"
  }
}
EOF
else
  # 非新需求（回复、确认、问题），直接放行
  echo '{}'
fi
