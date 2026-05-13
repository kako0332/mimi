# Mimi Desktop Pet — 技术调研与改进方案

> **本文档用途**：供 AI 阅读和学习，基于调研结果为 Mimi 桌面宠物项目制定 Live2D 集成和 UI 美化方案。
> **编写日期**：2026-05-13
> **项目仓库**：desktop-pet（Electron + React + TypeScript + electron-vite）

---

## 第一部分：项目现状

### 1.1 技术栈

- Electron v33 + React 18 + TypeScript
- 构建工具：electron-vite
- 状态管理：React useReducer + Context
- AI 后端：Hermes Agent + MCP Server (:3100) + WebSocket 流式通信
- 打包：electron-builder（支持 Windows/macOS/Linux）

### 1.2 当前 UI（需改进）

**宠物渲染**：纯 CSS 圆形（80px），6 种表情（idle/happy/talking/sad/thinking/sleeping），通过关键词正则匹配驱动（`AppContext.tsx` 中的 `detectExpression`）。

**聊天面板**：280px 白色实心卡片，基础 tab 栏（聊天/技能/记忆/定时），简单消息气泡。运行在透明无边框窗口中。

**问题**：
- UI 粗糙，白色实心卡片在透明窗口上显得突兀
- 关键词匹配表情无法反映真实情绪
- CSS 宠物表现力有限
- package.json 中已有 `pixi.js@7.4.3` + `pixi-live2d-display@0.4.0` 但**完全未使用且版本不兼容**（该库要求 pixi.js v6）

### 1.3 关键文件

```
src/renderer/src/
├── App.tsx                    # 主组件：宠物 + 聊天 + 设置面板
├── App.css                    # 全部样式（~825 行）
├── context/AppContext.tsx     # 全局状态管理 + 表情检测 + WebSocket
├── components/
│   ├── PetCharacter.tsx       # CSS 宠物（仅 24 行）
│   ├── ChatBubble.tsx         # 消息列表
│   ├── ChatInput.tsx          # 输入框
│   ├── SettingsPanel.tsx      # 设置面板
│   ├── SkillsPanel.tsx        # 技能管理
│   ├── MemoryPanel.tsx        # 记忆面板
│   └── CronPanel.tsx          # 定时任务
```

---

## 第二部分：Live2D 技术调研

### 2.1 渲染库对比（核心决策点）

| 库名称 | Stars | Cubism | PixiJS | 维护状态 | 推荐度 |
|--------|-------|--------|--------|----------|--------|
| **CubismWebFramework**（官方） | 官方 | **5.3** | 无依赖 | 活跃 | **首选** |
| **untitled-pixi-live2d-engine** | 新 | **5** | v8 | 活跃 | 备选 |
| pixi-live2-display | 1.4k | 仅 4 | 仅 v6 | **已停更 2 年** | 不推荐 |
| OhMyLive2D | 550 | 2-5 | v6 | 低活跃 | 不推荐 |
| live2d-py | 1k | 2-5 | N/A | 活跃 | 不兼容 |

**推荐：CubismWebFramework 官方 SDK**。理由：

1. Open-LLM-VTuber 已用相同技术栈（Electron + React + electron-vite）验证了可行性
2. 官方持续维护，支持 Cubism 5.3，无升级障碍
3. TypeScript 原生，与项目完美契合
4. pixi-live2d-display 已停更 2 年、不支持 Cubism 5、与当前 pixi.js v7 不兼容

**官方 SDK 核心架构**：
```
CubismWebFramework/
├── effect/       # 视线跟踪(CubismLook)、眨眼(CubismEyeBlink)、呼吸(CubismBreath)
├── model/        # CubismModel、CubismModelSettingJson、CubismUserModel
├── motion/       # CubismMotion、CubismMotionQueueManager、CubismExpressionMotion
├── physics/      # CubismPhysics（头发、衣服摆动）
├── rendering/    # CubismRenderer_WebGL（需要 WebGL2）
└── id/           # 参数 ID 管理
```

**Cubism 5 vs 4 关键差异**：

| 特性 | Cubism 4 | Cubism 5 |
|------|----------|----------|
| WebGL | 1+2 | **仅 WebGL2**（Electron 完全支持） |
| 混合模式 | 不支持 | 支持 |
| 离屏渲染 | 不支持 | 支持 |
| 表情管理 | 单个 | CubismExpressionMotionManager |
| 动作回调 | 仅完成 | 新增开始回调 |

**Cubism Core 获取**：闭源运行时，需从 https://www.live2d.com/download/cubism-sdk/download-web/ 下载 `live2dcubismcore.min.js`，必须在 Framework 之前加载。

### 2.2 核心参考项目

#### Open-LLM-VTuber（7.6k stars，最重要的参考）

**技术栈**：Electron 31 + React 18 + TypeScript + electron-vite（与本项目完全一致）

**关键架构决策**：

1. **直接内嵌 Cubism SDK 源码**到项目中（`src/renderer/WebSDK/`），而非使用 npm 包，允许深度定制口型同步等

2. **宠物模式窗口管理**：
   - 窗口扩展到所有显示器的联合矩形区域
   - `setIgnoreMouseEvents(true, { forward: true })` 实现鼠标穿透 + 事件转发
   - Live2D `hitTest` 检测鼠标是否在模型上，动态切换穿透
   - 两阶段模式切换（先透明度 0，等渲染就绪后再切换，防闪烁）

3. **`[emotion]` 情绪标签系统**：
   - LLM 在回复中嵌入标签，如 `[joy]我很高兴见到你！`
   - `emotionMap` 映射为表情索引：`{"neutral": 0, "anger": 2, "joy": 3, "sadness": 1}`
   - 正则匹配后剥离标签，不影响 TTS 和显示

4. **口型同步**（基于 RMS 的 WAV 分析）：
   - `LAppWavFileHandler` 解析 PCM 数据
   - 每帧计算 RMS 值，驱动 `ParamMouthOpenY`
   - 灵敏度增强：`_lastRms × lipSyncScale(2.0)`
   - 音频任务队列按句串行播放

#### moeru-ai/airi（39.2k stars）

- 同时支持 Live2D + VRM 双模型体系
- WebGPU 加速渲染
- 插件化 LLM Provider（OpenAI、Claude、本地模型）
- 集成 GPT-SoVITS、Edge-TTS、VOICEVOX 等多种 TTS
- MIT 许可

#### PPet（~2k stars，MIT）

- Electron + React + Vite，架构高度相似
- 支持 Live2D v2/v3 模型渲染
- MIT 许可，可直接参考集成方案

#### chiikawa-pets

- Electron + Vite + PixiJS + Live2D，TypeScript
- 自研 C++ Win32 全局 Hook
- MIT 许可

#### 其他重要项目

| 项目 | Stars | 核心价值 |
|------|-------|---------|
| handcrafted-persona-engine | 1.2k | espeak-ng 音素级口型同步（精度最高） |
| clawd-on-desk | 2.4k | AI Agent 监控桌宠（2026 爆款） |
| openpets | 372 | MCP 协议集成 |
| Ark-Pets | 932 | Spine 2D 骨骼动画方案 |
| live2d-widget | 10.5k | Web Live2D 看板娘 |
| Inochi2D | 3k | Live2D 开源替代方案 |
| live2d-motion3 | 27 | 程序化生成 Live2D 动作数据 |

### 2.3 免费模型资源

| 模型 | 适用场景 | 说明 |
|------|---------|------|
| **Niziiro Mao** | **首选**，VTuber/桌宠 | 正面朝向，Blend Shapes，丰富动作表情 |
| Hiyori Momose | 经典测试 | Cubism 3.0 标准，完整动作集 |
| Tororo & Hijiki | 宠物类 | 猫模型 |
| Koharu & Haruto | Q 版风格 | SD 角色 |

许可：个人/年营收 < 1000 万日元免费。

---

## 第三部分：UI/UX 设计调研

### 3.1 当前 UI 问题分析

当前 UI 是白色实心卡片在透明窗口上，显得突兀且不美观。具体问题：
- 白色 `.chat-container` 与透明窗口不协调
- 消息气泡使用实色背景（`#f0f2f5`、`var(--accent)`）
- 没有展开/收起动画
- 没有打字指示器
- 80px 纯 CSS 圆形宠物表现力不足

### 3.2 推荐设计风格：毛玻璃（Glassmorphism）

桌面宠物运行在透明窗口中，毛玻璃效果与透明窗口完美契合：

```css
.chat-container {
  background: rgba(25, 25, 35, 0.65);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
```

**消息气泡也使用半透明**：
```css
.msg.user {
  background: rgba(96, 165, 250, 0.2);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(96, 165, 250, 0.15);
  color: #e2e8f0;
}
.msg.assistant {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  color: #e2e8f0;
}
```

### 3.3 动画系统

**聊天面板弹出（弹簧回弹）**：
```css
@keyframes chat-pop-open {
  0% { opacity: 0; transform: translateY(-10px) scale(0.9); filter: blur(4px); }
  80% { transform: translateY(4px) scale(1.02); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
```

**打字指示器（三点弹跳）**：
```css
.typing-indicator span {
  width: 6px; height: 6px; border-radius: 50%;
  animation: typing-bounce 1.4s infinite ease-in-out;
}
.typing-indicator span:nth-child(1) { animation-delay: 0s; }
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
```

**消息入场（从底部滑入）**：
```css
@keyframes message-enter {
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

**宠物点击反馈（挤压弹回）**：
```css
@keyframes pet-squish {
  0% { transform: scale(1, 1); }
  30% { transform: scale(1.15, 0.85); }
  50% { transform: scale(0.9, 1.1); }
  100% { transform: scale(1, 1); }
}
```

### 3.4 宠物情绪色光晕系统

将宠物当前情绪映射为颜色，通过 CSS 变量驱动整个 UI：

```css
:root {
  --emotion-hue: 220;  /* 默认蓝色 */
}
.pet-character {
  box-shadow: 0 0 20px hsla(var(--emotion-hue), 60%, 60%, 0.3);
  transition: box-shadow 1s ease;
}
```

JS 驱动：`document.documentElement.style.setProperty('--emotion-hue', '45')` // happy

### 3.5 透明窗口上的文字可读性

```css
.on-glass-text {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  -webkit-font-smoothing: antialiased;
}
```

对于需要极高可读性的场景（通知、歌词），使用 8 层 text-shadow：
```css
.readable-on-any-bg {
  color: #fff;
  text-shadow:
    0 0 2px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.6),
    0 0 8px rgba(0,0,0,0.4),
    1px 1px 2px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9),
    1px -1px 2px rgba(0,0,0,0.9), -1px 1px 2px rgba(0,0,0,0.9),
    0 0 16px rgba(0,0,0,0.3);
}
```

### 3.6 口型同步方案对比

| 方案 | 原理 | 精度 | 复杂度 | 推荐场景 |
|------|------|------|--------|---------|
| RMS 音量分析 | PCM → RMS → ParamMouthOpenY | 中 | 低 | **首选**（Open-LLM-VTuber 已验证） |
| 音素分析 (espeak-ng) | 文本 → 音素 → 口型 | 高 | 中 | 生产级最佳效果 |
| Web Audio API 频率 | 音频能量 → 嘴巴开合 | 低 | 极低 | 快速原型 |

---

## 第四部分：实施计划

### Phase 1：UI 美化（1-2 天）

**目标**：在不动 Live2D 的情况下，先让现有 UI 变好看。

1. 将 `.chat-container` 改为毛玻璃效果（`backdrop-filter: blur(24px)` + 半透明背景）
2. 消息气泡改为半透明风格
3. 添加聊天面板弹出/收起弹簧动画
4. 添加宠物点击挤压反馈 + 情绪色光晕
5. 添加打字指示器（三点弹跳）
6. 添加消息入场滑入动画
7. Tab 切换添加滑动过渡动画
8. **验证标准**：UI 在各种桌面壁纸上清晰可读，交互有动画反馈

### Phase 2：Live2D 基础替换（2-3 天）

1. 下载 Cubism SDK for Web，内嵌 Framework 到 `src/renderer/src/live2d/`
2. 实现 `LAppDelegate`、`LAppModel`、`LAppLive2DManager`（参考 Open-LLM-VTuber）
3. 新建 `Live2DPetCharacter.tsx`，替换 CSS 版
4. 加载 Niziiro Mao 测试模型
5. 打通 expression 状态 → Live2D 表情映射
6. **验证标准**：Live2D 角色替代 CSS 宠物，点击可打开聊天

### Phase 3：交互增强（2-3 天）

1. 鼠标视线跟踪（`CubismLook`）
2. 命中检测驱动的鼠标穿透（参考 Open-LLM-VTuber 的 `hitTest + setIgnoreMouseEvents`）
3. 空闲动作循环（Idle motion）
4. 点击交互（头部 → 表情，身体 → 动作）
5. **验证标准**：模型跟随鼠标，点击有反应，模型外区域穿透

### Phase 4：情绪系统升级（1-2 天）

1. 修改 Hermes system prompt，加入 `[emotion]` 标签要求
2. 前端实现标签解析器 + `expressionMap`
3. 替换 `detectExpression`，保留关键词作为 fallback
4. **验证标准**：AI 回复正确触发表情，标签不出现在文本中

### Phase 5：口型同步（1-2 天）

1. 实现 `LAppWavFileHandler`（RMS 音频分析，参考 Open-LLM-VTuber）
2. 无 TTS 时用 Talk 组动作降级
3. 接入 TTS 后切换到 RMS 口型同步
4. **验证标准**：说话时嘴巴与音频同步

### Phase 6：打磨扩展（按需）

- 多模型切换、物理模拟调优、窗口拖拽、模型热加载

---

## 第五部分：架构设计

### 整体架构

```
┌──────────────────────────────────────────────────┐
│              Electron Main Process                │
│  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
│  │  Hermes  │  │MCP Server │  │ WindowManager │  │
│  │  Agent   │  │  :3100    │  │ (transparent) │  │
│  └────┬─────┘  └─────┬─────┘  └───────┬───────┘  │
│       └──────────IPC───────────────────┘          │
└───────────────────────┬───────────────────────────┘
                        │
┌───────────────────────┴───────────────────────────┐
│              Renderer Process (React)              │
│  ┌─────────────────────────────────────────────┐  │
│  │  AppContext                                  │  │
│  │  expression → Live2D 表情 / 情绪色光晕      │  │
│  │  isStreaming → Talk 动作 + 口型同步          │  │
│  │  messages → [emotion] 标签解析               │  │
│  └────────────────┬────────────────────────────┘  │
│  ┌────────────────┴────────────────────────────┐  │
│  │  Live2DPetCharacter (WebGL2)                 │  │
│  │  CubismUserModel                             │  │
│  │  ├─ 表情 (ExpressionManager)                 │  │
│  │  ├─ 动作 (MotionQueueManager)                │  │
│  │  ├─ 物理 (CubismPhysics)                     │  │
│  │  ├─ 眨眼/呼吸/视线 (effect/)                 │  │
│  │  └─ 口型 (RMS → ParamMouthOpenY)             │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Chat Panel (Glassmorphism)                   │  │
│  │  backdrop-filter: blur(24px)                  │  │
│  │  ├─ 半透明消息气泡                            │  │
│  │  ├─ 弹簧弹出动画                              │  │
│  │  ├─ 打字指示器                                │  │
│  │  └─ 滑动 Tab 切换                             │  │
│  └──────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

### 目录结构规划

```
src/renderer/src/
├── live2d/
│   ├── core/                        # Cubism Core (live2dcubismcore.min.js)
│   ├── framework/                   # CubismWebFramework 源码
│   ├── app/
│   │   ├── LAppDelegate.ts          # 应用入口
│   │   ├── LAppModel.ts             # 模型封装
│   │   ├── LAppLive2DManager.ts     # 模型生命周期
│   │   └── LAppWavFileHandler.ts    # 音频分析
│   └── api/
│       ├── Live2DAdapter.ts         # 统一 API
│       ├── expressionMap.ts         # 情绪 → 表情映射
│       └── lipSyncController.ts     # 口型同步
├── components/
│   ├── PetCharacter.tsx             # 现有 CSS 版（保留备用）
│   └── Live2DPetCharacter.tsx       # Live2D 版
├── hooks/
│   ├── useLive2DModel.ts
│   ├── useLive2DExpression.ts
│   └── useLipSync.ts
└── App.css                          # 毛玻璃 + 动画样式
```

### 表情映射方案

```typescript
// expressionMap.ts
export const EMOTION_MAP: Record<string, number> = {
  neutral: 0, happy: 1, sad: 2, angry: 3, surprised: 4, thinking: 5,
}

// Hermes system prompt 中加入：
// "在回复文本中用 [emotion] 标签标注情绪，如 [happy]我很开心！"
// 可用标签：neutral, happy, sad, angry, surprised, thinking

// 前端解析：
const emotionRegex = /\[(neutral|happy|sad|angry|surprised|thinking)\]/g
```

---

## 第六部分：依赖变动

```diff
# package.json
- "pixi.js": "^7.4.3"
- "pixi-live2d-display": "^0.4.0"
```

新增：
- `src/renderer/src/live2d/core/live2dcubismcore.min.js`
- `src/renderer/src/live2d/framework/`（CubismWebFramework 源码）
- `assets/live2d/`（模型目录）
- electron-vite 配置 `viteStaticCopy` 复制 Core 文件

---

## 第七部分：性能与许可

**性能**：
- 帧率锁定 60fps（`requestAnimationFrame`）
- .moc3 文件 1-10MB，纹理是主要内存消耗
- 确保 GPU 加速未禁用，WebGL2 依赖 GPU
- `backgroundThrottling: false` 防止窗口失焦降帧
- 透明窗口 + `backdrop-filter` 在 Windows 上部分 GPU 有兼容问题，需测试

**许可**：
- Cubism SDK：个人/年营收 < 2000 万日元免费
- 如支持用户自行加载模型（"Expandable Application"），需提交审核
- 当前仅内置模型，不涉及此问题
- CubismWebFramework：FOSS 许可

---

## 附录：调研项目索引（60+ 项目）

### AI + Live2D 桌宠（Tier 1）

| 项目 | Stars | 技术栈 | 核心价值 |
|------|-------|--------|---------|
| [moeru-ai/airi](https://github.com/moeru-ai/airi) | 39.2k | TS/Vue/Electron/WebGPU | 最完整 AI 桌宠，MIT |
| [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) | 7.6k | Python/TS/Electron | 架构完全对标，MIT |
| [handcrafted-persona-engine](https://github.com/elevenyellow/handcrafted-persona-engine) | 1.2k | C#/.NET/Unity | 最精细口型同步 |
| [PPet](https://github.com/zenghongtu/PPet) | ~2k | TS/React/Electron/Vite | 架构高度相似，MIT |
| [Live2DPet](https://github.com/x380kkm/Live2DPet) | 56 | JS/Electron/PixiJS | 音频状态机+情感累积，MIT |
| [AI-Girlfriend-Desktop-Pet](https://github.com/DD-MASTERT/AI-Girlfriend-Desktop-Pet) | 206 | Python/live2d-py | 多 TTS 方案集成 |
| [chatgpt-desktopPet](https://github.com/kirbystudy/chatgpt-desktopPet) | 86 | JS/Electron/Live2D | 最简单参考实现 |
| [NyaDesk_Pet](https://github.com/gameswu/NyaDesk_Pet) | 7 | TS/Electron/MCP | MCP 集成对标 |

### 热门桌宠（Tier 2）

| 项目 | Stars | 技术栈 | 核心价值 |
|------|-------|--------|---------|
| [Mate-Engine](https://github.com/shinyflvre/Mate-Engine) | 3.2k | Unity/VRM/Steam | 3D 桌宠市场验证 |
| [clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk) | 2.4k | JS/Electron/SVG | AI Agent 监控桌宠 |
| [openpets](https://github.com/alvinunreal/openpets) | 372 | TS/Electron/MCP | MCP 集成，MIT |
| [Ark-Pets](https://github.com/isHarryh/Ark-Pets) | 932 | Java/libGDX/Spine | Spine 骨骼动画 |
| [DyberPet](https://github.com/ChaozhongLiu/DyberPet) | 732 | Python/PySide6 | 通用桌宠框架 |
| [Pet-GPT](https://github.com/Hanzoe/Pet-GPT) | 410 | Python/PyQt | 主动对话机制 |
| [Agentic-Desktop-Pet](https://github.com/jihe520/Agentic-Desktop-Pet) | 278 | Python/Godot4 | LLM+记忆+情感+RPG |
| [Clyde](https://github.com/QingJ01/Clyde) | 130 | Rust/Tauri | Electron 轻量替代 |
| [yuns-desktop-pet](https://github.com/JianguSheng/yuns-desktop-pet) | 127 | JS/Electron | MCP 工具调用，MIT |

### VTuber & 虚拟人（Tier 3）

| 项目 | Stars | 核心价值 |
|------|-------|---------|
| [live2d-widget](https://github.com/stevenjoezhang/live2d-widget) | 10.5k | Web Live2D 看板娘 |
| [Inochi2D](https://github.com/Inochi2D/inochi2d) | 3k | Live2D 开源替代 |
| [vignette](https://github.com/vignetteapp/vignette) | 518 | 开源 VTuber 工具 |
| [Facemoji](https://github.com/huihut/Facemoji) | 453 | 面部追踪→Live2D |
| [VTuber-Python-Unity](https://github.com/mmmmm44/VTuber-Python-Unity) | 551 | WebSocket 通信 |
| [live2d-TTS-LLM-Vtuber](https://github.com/v3ucn/live2d-TTS-LLM-GPT-SoVITS-Vtuber) | 276 | GPT-SoVITS 中文 TTS |

### 经典桌宠框架（Tier 4）

| 项目 | Stars | 核心价值 |
|------|-------|---------|
| [desktopPet/eSheep](https://github.com/Adrianotiger/desktopPet) | 1.1k | 经典 XML 行为配置 |
| [Desktop_Gremlin](https://github.com/Kritzkingvoid/Desktop_Gremlin) | 522 | 桌面互动性 |
| [Shijima-Qt](https://github.com/pixelomer/Shijima-Qt) | 187 | 跨平台 Shimeji |

### 工具 & 辅助库（Tier 5）

| 项目 | Stars | 核心价值 |
|------|-------|---------|
| [react-live2d](https://github.com/chendishen/react-live2d) | 91 | React 组件封装 |
| [easy-live2d](https://github.com/Panzer-Jack/easy-live2d) | 189 | 轻量 Web SDK 封装，MIT |
| [live2d-motionSync](https://github.com/liyao1520/live2d-motionSync) | 100 | 动作同步库 |
| [live2d-motion3](https://github.com/EasyLive2D/live2d-motion3) | 27 | 程序化生成动作数据 |
| [prometheus-avatar](https://github.com/myths-labs/prometheus-avatar) | 5 | LLM 驱动 Live2D SDK |
| [bongo-cat-next](https://github.com/liwenka1/bongo-cat-next) | 112 | 输入驱动 Live2D |
| [chiikawa-pets](https://github.com/meiguiyisenluo/chiikawa-pets) | - | Electron+Vite+PixiJS，MIT |
| [Eikanya/Live2d-model](https://github.com/Eikanya/Live2d-model) | 3.1k | 游戏模型合集（仅测试） |

### 口型同步（Tier 6）

| 项目 | 方案 | 精度 |
|------|------|------|
| [handcrafted-persona-engine](https://github.com/elevenyellow/handcrafted-persona-engine) | espeak-ng 音素 | **高** |
| [Live2DPet](https://github.com/x380kkm/Live2DPet) | 音频状态机+情感累积 | 中 |
| [Live2D-lipSync-Pixijs](https://github.com/Maski0/Live2D-lipSync-Pixijs) | Web Audio API | 低 |
| [live2dSpeek](https://github.com/lyz1810/live2dSpeek) | edge-TTS + Live2D | 低 |

### 官方资源

| 资料 | 链接 |
|------|------|
| Cubism SDK for Web 下载 | https://www.live2d.com/download/cubism-sdk/download-web/ |
| CubismWebFramework | https://github.com/Live2D/CubismWebFramework |
| CubismWebSamples | https://github.com/Live2D/CubismWebSamples |
| 官方示例模型 | https://www.live2d.com/en/download/sample-data/ |
| nizima 模型市场 | https://nizima.com |

---

*本文档基于 2026-05-13 调研编写，涵盖 60+ 开源项目和 UI/UX 设计模式。技术细节以实际实现为准。*
