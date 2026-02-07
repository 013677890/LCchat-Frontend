# LCchat 前端开发文档（Vue + Electron）

## 1. 文档信息

- 文档版本: `v1.1`
- 更新时间: `2026-02-06`
- 适用项目: `web/`（Electron + Vue 客户端）
- 对齐后端基线:
  - `apps/gateway/internal/router/router.go`
  - `apps/gateway/internal/dto/*.go`
  - `apps/user/pb/*.proto`
  - `pkg/result/response.go`

---

## 2. 摘要与目标

### 2.1 摘要

本文档用于指导 LCchat 前端开发，核心结论如下：

1. `app/bootstrap.ts`、`app/router.ts`、`app/guards.ts` 保持 `.ts` 是正确分层，不改 `.vue`。
2. UI 采用“微信原生风”：轻量、克制、高信息密度、弱动效。
3. 本地数据层采用 `SQLite + Main + IPC`，定位为缓存层，服务端仍为业务真源。

### 2.2 阶段目标

在现有后端（gateway + user）基础上优先落地：

1. 账号流程：注册、登录、验证码、刷新 token、登出、重置密码。
2. 用户能力：个人信息、头像、二维码、搜索。
3. 社交能力：好友申请、好友列表、备注/标签、黑名单。
4. 设备能力：设备列表、踢设备、在线状态。
5. IM 壳层：三栏 UI + 本地会话/消息草稿缓存。

### 2.3 当前不在本阶段范围

1. 真实消息服务（`apps/msg`）
2. 实时 WebSocket（`apps/connect`）
3. 群组完整能力（网关尚未开放）

---

## 3. 后端能力基线（以代码为准）

### 3.1 服务与端口

1. Gateway HTTP: `:8080`
2. User gRPC: `:9090`
3. User metrics: `:9091`

默认 API 基础地址：`http://localhost:8080`

### 3.2 已开放 HTTP 路由（网关）

#### 公开接口（无需 JWT）

1. `POST /api/v1/public/user/register`
2. `POST /api/v1/public/user/login`
3. `POST /api/v1/public/user/login-by-code`
4. `POST /api/v1/public/user/send-verify-code`
5. `POST /api/v1/public/user/verify-code`
6. `POST /api/v1/public/user/refresh-token`
7. `POST /api/v1/public/user/reset-password`
8. `POST /api/v1/public/user/parse-qrcode`

#### 认证接口（需要 JWT）

1. `GET /api/v1/auth/user/profile`
2. `PUT /api/v1/auth/user/profile`
3. `GET /api/v1/auth/user/profile/:userUuid`
4. `GET /api/v1/auth/user/search`
5. `POST /api/v1/auth/user/avatar`
6. `GET /api/v1/auth/user/qrcode`
7. `POST /api/v1/auth/user/batch-profile`
8. `GET /api/v1/auth/user/devices`
9. `DELETE /api/v1/auth/user/devices/:deviceId`
10. `GET /api/v1/auth/user/online-status/:userUuid`
11. `POST /api/v1/auth/user/batch-online-status`
12. `POST /api/v1/auth/user/change-password`
13. `POST /api/v1/auth/user/change-email`
14. `POST /api/v1/auth/user/delete-account`
15. `POST /api/v1/auth/user/logout`
16. `POST /api/v1/auth/friend/apply`
17. `GET /api/v1/auth/friend/apply-list`
18. `GET /api/v1/auth/friend/apply/sent`
19. `POST /api/v1/auth/friend/apply/handle`
20. `GET /api/v1/auth/friend/apply/unread`
21. `POST /api/v1/auth/friend/apply/read`
22. `GET /api/v1/auth/friend/list`
23. `POST /api/v1/auth/friend/sync`
24. `POST /api/v1/auth/friend/delete`
25. `POST /api/v1/auth/friend/remark`
26. `POST /api/v1/auth/friend/tag`
27. `GET /api/v1/auth/friend/tags`
28. `POST /api/v1/auth/friend/check`
29. `POST /api/v1/auth/friend/relation`
30. `POST /api/v1/auth/blacklist`
31. `GET /api/v1/auth/blacklist`
32. `DELETE /api/v1/auth/blacklist/:userUuid`
33. `POST /api/v1/auth/blacklist/check`

### 3.3 已知差异（前端必须按代码对齐）

1. 响应无 `module` 字段。
2. 响应中是 `trace_id`，不是 `requestId`。
3. `timestamp` 为秒级（`Unix()`），不是毫秒。
4. `SearchUser` 默认 `pageSize` 当前实现为 `100`。
5. `MarkApplyAsRead` 当前要求 `applyIds` 非空。
6. `UpdateProfile.gender` 校验为 `1/2/3`。
7. `change-telephone` 未在网关开放。
8. JWT 失败可能直接返回 HTTP `401`。

---

## 4. 前端开发规范（来自 `web/.agents/skills`）

### 4.1 Vue 规范

1. 默认 `Composition API`。
2. 默认 `<script setup lang="ts">`。
3. SFC 顺序：`script -> template -> style`。
4. 组件职责单一，复杂逻辑拆 composable。
5. 数据流保持 `Props Down / Events Up`。

### 4.2 状态与响应式规范

1. 单一事实源，派生状态用 `computed`。
2. 禁止在 `computed` 中做副作用。
3. 异步 `watch` 必须支持清理，避免竞态。
4. 全局状态统一使用 `Pinia`。
5. Store 解构使用 `storeToRefs`。

### 4.3 路由与测试规范

1. 路由守卫使用 `async/await`，不使用 `next()` 老写法。
2. 参数变化触发刷新不依赖组件重建。
3. 单测：`Vitest + Vue Test Utils`。
4. E2E：`Playwright`。

---

## 5. Electron 架构设计

### 5.1 进程职责

1. Main:
   - 窗口生命周期
   - SQLite 与本地会话存储
   - IPC 白名单入口
2. Preload:
   - 通过 `contextBridge` 暴露受控 API
   - 屏蔽 Node 能力
3. Renderer:
   - Vue UI
   - 路由、Store、API 请求
   - 仅调用 `window.api` 和 HTTP

### 5.2 安全策略

1. Token 不写 `localStorage`，仅经 preload/main 管理。
2. Renderer 不直连文件系统与 SQLite。
3. IPC 禁止透传原始 SQL；仅暴露业务化方法。
4. 任何 IPC 异常都必须可降级，不允许导致窗口崩溃。

---

## 6. 前端工程目录规划

```text
web/src/renderer/src/
  app/
    bootstrap.ts
    router.ts
    guards.ts
  shared/
    http/
      client.ts
      interceptor.ts
    types/
      api.ts
      user.ts
      friend.ts
      localdb.ts
    utils/
      time.ts
      error.ts
      device.ts
    constants/
      code.ts
      design-token.ts
  stores/
    auth.store.ts
    user.store.ts
    friend.store.ts
    blacklist.store.ts
    device.store.ts
    session.store.ts
    app.store.ts
  modules/
    auth/
      views/
      components/
      api.ts
    contact/
      views/
      components/
      api.ts
    profile/
      views/
      components/
      api.ts
    security/
      views/
      components/
      api.ts
    chat/
      views/
      components/
      api.ts
      adapters/
        mock.adapter.ts
        backend.adapter.ts

web/src/main/
  db/
    sqlite.ts
    schema.ts
    migration.ts
  ipc/
    channels.ts
    handlers.session.ts
    handlers.device.ts
    handlers.localdb.ts
```

### 6.1 文件类型与分层原则（新增）

#### 6.1.1 契约

1. `*.vue`: 页面、布局、可视组件。
2. `*.ts`: 路由、守卫、启动、store、api、utils、types、数据库访问层、IPC 协议层。

#### 6.1.2 为什么 `router/guards/bootstrap` 必须是 `.ts`

1. 这三类文件是应用启动与流程编排，不承载模板。
2. 其主要内容是类型、函数、配置对象、守卫逻辑，属于纯逻辑层。
3. 放在 `.vue` 会造成“视图层与应用骨架耦合”，不利于测试和复用。

#### 6.1.3 示例

1. `app/router.ts`: 定义 `RouteRecordRaw[]` 与路由实例。
2. `app/guards.ts`: 定义登录守卫、权限守卫、重定向策略。
3. `app/bootstrap.ts`: 统一注册 pinia/router/global error handler。

---

## 7. 界面设计风格规范（微信原生风）

### 7.1 视觉基调

1. 轻量: 背景浅色，减少高饱和色块。
2. 克制: 低对比装饰，突出信息内容而非特效。
3. 高信息密度: 列表优先可读性与扫描效率。
4. 弱动效: 动画只服务状态反馈与层次过渡。

### 7.2 Design Token（可执行）

#### 7.2.1 颜色

| Token | 值 | 用途 |
|---|---|---|
| `--c-primary` | `#07C160` | 主品牌、主要 CTA |
| `--c-primary-hover` | `#06AD56` | 主按钮 hover |
| `--c-bg-app` | `#F5F6F7` | 应用背景 |
| `--c-bg-panel` | `#FFFFFF` | 面板背景 |
| `--c-bg-sidebar` | `#EDEFF2` | 左侧栏背景 |
| `--c-border` | `#E5E7EB` | 分割线/边框 |
| `--c-text-main` | `#1F2329` | 主文本 |
| `--c-text-sub` | `#4E5969` | 次级文本 |
| `--c-text-muted` | `#86909C` | 弱文本 |
| `--c-danger` | `#F53F3F` | 错误/危险 |
| `--c-warning` | `#FF7D00` | 警告 |
| `--c-success` | `#00B42A` | 成功 |

#### 7.2.2 间距、圆角、阴影

| Token | 值 |
|---|---|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--radius-sm` | `6px` |
| `--radius-md` | `10px` |
| `--radius-lg` | `14px` |
| `--shadow-1` | `0 1px 2px rgba(0,0,0,0.06)` |
| `--shadow-2` | `0 4px 12px rgba(0,0,0,0.08)` |

### 7.3 排版规范

1. 字体优先级:
   - `PingFang SC`
   - `Noto Sans SC`
   - `Microsoft YaHei`
   - `sans-serif`
2. 字号体系:
   - `12px` 辅助信息
   - `14px` 正文默认
   - `16px` 重点正文/标题
   - `20px` 页面标题
3. 行高:
   - `1.4`（紧凑内容）
   - `1.6`（正文默认）

### 7.4 布局规范

1. 主窗口最小尺寸: `1200 x 760`。
2. 三栏宽度建议:
   - 左栏导航: `72px`
   - 中栏列表: `320px`
   - 右栏详情: 自适应
3. 小窗口策略:
   - `< 1200` 隐藏右栏次要信息
   - `< 1024` 中栏可折叠

### 7.5 组件规范

1. 会话项:
   - 高度 `72px`
   - 标题 + 最后消息 + 时间 + 未读角标
2. 聊天气泡:
   - 自己消息背景 `--c-primary`
   - 对方消息背景 `#FFFFFF`
3. 输入区:
   - 固定底部
   - 支持草稿态回填
4. 联系人项:
   - 头像 + 名称 + 备注 + 在线点
5. 侧栏导航:
   - 图标按钮 + tooltip
   - 当前态高亮背景 + 左侧细条

### 7.6 动效规范

1. 页面切换: `150ms ~ 220ms`, `ease-out`。
2. 列表出现: `stagger 30ms`，总时长不超 `240ms`。
3. hover/active 仅做透明度和背景色变化，不做大幅位移。
4. 禁止全局持续动效，减少视觉噪音。

---

## 8. SQLite 本地缓存架构（Main + IPC）

### 8.1 定位与边界

1. SQLite 是本地缓存层，不替代后端真源。
2. 业务写入成功后回写本地缓存。
3. 离线时可读缓存回显，联网后以服务端结果校正。

### 8.2 接入方式

1. 数据库驱动: `better-sqlite3`（Main 进程）。
2. Renderer 不直接访问 SQLite；仅通过 `window.api.localdb.*`。
3. IPC 只开放业务化方法，不开放 SQL 字符串执行。

### 8.3 数据库路径

1. 路径: `app.getPath('userData')/lcchat.db`
2. 原则:
   - 每个系统用户独立目录
   - 卸载后是否保留由系统策略决定

### 8.4 PRAGMA 基线

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

### 8.5 同步策略

1. 登录初始化:
   - 先读本地 profile/friend/applies/blacklist 快速渲染
   - 后台请求服务端并回写本地
2. 好友增量同步:
   - 调 `friend/sync`
   - 应用 `changes`
   - 更新 `sync_state(domain='friend', last_version)`
3. 会话与草稿:
   - 会话和草稿优先写本地
   - 消息真值待 msg/connect 接入后再收敛

### 8.6 故障降级策略

1. SQLite 初始化失败:
   - 记录日志
   - 回退内存态缓存
   - 应用不中断
2. 单次读写失败:
   - 返回可识别错误码给 renderer
   - UI 提示“本地缓存不可用，已降级在线模式”

---

## 9. 关键接口与类型契约（新增）

### 9.1 Preload/Main 暴露接口契约

```ts
window.api.session.get(): Promise<SessionData | null>
window.api.session.set(payload: SessionData): Promise<void>
window.api.session.clear(): Promise<void>

window.api.device.getId(): Promise<string>

window.api.localdb.init(): Promise<void>

window.api.localdb.profile.get(userUuid: string): Promise<ProfileRow | null>
window.api.localdb.profile.upsert(profile: ProfileRow): Promise<void>

window.api.localdb.friends.getList(userUuid: string): Promise<FriendRow[]>
window.api.localdb.friends.replaceAll(userUuid: string, items: FriendRow[], version: number): Promise<void>
window.api.localdb.friends.applyChanges(userUuid: string, changes: FriendChangeRow[], latestVersion: number): Promise<void>

window.api.localdb.applies.getInbox(userUuid: string): Promise<FriendApplyRow[]>
window.api.localdb.applies.upsertInbox(userUuid: string, items: FriendApplyRow[]): Promise<void>

window.api.localdb.blacklist.getList(userUuid: string): Promise<BlacklistRow[]>
window.api.localdb.blacklist.replaceAll(userUuid: string, items: BlacklistRow[]): Promise<void>

window.api.localdb.chat.getConversations(userUuid: string): Promise<ConversationRow[]>
window.api.localdb.chat.upsertConversations(userUuid: string, items: ConversationRow[]): Promise<void>
window.api.localdb.chat.getMessages(userUuid: string, convId: string, cursor?: number, limit?: number): Promise<MessageRow[]>
window.api.localdb.chat.upsertMessages(userUuid: string, convId: string, items: MessageRow[]): Promise<void>
window.api.localdb.chat.saveDraft(userUuid: string, convId: string, draft: string): Promise<void>
window.api.localdb.chat.getDraft(userUuid: string, convId: string): Promise<string>
```

### 9.2 SQLite 表结构契约（第一版）

```sql
CREATE TABLE IF NOT EXISTS meta_kv (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS profiles (
  user_uuid TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS friends (
  user_uuid TEXT NOT NULL,
  peer_uuid TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_uuid, peer_uuid)
);

CREATE TABLE IF NOT EXISTS friend_applies (
  user_uuid TEXT NOT NULL,
  apply_id INTEGER NOT NULL,
  direction TEXT NOT NULL,
  status INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_uuid, apply_id, direction)
);

CREATE TABLE IF NOT EXISTS blacklist (
  user_uuid TEXT NOT NULL,
  peer_uuid TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_uuid, peer_uuid)
);

CREATE TABLE IF NOT EXISTS conversations (
  user_uuid TEXT NOT NULL,
  conv_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_uuid, conv_id)
);

CREATE TABLE IF NOT EXISTS messages (
  user_uuid TEXT NOT NULL,
  conv_id TEXT NOT NULL,
  msg_id TEXT NOT NULL,
  client_msg_id TEXT,
  seq INTEGER,
  send_time INTEGER,
  payload_json TEXT NOT NULL,
  status INTEGER NOT NULL,
  PRIMARY KEY (user_uuid, conv_id, msg_id)
);

CREATE TABLE IF NOT EXISTS message_drafts (
  user_uuid TEXT NOT NULL,
  conv_id TEXT NOT NULL,
  draft_text TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_uuid, conv_id)
);

CREATE TABLE IF NOT EXISTS sync_state (
  user_uuid TEXT NOT NULL,
  domain TEXT NOT NULL,
  last_version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_uuid, domain)
);
```

### 9.3 一致性与数据真值原则

1. 服务端返回成功后再写本地缓存。
2. 本地缓存仅用于读优化与离线回显。
3. 不允许基于本地缓存直接做权限/关系最终判定。
4. Token 不入 SQLite，仅走 session 存储。

---

## 10. 状态管理设计（Pinia + SQLite 协作）

### 10.1 Store 规划

1. `auth.store`: 登录态、刷新 token、会话恢复。
2. `user.store`: profile、qrcode、search。
3. `friend.store`: list/version、apply、tags、sync。
4. `blacklist.store`: 黑名单分页。
5. `device.store`: 设备和在线状态。
6. `session.store`: 会话、消息、草稿（本地缓存优先）。
7. `app.store`: 全局 UI 状态与主题变量。

### 10.2 读写路径

1. 页面进入先读本地缓存（秒开）。
2. 后台拉取服务端后覆盖 store，并回写 SQLite。
3. 失败时保留本地显示并提示“离线数据”。

---

## 11. API 对接规范

### 11.1 请求约定

1. `baseURL`: `VITE_API_BASE_URL`（默认 `http://localhost:8080`）
2. 公共头:
   - `Content-Type: application/json`
   - `X-Device-ID: <deviceId>`（登录与验证码登录必须）
3. 认证头:
   - `Authorization: Bearer <accessToken>`

### 11.2 响应模型（按网关）

```ts
interface ApiResponse<T> {
  code: number
  message: string
  data: T
  trace_id: string
  timestamp: number // 秒
}
```

### 11.3 错误处理与刷新策略

1. `200 + code!=0`: 业务错误处理。
2. `401` 或 `code in [20002, 20003]`: 触发刷新 token。
3. 刷新入参:
   - `uuid`
   - `device_id`
   - `refreshToken`
4. 刷新成功: 重放一次原请求。
5. 刷新失败: 清 session，回登录页。

---

## 12. 工程实现前置说明（新增）

### 12.1 依赖计划

1. `better-sqlite3`
2. `@types/better-sqlite3`
3. `pinia`
4. `vue-router`
5. `axios`

### 12.2 打包说明（原生模块）

1. `better-sqlite3` 属于原生模块，需要在打包策略中确保可加载。
2. `electron-builder` 需要为原生模块配置 `asarUnpack`（例如 `node_modules/better-sqlite3/**`）。
3. 构建机需具备与目标平台匹配的原生编译环境。

### 12.3 IPC 安全说明

1. 不开放 `execute(sql: string)` 一类通用接口。
2. 所有 IPC 通道必须是强约束参数签名。
3. preload 只暴露白名单方法，不转发动态 channel。

### 12.4 缓存一致性原则

1. 缓存不能替代服务端业务判断。
2. 写失败可重试，不阻塞关键在线流程。
3. 用户切换/登出必须进行账号隔离清理。

---

## 13. 测试用例与验收场景

### 13.1 文档验收

1. 第 6 章明确 `.ts` 与 `.vue` 分工，且无冲突描述。
2. 设计风格章节包含可执行 token、组件、布局、动效规范。
3. SQLite 章节覆盖路径、表结构、同步、降级。

### 13.2 技术验收（实现阶段）

1. `localdb.init()` 可重复执行，幂等。
2. 登录后 profile/friend/apply/blacklist 写入并可读回。
3. `friend/sync` 后本地 `sync_state.last_version` 正确更新。
4. 断网可显示本地缓存通讯录与最近会话。
5. 登出后 session 清空，不串账号缓存。
6. Renderer 无法执行任意 SQL，非白名单 IPC 被拒绝。

---

## 14. 迭代实施步骤（按阶段）

### 阶段 A：修正文档分层说明

1. 新增“文件类型与分层原则”。
2. 明确 `.ts` / `.vue` 边界。
3. 解释 `router/guards/bootstrap` 不用 `.vue` 的原因。

### 阶段 B：新增界面设计风格章节

1. 视觉基调。
2. Design Token。
3. 排版规范。
4. 布局规范。
5. 组件规范。
6. 动效规范。

### 阶段 C：新增 SQLite 架构章节

1. 缓存层定位。
2. `Main + IPC + better-sqlite3` 方式。
3. 数据库路径与 PRAGMA。
4. 同步策略。
5. 降级策略。

### 阶段 D：补充工程前置说明

1. 依赖计划。
2. 打包说明。
3. IPC 安全。
4. 一致性原则。

---

## 15. 默认假设与决策

1. 设计风格固定为“微信原生风”。
2. SQLite 角色为“本地缓存库”。
3. SQLite 接入方式为“Main + IPC + better-sqlite3”。
4. SQLite 第一版范围为“核心缓存集”。
5. 默认不引入 SQLCipher。
6. token 不入 SQLite，仅走 session 存储。
7. `router.ts/guards.ts/bootstrap.ts` 保持 `.ts`。

---

## 16. 待确认事项

1. `change-telephone` 何时在网关开放。
2. `MarkApplyAsRead` 是否支持空数组=全部已读。
3. 消息服务（msg/connect）接口发布时间。
4. 是否引入 `keytar` 作为系统级凭据存储。

---

## 17. 后端联调清单（第 1 轮）

- 联调日期: `2026-02-07`
- 联调目标: 覆盖高风险失败路径，确保桌面端在异常场景下可恢复、可提示、不中断主流程。

### 17.1 鉴权失败（401 / token 失效）

1. 触发接口:
   - `POST /api/v1/public/user/login`
   - `GET /api/v1/auth/user/profile`
   - `GET /api/v1/auth/friend/list`
2. 核验点:
   - 前端展示明确错误文案，不写入错误会话。
   - 已登录态遇到 `401` 时触发刷新流程，刷新失败则清 session 并回登录页。
   - `trace_id` 能透传到错误日志中，便于后端排查。
3. 单测覆盖:
   - `src/renderer/src/stores/auth.store.spec.ts`（登录鉴权失败）

### 17.2 接口超时（网络抖动 / 网关慢响应）

1. 触发接口:
   - `POST /api/v1/public/user/login`
   - `POST /api/v1/auth/friend/sync`
2. 核验点:
   - 请求超时后页面可继续交互，不出现白屏或死锁。
   - store 状态保持可回退（不污染当前本地缓存状态）。
   - 用户可重试，并看到确定性的错误反馈。
3. 单测覆盖:
   - `src/renderer/src/stores/auth.store.spec.ts`（登录超时）

### 17.3 空列表（新账号/空数据）

1. 触发接口:
   - `GET /api/v1/auth/friend/list` 返回 `items=[]`
   - `POST /api/v1/auth/friend/sync` 返回 `changes=[]`
2. 核验点:
   - 本地缓存替换逻辑正确执行，不残留脏数据。
   - 页面稳定展示“空态”，不会误显示历史数据。
   - `version` 与服务端返回对齐。
3. 单测覆盖:
   - `src/renderer/src/stores/friend.store.spec.ts`（空列表同步）

### 17.4 分页边界（过大页数 / hasMore 持续为 true）

1. 触发接口:
   - `GET /api/v1/auth/friend/list` 返回超大 `totalPages`
   - `POST /api/v1/auth/friend/sync` 连续返回 `hasMore=true`
2. 核验点:
   - 全量拉取严格受 `page <= 50` 限制。
   - 增量同步严格受 `rounds < 20` 限制。
   - 到达边界后自动停止，避免无限请求。
3. 单测覆盖:
   - `src/renderer/src/stores/friend.store.spec.ts`（分页边界停止策略）

### 17.5 已落地自动化测试映射（2026-02-07）

1. 鉴权失败 / 登录超时:
   - `src/renderer/src/stores/auth.store.spec.ts`
2. 好友空列表 / 分页边界:
   - `src/renderer/src/stores/friend.store.spec.ts`
3. 申请未读数超时回退 / 申请分页边界:
   - `src/renderer/src/stores/apply.store.spec.ts`
4. 黑名单超时回退 / 黑名单分页边界:
   - `src/renderer/src/stores/blacklist.store.spec.ts`

---

## 18. 真实网关联调脚本（可复跑）

### 18.1 目标场景

1. 鉴权失败（401）
2. 接口超时（客户端严格超时配置）
3. 分页上限（`page=50&pageSize=100`）

### 18.2 脚本与测试数据位置

1. 运行脚本: `scripts/gateway-smoke/run.mjs`
2. 固化用例: `scripts/gateway-smoke/fixtures/cases.json`
3. 固化账号模板: `scripts/gateway-smoke/fixtures/accounts.example.json`
4. 运行报告: `scripts/gateway-smoke/fixtures/last-run-report.json`

### 18.3 运行方式

1. 可选: 在 `scripts/gateway-smoke/fixtures/` 下准备 `accounts.local.json`（覆盖模板账号）。
2. 可选环境变量:
   - `LCCHAT_GATEWAY_BASE_URL`（默认 `http://127.0.0.1:8080`）
   - `LCCHAT_TEST_ACCESS_TOKEN`（优先级高于账号登录）
   - `LCCHAT_GATEWAY_DEFAULT_TIMEOUT_MS`（默认 `5000`）
3. 执行命令:
   - `npm run test:gateway:smoke`

### 18.4 判定规则

1. `httpStatusIn`：HTTP 状态码白名单校验。
2. `businessCodeIn`：网关业务码白名单校验。
3. `timeout=true`：要求请求抛出超时错误（`ECONNABORTED` 或 timeout 关键字）。
4. 所有失败用例会写入 `last-run-report.json`，用于重复排查与回归对比。
