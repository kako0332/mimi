# Mimi — Live2D 桌面宠物

一个基于 Electron + Live2D 的桌面宠物应用，集成 Hermes Agent 实现 AI 流式对话，支持多模型切换、表情系统、鼠标追踪、MCP 协议控制。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Electron 33 + electron-vite 2 |
| 前端 | React 18 + TypeScript 5.7 |
| Live2D | Cubism SDK 5.0 (Core + Framework TS) |
| 渲染 | WebGL2 (直接绑定，无第三方渲染库) |
| 通信 | WebSocket (JSON-RPC 2.0) + SSE + Electron IPC |
| 存储 | electron-store |
| 协议 | MCP (Model Context Protocol) — port 3100 |
| 打包 | electron-builder (NSIS / DMG / AppImage) |
| 测试 | Playwright E2E |

## 功能

### Live2D 渲染
- 完整 Cubism SDK 5 渲染管线：Moc、纹理、物理、姿态、表情、动作
- 眨眼 / 呼吸 / 物理 (头发摆动) 自动播放
- 鼠标追踪 (眼球 + 头部 + 身体朝向)
- HitArea 点击检测
- 随机待机动作
- 预乘 Alpha 透明渲染，无边框透明窗口

### 多模型支持
- 内置 4 个模型：Hiyori、Mark、Natori、Rice
- 右键宠物弹出模型选择菜单
- 设置面板中也可切换模型
- 模型选择持久化到 electron-store

### AI 对话
- 通过 WebSocket 与 Hermes Agent 实时流式对话
- 工具调用 (tool call) 实时显示：运行中 / 完成 / 失败
- AI 回复自动匹配表情 (开心、难过、思考等)
- 繁忙自动重试 (最多 5 次，指数退避)
- 语音输入 (Web Speech API)

### MCP 协议控制
外部 AI Agent 可通过 MCP 协议 (port 3100) 控制宠物：

| 工具 | 功能 |
|------|------|
| `set_expression` | 设置表情 (idle/happy/talking/sad/thinking/sleeping) |
| `show_notification` | 显示通知气泡 |
| `display_message` | 主动发送消息 |
| `change_theme` | 切换主题色 |

### 功能面板
- **聊天** — 与 AI 实时对话
- **技能** — 查看 / 开关 Hermes 技能
- **记忆** — 浏览历史会话和消息
- **定时** — 创建 / 管理 Cron 定时任务

### 其他
- 4 套主题色 (蓝 / 粉 / 绿 / 紫) + Glassmorphism 毛玻璃 UI
- 系统托盘图标，最小化到托盘
- 窗口置顶 / 开机自启
- SSE 实时事件监听
- 离线检测 + CSS 宠物降级
- 拖动宠物移动窗口 (Pointer Capture)

## 项目结构

```
desktop-pet/
├── assets/                          # 应用图标 (tray-icon.png, app.ico)
├── src/
│   ├── main/                        # Electron 主进程
│   │   ├── index.ts                 # 窗口创建、IPC 注册、生命周期
│   │   ├── hermes.ts                # Hermes Agent 客户端 (WS + REST)
│   │   ├── hermes-events.ts         # SSE 事件监听
│   │   └── mcp-server.ts            # MCP 协议服务器 (port 3100)
│   ├── preload/
│   │   ├── index.ts                 # contextBridge API 暴露
│   │   └── index.d.ts              # API 类型声明
│   └── renderer/
│       ├── index.html               # 入口 HTML
│       ├── public/
│       │   └── live2d/              # Live2D 资源
│       │       ├── live2dcubismcore.min.js   # Cubism Core WASM
│       │       ├── Shaders/                  # WebGL 着色器
│       │       ├── Hiyori/                   # Hiyori 模型
│       │       ├── Mark/                     # Mark 模型
│       │       ├── Natori/                   # Natori 模型
│       │       └── Rice/                     # Rice 模型
│       └── src/
│           ├── main.tsx             # React 入口
│           ├── App.tsx              # 根组件 (布局 + 状态)
│           ├── App.css              # 全局样式 + 主题
│           ├── config/
│           │   └── models.ts        # 模型注册表
│           ├── context/
│           │   └── AppContext.tsx    # 全局状态 (useReducer)
│           ├── components/
│           │   ├── PetCharacter.tsx       # 双模式渲染器 (Live2D / CSS)
│           │   ├── Live2DCharacter.tsx    # Live2D 画布 + 拖拽 + 视线追踪
│           │   ├── ModelPicker.tsx        # 右键模型选择菜单
│           │   ├── ChatBubble.tsx         # 消息列表 + 工具调用卡片
│           │   ├── ChatInput.tsx          # 输入栏 + 语音
│           │   ├── SettingsPanel.tsx      # 设置面板 (模型/主题/开关)
│           │   ├── SkillsPanel.tsx        # 技能管理
│           │   ├── MemoryPanel.tsx        # 会话历史
│           │   └── CronPanel.tsx          # 定时任务
│           ├── live2d/
│           │   ├── api/
│           │   │   ├── Live2DAdapter.ts   # WebGL 适配器 (加载/渲染/交互)
│           │   │   └── expressionMap.ts   # 表情映射
│           │   ├── core/                  # Cubism Core JS 声明
│           │   ├── framework/             # Cubism Framework TS 源码
│           │   └── index.ts
│           └── types/
│               └── window-api.d.ts       # window.api 类型
├── electron.vite.config.ts          # electron-vite 构建配置
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
└── VERSION
```

## 架构

```
┌─────────────────────────────────────────┐
│              Electron Main              │
│  ┌──────────┐ ┌───────────┐ ┌────────┐ │
│  │  Hermes   │ │    MCP    │ │  SSE   │ │
│  │  Client   │ │  Server   │ │ Events │ │
│  │ (WS+REST) │ │  :3100    │ │        │ │
│  └─────┬─────┘ └─────┬─────┘ └───┬────┘ │
│        │  IPC         │  IPC       │ IPC  │
│  ┌─────┴──────────────┴───────────┴────┐ │
│  │           BrowserWindow              │ │
│  │  ┌───────────────────────────────┐   │ │
│  │  │     React 18 Renderer         │   │ │
│  │  │  AppContext → PetCharacter    │   │ │
│  │  │     → Live2DAdapter (WebGL2)  │   │ │
│  │  │  + ChatBubble / Skills / ...  │   │ │
│  │  └───────────────────────────────┘   │ │
│  └──────────────────────────────────────┘ │
└─────────────────────────────────────────┘
         │                    │
    Hermes Dashboard     External Agent
    (localhost:9119)     (MCP :3100)
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 打包安装程序
npm run package:win
```

## 版本历史

### v0.4.0
- 多模型支持 (Hiyori / Mark / Natori / Rice)
- 右键模型切换菜单
- 设置面板模型选择器
- 模型选择持久化
- 拖拽移动窗口 (Pointer Capture)
- 无边框透明窗口优化
- 预乘 Alpha 纹理修复
- 项目结构整理

### v0.3.0
- Live2D Cubism SDK 5 集成
- MCP 协议服务器
- SSE 事件监听
- 多平台打包
- E2E 测试

### v0.2.0
- Glassmorphism UI 重设计
- 技能 / 会话 / 定时任务面板
- 主题切换

### v0.1.0
- Electron + React 基础框架
- Hermes Agent WebSocket 对话
- CSS 宠物角色
- 系统托盘

## License

MIT
