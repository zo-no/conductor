# PLAN: AI 任务完成语音通知

**状态**: DONE  
**日期**: 2026-04-16

---

## 需求描述

AI 任务执行完毕（`done` 或 `failed`）时，播报一条语音通知。  
语音能力内置到 Conductor core，不依赖外部服务，不新增端口。  
AI agent 可以通过 CLI 自主配置和操作语音相关功能。

---

## 方案设计

### 架构：TTS 作为 core 内部模块

```
packages/core/src/services/tts.ts     ← TTS 引擎（xfyun + say 降级）
packages/core/src/models/settings.ts  ← 全局设置存储（已有，扩展）
packages/core/src/services/scheduler.ts ← 任务完成时调用 tts.speak()
```

不新建 package，不新增端口，TTS 是 scheduler 的一个副作用调用。

### TTS 提供商

| 提供商 | 条件 | 说明 |
|--------|------|------|
| `xfyun` | 配置了 appId/apiKey/apiSecret | 讯飞 WebSocket TTS，高质量中文 |
| `say` | macOS，无需配置 | 系统自带，降级方案 |
| `none` | 未配置且非 macOS | 静默，不报错 |

选择逻辑：有 xfyun 凭证优先用 xfyun，否则 macOS 用 say，其他平台静默。

### 任务字段扩展

在 `ExecutorOptions` 中增加 `voiceNotice` 字段：

```typescript
// packages/types/src/index.ts
export interface VoiceNoticeOptions {
  enabled: boolean
  speechText?: string  // 留空则用默认文案："{taskTitle} 已完成" / "{taskTitle} 执行失败"
}

export interface ExecutorOptions {
  continueSession?: boolean
  reviewOnComplete?: boolean
  voiceNotice?: VoiceNoticeOptions   // ← 新增
}
```

### 触发逻辑

在 `scheduler.ts` 任务执行完成后（已有的 `updateTask` 之后）插入：

```typescript
// AI 任务执行完毕，且任务配置了 voiceNotice
if (fresh.executorOptions?.voiceNotice?.enabled) {
  const text = fresh.executorOptions.voiceNotice.speechText
    ?? (result.success ? `${fresh.title} 已完成` : `${fresh.title} 执行失败`)
  speak(text).catch(() => {})  // fire-and-forget，不阻塞主流程
}
```

### 全局 TTS 配置存储

存到 `~/.conductor/` 目录下的 `tts-config.json`（与 db.sqlite 同级），不进数据库（凭证不适合存 SQLite）：

```json
{
  "provider": "xfyun",
  "xfyun": {
    "appId": "xxx",
    "apiKey": "xxx",
    "apiSecret": "xxx",
    "voice": "xiaoyan",
    "speed": 50,
    "volume": 50
  }
}
```

---

## CLI 命令设计

AI 可以自主调用这些命令：

```bash
# 查看当前 TTS 配置
conductor tts status

# 配置讯飞
conductor tts config --provider xfyun \
  --app-id <appId> \
  --api-key <apiKey> \
  --api-secret <apiSecret>

# 测试播报
conductor tts test "数据分析完成，结果已写入报告"

# 清除配置（回退到 say）
conductor tts config --provider say

# 创建任务时开启语音通知
conductor task create "分析日志" --voice-notice \
  --speech-text "日志分析完成，发现 3 个异常"

# 更新已有任务的语音通知
conductor task update <id> --voice-notice \
  --speech-text "周报生成完毕，请查收"

# 关闭任务语音通知
conductor task update <id> --no-voice-notice
```

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `packages/types/src/index.ts` | 新增 `VoiceNoticeOptions`，扩展 `ExecutorOptions` |
| `packages/core/src/services/tts.ts` | **新建** — TTS 引擎，xfyun WebSocket + say 降级 |
| `packages/core/src/services/scheduler.ts` | 任务完成后调用 `speak()` |
| `packages/core/src/controllers/cli/tasks.ts` | `task create/update` 支持 `--voice-notice` / `--speech-text` |
| `packages/core/src/controllers/cli/tts.ts` | **新建** — `conductor tts` 子命令 |
| `packages/core/src/index.ts` 或入口 | 注册 `tts` CLI 命令 |
| `docs/voice-notice.md` | **新建** — 使用说明，讯飞配置步骤 |

---

## 验收标准

1. `conductor tts config --provider xfyun ...` 写入配置文件，`conductor tts status` 可读回
2. `conductor tts test "hello"` 能播出声音（xfyun 或 say）
3. 创建一个带 `--voice-notice` 的 AI 任务，执行完毕后自动播报
4. `--speech-text` 为空时使用默认文案（任务标题 + 状态）
5. 未配置 TTS 且非 macOS 时静默，不报错不崩溃
6. TTS 播报失败不影响任务状态和主流程

---

## 不在本次范围

- Web UI 中的语音设置界面（CLI 优先，AI 可操作即可）
- 人工任务完成时播报
- 多语言 TTS 切换（默认中文，say 跟系统语言走）
