# Mimi - 桌面宠物

由 [Hermes Agent](https://github.com/NousResearch/Hermes-Agent) 驱动的桌面宠物，基于 Electron + React + TypeScript 构建。

## v0.3.0 - Phase 3

扩展版本，新增事件监听、MCP 工具协议、多平台打包和自动化测试。

### 新增功能

- **Hermes 事件监听** - 实时订阅 Hermes Dashboard 事件流（SSE），定时任务结果自动通知宠物
- **MCP 工具协议** - 基于 Model Context Protocol 的 HTTP+SSE JSON-RPC 服务（端口 3100），AI 可远程控制宠物表情、通知、消息、主题
- **MCP 工具列表**
  - `set_expression` - 设置宠物表情
  - `show_notification` - 显示桌面通知
  - `display_message` - 在聊天气泡中显示消息
  - `change_theme` - 切换宠物皮肤主题
- **通知系统** - 宠物头顶弹出通知气泡，自动淡出，支持 Hermes 事件和 MCP 触发
- **多平台打包** - Windows（NSIS 安装包）、macOS（DMG）、Linux（AppImage + deb）一键构建
- **E2E 自动化测试** - 基于 Playwright 的 Electron 端到端测试，覆盖 8 个核心场景

### 构建与测试

```bash
# 构建
npm run build

# 开发
npm run dev

# E2E 测试
npm run test:e2e

# 打包（Windows）
npm run package:win

# 打包（macOS）
npm run package:mac

# 打包（Linux）
npm run package:linux
```

---

## v0.2.0 - Phase 2

增强版本，新增 6 大功能。

### 新增功能

- **表情联动** - 对话内容自动影响宠物表情（关键词检测：开心/难过/思考等）
- **宠物皮肤** - 4 种主题皮肤（蓝色、粉色、绿色、紫色），设置面板一键切换
- **记忆面板** - 浏览 Hermes 会话历史，查看对话详情
- **技能管理** - 列出 Hermes 技能，支持启用/禁用切换
- **定时任务** - 创建/暂停/恢复/删除/立即执行 Cron 定时任务
- **语音输入** - 基于 Web Speech API 的语音识别输入（中文）

### 界面改进

- 聊天区域新增标签导航：聊天 | 技能 | 记忆 | 定时
- 设置面板新增 Dashboard 地址配置和皮肤选择器
- CSS 变量主题系统，全局统一配色

---

## v0.1.0 - Phase 1

初始版本。

### 功能

- **宠物角色** - 扁平矢量风格蓝色圆形宠物，6 种表情（待机、开心、说话、难过、思考、睡觉），纯 CSS 动画
- **Hermes 对话** - 通过 Hermes Agent 的 OpenAI 兼容 SSE API（`localhost:8642/v1`）实现实时流式对话
- **弹出聊天气泡** - 点击宠物打开/关闭聊天，支持流式响应与光标动画
- **设置面板** - 配置 API 地址、API Key、窗口置顶、开机自启，支持连接测试
- **系统托盘** - 托盘图标右键菜单（显示、设置、退出）
- **离线检测** - 每 10 秒自动检测 Hermes 连接状态，离线时切换难过表情并禁用输入
- **透明无边框窗口** - 顶部区域拖拽移动，默认始终置顶

### 环境要求

- Node.js >= 18
- [Hermes Agent](https://github.com/NousResearch/Hermes-Agent) 运行于 `localhost:8642`（聊天功能需要）
- Hermes Dashboard 运行于 `localhost:9119`（技能/记忆/定时任务需要）

### 开发

```bash
npm install
npm run dev
```

### 构建

```bash
npm run build
```

### 项目结构

```
desktop-pet/
├── src/
│   ├── main/
│   │   ├── index.ts          # Electron 主进程
│   │   ├── hermes.ts         # Hermes API 客户端（SSE 流式 + Dashboard API）
│   │   ├── hermes-events.ts  # Hermes 事件流监听（SSE）
│   │   └── mcp-server.ts     # MCP 工具协议服务（HTTP+SSE JSON-RPC）
│   ├── preload/
│   │   ├── index.ts          # 预加载脚本（contextBridge）
│   │   └── index.d.ts        # TypeScript 类型声明
│   └── renderer/
│       └── src/
│           ├── App.tsx        # 根组件
│           ├── App.css        # 主题变量 + 动画 + 布局样式
│           ├── main.tsx       # React 入口
│           ├── context/
│           │   └── AppContext.tsx  # 全局状态（Context + useReducer）
│           └── components/
│               ├── PetCharacter.tsx
│               ├── ChatBubble.tsx
│               ├── ChatInput.tsx    # 含语音输入
│               ├── SettingsPanel.tsx
│               ├── SkillsPanel.tsx
│               ├── MemoryPanel.tsx
│               └── CronPanel.tsx
├── tests/
│   └── e2e/
│       └── app.spec.ts       # Playwright E2E 测试
├── assets/
│   └── tray-icon.png
├── VERSION
└── electron.vite.config.ts
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron 33 + electron-vite 2 |
| 前端 | React 18 + TypeScript 5 |
| 状态管理 | React Context + useReducer |
| 持久化 | electron-store |
| 流式通信 | SSE + MessagePort IPC |
| 主题 | CSS 自定义属性 |
| 语音 | Web Speech API |
| 工具协议 | MCP（HTTP+SSE JSON-RPC） |
| 测试 | Playwright |
| 打包 | electron-builder |
