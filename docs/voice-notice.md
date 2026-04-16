# 语音通知（Voice Notice）

Conductor 在以下两种情况会自动播报语音通知：

1. **AI 任务完成/失败**：任务配置了 `--voice-notice` 时，执行完毕（`done` 或 `failed`）后播报
2. **创建 human review 任务**：AI 任务配置了 `--review-on-complete` 时，执行完成后会创建 human todo，并播报 `"<任务名> 已完成，请查看待办任务"` 提醒用户

---

## TTS 提供商

| 提供商 | 条件 | 说明 |
|--------|------|------|
| `xfyun` | 配置了讯飞凭证 | 高质量中文 TTS，WebSocket 合成 |
| `say` | macOS，无需配置 | 系统自带，降级方案 |
| `none` | 未配置且非 macOS | 静默，不报错 |

选择逻辑：有讯飞凭证优先用讯飞，否则 macOS 用 `say`，其他平台静默。

---

## 配置讯飞 TTS

### 1. 获取凭证

前往 [讯飞开放平台](https://www.xfyun.cn/) 注册账号，创建应用，获取：
- App ID
- API Key
- API Secret

选择「语音合成」→「在线语音合成（流式版）」服务。

### 2. 写入配置

```bash
conductor tts config \
  --provider xfyun \
  --app-id <your-app-id> \
  --api-key <your-api-key> \
  --api-secret <your-api-secret>
```

可选参数：
```bash
  --voice x4_xiaoyan   # 声音，默认 x4_xiaoyan
  --speed 50           # 语速 0-100，默认 50
  --volume 50          # 音量 0-100，默认 50
```

配置保存在 `~/.conductor/tts-config.json`，不进数据库。

### 3. 验证

```bash
conductor tts status          # 查看当前配置
conductor tts test "测试播报"  # 播放测试语音
```

---

## 在任务中启用语音通知

### 创建任务时开启

```bash
# 使用默认文案（"任务标题 已完成" / "任务标题 执行失败"）
conductor task create \
  --title "分析日志" \
  --project <proj-id> \
  --assignee ai \
  --kind once \
  --executor-kind ai_prompt \
  --prompt "分析今日错误日志" \
  --voice-notice \
  --json

# 自定义播报文本
conductor task create \
  --title "生成周报" \
  --project <proj-id> \
  --assignee ai \
  --kind recurring \
  --cron "0 18 * * 5" \
  --executor-kind ai_prompt \
  --prompt "生成本周工作周报" \
  --voice-notice \
  --speech-text "本周周报已生成，请查收" \
  --json
```

### 更新已有任务

```bash
# 开启语音通知
conductor task update <task-id> --voice-notice --json

# 开启并设置自定义文案
conductor task update <task-id> \
  --voice-notice \
  --speech-text "数据备份完成，共备份 3 个数据库" \
  --json

# 关闭语音通知
conductor task update <task-id> --no-voice-notice --json
```

---

## AI Agent 操作指南

AI agent 可以在创建或更新任务时主动设置语音通知，让用户在任务完成时收到有意义的语音提示。

**最佳实践**：`speechText` 应该包含具体信息，而不是泛泛的"任务完成"。

```bash
# 好的示例
--speech-text "代码审查完成，发现 2 个需要修复的问题"
--speech-text "数据分析完成，报告已写入 ~/reports/2026-04.md"
--speech-text "部署完成，新版本已上线"

# 不好的示例
--speech-text "任务完成"   # 信息量太少
```

**检查 TTS 是否可用**：

```bash
conductor tts status --json
# 返回：{"provider":"xfyun","configured":true,"details":"..."}
# 如果 configured 为 false，语音通知会静默（不报错）
```

---

## 故障排查

**语音没有播出**
1. `conductor tts status` 确认配置
2. `conductor tts test "hello"` 测试
3. 确认任务的 `executorOptions.voiceNotice.enabled` 为 `true`（`conductor task get <id> --json`）

**讯飞报错**
- 检查凭证是否正确
- 确认账号已开通「在线语音合成（流式版）」服务
- 检查网络是否能访问 `tts-api.xfyun.cn`

**macOS say 没声音**
- 检查系统音量
- 终端运行 `say hello` 验证系统 TTS 是否正常
