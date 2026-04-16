# 鉴权 / Authentication

Conductor HTTP API 默认无鉴权（适合本地开发）。启用后，所有 `/api/*` 请求需要携带访问令牌。

---

## 启用鉴权 / Enable auth

```bash
conductor auth token
```

生成一个随机 64 位十六进制令牌，保存到 `~/.conductor/auth.json`（权限 600）。

输出示例：
```
Access token generated and saved to ~/.conductor/auth.json

Token: a3f8c2d1e4b7...

Usage:
  Header:  Authorization: Bearer a3f8c2d1e4b7...
  Cookie:  conductor_token=a3f8c2d1e4b7...
  Query:   ?token=a3f8c2d1e4b7...
```

---

## 传递令牌 / Pass the token

支持三种方式：

| 方式 | 格式 | 适用场景 |
|------|------|----------|
| HTTP Header | `Authorization: Bearer <token>` | 普通 API 调用 |
| Cookie | `conductor_token=<token>` | 浏览器会话 |
| Query param | `?token=<token>` | SSE（EventSource 不支持自定义 header）|

---

## Web UI 登录 / Web UI login

启用鉴权后，访问 Web UI 时会显示登录页面。输入令牌后，令牌存储在 `sessionStorage`（关闭标签页后清除）。

---

## 查看状态 / Check status

```bash
conductor auth status
```

---

## 禁用鉴权 / Disable auth

```bash
conductor auth disable
```

删除 `~/.conductor/auth.json`，恢复开放访问。

---

## HTTP 端点

```
GET /auth/status   # 返回 { "enabled": true|false }，无需鉴权
```

---

## 安全说明

- 令牌使用 `timingSafeEqual` 进行比较，防止时序攻击
- `auth.json` 文件权限为 600（仅所有者可读写）
- 令牌存储在 `sessionStorage`，不持久化到 `localStorage`
- 本地工具场景下，建议仅在需要远程访问时启用鉴权
