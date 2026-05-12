# Mimi - 桌面宠物

由 [Hermes Agent](https://github.com/NousResearch/Hermes-Agent) 驱动的桌面宠物，基于 Electron + React + TypeScript 构建。

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
│   │   └── hermes.ts         # Hermes API 客户端（SSE 流式 + Dashboard API）
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
