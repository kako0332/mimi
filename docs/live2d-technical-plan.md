# Live2D 集成技术方案 — Mimi Desktop Pet

> 状态：调研完成，待决策
> 日期：2026-05-13
> 版本：v2.0（新增 60+ 开源项目调研）

---

## 一、现状分析

### 1.1 当前项目状态

| 项目 | 状态 |
|------|------|
| 产品名 | Mimi Desktop Pet v0.3.0 |
| 渲染方式 | 纯 CSS（`PetCharacter.tsx`，6 种表情：idle/happy/talking/sad/thinking/sleeping） |
| 已装依赖 | `pixi.js@7.4.3` + `pixi-live2d-display@0.4.0`（**完全未使用，且版本不兼容**） |
| 表情驱动 | 文本关键词正则匹配（`detectExpression`），粗粒度 |
| 技术栈 | Electron v33 + React 18 + TypeScript + electron-vite |
| AI 后端 | Hermes Agent + MCP Server (:3100) + WebSocket 流式通信 |

### 1.2 表情系统现状

当前表情通过关键词匹配文本内容触发（`AppContext.tsx` 中的 `detectExpression`）：
- 哈哈/开心 → happy
- 难过/抱歉 → sad
- 嗯/让我想想 → thinking
- 流式输出中 → talking
- 默认 → idle

**问题**：关键词匹配无法反映真实情绪，Live2D 模型支持更精细的表情控制。

---

## 二、调研项目深度分析

### 2.1 渲染库 / SDK 生态全景

| 库名称 | Stars | Cubism 版本 | PixiJS 版本 | 维护状态 | Electron 适用性 |
|--------|-------|-------------|------------|----------|----------------|
| **CubismWebFramework** (官方) | 官方 | 2.1/3/4/**5** | 无依赖 | 活跃 | **最佳** |
| **untitled-pixi-live2d-engine** | 新项目 | 2.1/4/**5** | **v8** | 活跃 | 良好 |
| pixi-live2d-display | 1.4k | 2.1/3/4 | 仅 v6 | **已停更 2 年** | 不推荐 |
| OhMyLive2D | 550 | 2/3/4/**5** | v6 | 低活跃 | 良好 |
| live2d-py | 1k | 2.1/3.0+ | N/A (Python) | 活跃 | **不兼容** |

### 2.2 pixi-live2d-display 详细评估

**基本信息**：1.4k stars，MIT 许可，但最后发布 v0.5.0-beta 是 2023 年 12 月。

**核心 API**：
```typescript
// 加载模型
const model = await Live2DModel.from('model.model3.json');

// 表情与动作
model.expression('smile');                    // 播放表情
model.motion('TapBody', 0, MotionPriority.Force); // 播放动作

// 交互
model.autoInteract = true;                    // 自动鼠标跟踪 + 点击
model.hitTest(x, y);                          // 命中检测 → 返回 hitArea 名称数组
model.focus(x, y);                            // 控制视线方向

// 参数控制（Cubism 4）
model.internalModel.coreModel.setParameterValueById('ParamAngleX', 30);
model.internalModel.physics;                  // 物理模拟实例
model.internalModel.lipSync = true;           // 启用口型同步参数
```

**已知问题**：
- 不支持 Cubism 5 模型（Issue #118, #166, #178）
- 不支持 PixiJS v7/v8（Issue #135, #166）
- Cubism 5.3 SDK 的 Core 完全破坏插件兼容性（Issue #178）
- 口型同步在 Cubism 2 和 4 中存在 bug（Issue #102）
- 项目实际上已停止维护

**结论：不推荐使用。** 虽然已装在 package.json 中，但版本不兼容、不支持 Cubism 5、已停更。

### 2.3 untitled-pixi-live2d-engine（新发现）

**地址**：https://github.com/GuangChen2333/untitled-pixi-live2d-engine

这是 pixi-live2d-display 的活跃 fork，由社区开发者维护：
- 支持 **PixiJS v8**
- 支持 **Cubism 5 SDK**
- 保持 Cubism 2 向后兼容
- 修复了原项目的多个长期 bug
- API 与 pixi-live2d-display 基本一致（迁移成本低）

**这是 PixiJS 路线的最佳选择。**

### 2.4 CubismWebFramework 官方 SDK 详细评估

**架构**：
```
CubismWebFramework/
├── effect/       # 眼球追踪(CubismLook)、眨眼(CubismEyeBlink)、呼吸(CubismBreath)
├── id/           # 参数 ID 管理
├── math/         # 矩阵(CubismMatrix44)、向量(CubismVector2)
├── model/        # CubismModel、CubismModelSettingJson、CubismUserModel
├── motion/       # CubismMotion、CubismMotionQueueManager、CubismExpressionMotion
├── physics/      # CubismPhysics（头发、衣服摆动）
├── rendering/    # CubismRenderer_WebGL、CubismOffscreenRenderTarget_WebGL
└── utils/        # 工具类
```

**核心 API**：
```typescript
// 动作播放（带优先级和回调）
startMotion(group: string, no: number, priority: number,
            onFinishedMotionHandler?: Function,
            onBeganMotionHandler?: Function): CubismMotionQueueEntryHandle

// 表情切换
setExpression(expressionId: string): void

// 碰撞检测
hitTest(hitArenaName: string, x: number, y: number): boolean

// 模型加载管线
model3.json → .moc3 → Expressions → Physics → Pose → EyeBlink → Breath
             → UserData → LipSyncIds → Layout → Motions → Textures
```

**Cubism 5 vs 4 关键差异**：

| 特性 | Cubism 4 | Cubism 5 |
|------|----------|----------|
| WebGL 版本 | WebGL1/WebGL2 | **仅 WebGL2** |
| 混合模式 | 不支持 | 支持（5-r.5-beta.1） |
| 离屏渲染 | 不支持 | 支持 CubismOffscreenRenderTarget |
| 表情管理 | 单个管理 | CubismExpressionMotionManager |
| 动作循环 | 各自实现 | 统一到 ACubismMotion |
| 动作回调 | 仅完成回调 | 新增开始回调 |
| 参数重复处理 | 无 | 支持 |

**WebGL2 兼容性**：Electron v33 的 Chromium 完全支持 WebGL2，无兼容性问题。

**Cubism Core 获取**：Core 是闭源运行时，需从 https://www.live2d.com/download/cubism-sdk/download-web/ 下载 `live2dcubismcore.min.js`，必须在 Framework 之前加载。

### 2.5 OhMyLive2D 评估

**地址**：https://github.com/oh-my-live2d/oh-my-live2d（v0.19.3，550 stars）

**亮点**：
- 唯一支持所有 Cubism 版本（2/3/4/5）的第三方库
- 自动打包 Cubism Core，无需手动下载
- API 极简：
```typescript
const oml2d = OML2D.loadOml2d({
  models: [{ path: 'model.model3.json', scale: 0.08, position: [0, 60] }]
});
```

**局限**：面向浏览器网页挂件设计，依赖 DOM 和 CDN，未针对 Electron 透明窗口优化。

---

## 三、同类项目深度调研

### 3.1 Open-LLM-VTuber（最重要的参考项目）

**地址**：https://github.com/Open-LLM-VTuber/Open-LLM-VTuber
**技术栈**：Electron 31 + React 18 + TypeScript + electron-vite（与我们的项目高度相似！）

#### 3.1.1 架构概览

```
Python FastAPI 后端 ←WebSocket→ Electron 前端
                                   ├── 主进程: window-manager.ts, menu-manager.ts
                                   ├── 渲染进程: React + WebSDK (Cubism SDK 直接内嵌)
                                   └── 预加载: IPC 桥接
```

**关键决策：直接内嵌 Cubism SDK for Web 的 Framework 和 Samples 源码到项目中**，而非使用 npm 包。这允许对口型同步、模型管理等进行深度定制。

#### 3.1.2 Live2D 渲染管线

```
WebGL2 上下文初始化 (LAppGlManager)
  → LAppDelegate.initialize(): 设置 canvas、透明混合模式、事件监听
  → 主循环 (requestAnimationFrame):
      清除画面 → 投影矩阵 → model.update() → model.draw(projection)
  → 帧率: 60fps, CanvasSize = 'auto', 支持 DPR
```

#### 3.1.3 宠物模式窗口管理（核心参考）

Open-LLM-VTuber 实现了完整的宠物模式，以下是关键实现细节：

**窗口配置**：
```typescript
// 宠物模式切换
setWindowModePet():
  setBackgroundColor('#00000000')           // 透明背景
  setAlwaysOnTop(true, 'screen-saver')      // 最高层级
  // 窗口扩展到所有显示器的联合矩形区域
  const displays = screen.getAllDisplays()
  const bounds = 计算所有显示器的联合矩形
  setBounds(bounds)
  setResizable(false)
  setSkipTaskbar(true)
  setIgnoreMouseEvents(true, { forward: true })  // 关键：鼠标穿透 + 事件转发
```

**两阶段模式切换（防闪烁）**：
1. 主进程设置透明度为 0 → 隐藏窗口
2. 渲染进程完成 UI 重布局 → 发送 `renderer-ready-for-mode-change`
3. 主进程完成最终切换 → 恢复透明度

**命中检测驱动的鼠标穿透**：
```typescript
// Live2D 模型的 hitTest 检测鼠标是否在模型上
// 命中时: 关闭穿透 → 模型可交互
// 未命中: 开启穿透 → 鼠标穿透到下方应用
model.anyhitTest(x, y) || model.isHitOnModel(x, y)
  → IPC 'update-component-hover' → 主进程动态切换 setIgnoreMouseEvents
```

**`{ forward: true }` 的关键作用**：Windows 平台设置此选项后，穿透的鼠标事件会被转发到窗口下方应用，同时窗口仍能通过 `mousemove` 事件感知鼠标位置（用于命中检测）。

#### 3.1.4 情绪标签系统（表情映射方案）

Open-LLM-VTuber 采用了非常优雅的 `[emotion]` 标签方案：

**后端处理管道**：
```
LLM 输出流 → sentence_divider → actions_extractor → display_processor → tts_filter
```

1. 系统提示要求 LLM 在回复中嵌入 `[emotion]` 标签，如 `[joy]我很高兴见到你！`
2. `actions_extractor` 用正则匹配 `[xxx]` 标签
3. `emotionMap` 映射表将情绪名转为表情索引：
   ```json
   {"neutral": 0, "anger": 2, "disgust": 2, "fear": 1, "joy": 3, "smirk": 3, "sadness": 1, "surprise": 3}
   ```
4. `remove_emotion_keywords()` 剥离标签，保证 TTS 和显示不受影响
5. WebSocket 发送 `audio` 消息时携带 `actions.expressions` 字段

**前端接收**：收到 `audio` 消息后，取 `expressions[0]` 设置表情，同时启动 Talk 组动作。

#### 3.1.5 口型同步实现

采用 **基于 RMS 的 WAV 文件分析**：

1. `LAppWavFileHandler.start(filePath)` 加载 WAV，解析 PCM 数据
2. 每帧 `update(deltaTimeSeconds)` 对 PCM 数据计算 RMS 值
3. `_lastRms` 驱动 `ParamMouthOpenY` 参数
4. 前端增加灵敏度增强：`_lastRms * lipSyncScale`，`lipSyncScale = 2.0`
5. 模型的 `_lipSyncIds` 从 model3.json 自动加载，无则 fallback 到 `ParamMouthOpenY`

**音频任务队列**：
- 后端 TTS 生成音频 → Base64 编码 → WebSocket 逐句发送
- 前端 `TaskQueue` 按序播放，每句间隔 20ms
- `AudioManager` 单例管理当前音频/模型，支持中断清空

#### 3.1.6 值得学习的架构模式

| 模式 | 说明 |
|------|------|
| **装饰器管道** | 后端用 Python 装饰器构建数据处理管道，每层职责单一 |
| **全局单例管理器** | LAppDelegate、AudioManager、audioTaskQueue 等单例管理 |
| **组件悬停追踪** | `hoveringComponents: Set<string>` 精确控制鼠标穿透 |
| **内嵌 SDK 源码** | 直接内嵌 Cubism SDK，允许深度定制 |
| **情绪标签嵌入** | `[emotion]` 标签在 LLM 输出中嵌入情绪，简单高效 |

### 3.2 chiikawa-pets（技术栈最接近的项目）

**地址**：https://github.com/meiguiyisenluo/chiikawa-pets
**技术栈**：Electron + Vite + PixiJS + Live2D, TypeScript 93.6%, **MIT 协议**

**关键特性**：
- **自研 C++ Win32 全局 Hook**：比 rdev/Tauri 延迟更低，事件吞吐量更高
- 真正透明窗口：Frameless, click-through, always-on-top
- 与我们的 desktop-pet 技术栈高度一致，值得深入研究

### 3.3 其他 Electron + Live2D 项目

| 项目 | Stars | 技术栈 | 说明 |
|------|-------|--------|------|
| [live2d-copilot](https://github.com/ai-zen/live2d-copilot) | 20 | TS + Vue + Electron | AI 桌宠，含 Steam Workshop 集成 |
| [chiikawa-pets](https://github.com/meiguiyisenluo/chiikawa-pets) | - | TS + Electron + Vite + PixiJS | 最接近我们的技术栈，MIT |
| [chatgpt_desktopPet](https://github.com/kirbystudy/chatgpt_desktopPet) | 86 | JS + Electron | 基于 Electron 的 Live2D 桌宠 |
| [Vibe_DesktopPet](https://github.com/yuuiwa1551/Vibe_DesktopPet) | - | - | AI 驱动 Live2D 桌宠，有记忆/情绪 |

### 3.4 live2d-py（Python 方案）

**地址**：https://github.com/EasyLive2D/live2d-py（~1k stars）

**功能亮点**（用户特别关注）：
- 基于 Cubism SDK 5 r4 的 Python C Extension
- 内置口型同步、面捕 (mediapipe)、精确点击检测
- 兼容 Pygame / PyQt5 / PySide6 / GLFW

**与现有架构的兼容性**：

| 方案 | 可行性 | 代价 |
|------|--------|------|
| Electron spawn Python 子进程，帧流传输 | 复杂，有延迟 | 进程间通信、帧率同步 |
| 放弃 Electron，用 PySide6 重写 | 架构完全改变 | 丢掉全部 React UI + MCP + Hermes 代码 |
| **借鉴功能，用 Web SDK 实现同等能力** | **最实际** | 在 Electron 渲染进程中用 WebGL 实现 |

**结论**：live2d-py 的功能清单作为需求参考，但在 Electron 架构内用 Web 端 SDK 实现更合理。

---

## 四、开源项目全景调研（60+ 项目）

### 4.1 Tier 1：AI + Live2D 桌面宠物（与本项目最相关）

| 项目 | Stars | 技术栈 | 核心特性 | 可借鉴点 | 许可证 |
|------|-------|--------|---------|---------|--------|
| [**moeru-ai/airi**](https://github.com/moeru-ai/airi) | **39.2k** | TS/Vue/Electron/WebGPU | 同时支持 Live2D + VRM，集成 LLM/TTS/ASR 全链路 | **最完整的 AI 桌宠方案**，39k stars 验证架构可行性，WebGPU 渲染，插件化 LLM Provider | MIT |
| [**Open-LLM-VTuber**](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) | **7.6k** | Python/TS/Electron/electron-vite | LLM 驱动虚拟主播，`[emotion]` 标签系统，RMS 口型同步 | **已深度分析（见第三章）**，技术栈与我们完全一致 | MIT |
| [**handcrafted-persona-engine**](https://github.com/elevenyellow/handcrafted-persona-engine) | **1.2k** | C#/.NET/Unity/Live2D | 完整 AI 角色引擎：双 ASR + LLM + TTS + espeak-ng 音素口型同步 + RVC 变声 | **最精细的口型同步方案**（音素→口型映射），`[EMOTION:😊]` 标签驱动表情，Persona 性格系统 | - |
| [**PPet**](https://github.com/zenghongtu/PPet) | **~2k** | TS/React/Electron/Vite/Live2D | Electron 桌面宠物，支持 Live2D v2/v3，系统托盘 | **架构高度相似**（Electron + React + Vite），MIT 可直接参考 Live2D 集成方案 | **MIT** |
| [**Live2DPet**](https://github.com/x380kkm/Live2DPet) | **56** | JS/Electron/PixiJS/VOICEVOX | AI 桌宠，音频状态机，情感累积系统，模型热导入 | **同技术栈**（Electron + PixiJS + Live2D），音频状态机、情感累积系统可直接借鉴 | MIT |
| [**AI-Girlfriend-Desktop-Pet**](https://github.com/DD-MASTERT/AI-Girlfriend-Desktop-Pet) | **206** | Python/live2d-py/GPT-SoVITS/Edge-TTS | 功能最全面的 AI 桌宠之一，Live2D 2.0/3.0，语音识别，屏幕识别 | TTS 方案（GPT-SoVITS、CosyVoice、Edge-TTS）集成方式，多国产大模型 API 支持 | - |
| [**chatgpt-desktopPet**](https://github.com/kirbystudy/chatgpt-desktopPet) | **86** | JS/Electron/Live2D/ChatGPT | Electron + Live2D + ChatGPT 对话 | 技术栈高度吻合，最简单直接的参考实现 | - |
| [**Slebee/ChatGPT-live2d-Desktop**](https://github.com/Slebee/ChatGPT-live2d-Desktop) | **44** | TS/React/Live2D | ChatGPT 客户端 + Live2D 角色 | React + ChatGPT + Live2D 组件架构 | - |
| [**NyaDesk_Pet**](https://github.com/gameswu/NyaDesk_Pet) | **7** | TS/Electron/Live2D/MCP | 桌面宠物，支持 Live2D + AI Agent，**MCP 协议支持** | 与我们的 MCP + Hermes 架构直接对标 | - |

### 4.2 Tier 2：热门桌面宠物 & AI 编程助手桌宠

| 项目 | Stars | 技术栈 | 核心特性 | 可借鉴点 | 许可证 |
|------|-------|--------|---------|---------|--------|
| [**Mate-Engine**](https://github.com/shinyflvre/Mate-Engine) | **3.2k** | Unity/VRM/Steam | 免费 Desktop Mate 替代品，Steam 上架 | 3D 桌宠市场验证（3k+ stars），Steam 分发商业模式 | 自定义 |
| [**clawd-on-desk**](https://github.com/rullerzhou-afk/clawd-on-desk) | **2.4k** | JS/Electron/SVG | 像素风桌宠，监控 Claude Code/Codex/Cursor AI Agent 状态 | **2026 年爆款品类**，AI Agent 监控桌宠，Electron + SVG 轻量方案 | AGPL-3.0 |
| [**openpets**](https://github.com/alvinunreal/openpets) | **372** | TS/Electron/Bun/MCP | MCP 协议与 Claude Code 集成，像素艺术 | **MCP 集成创新**，让桌宠感知 AI Agent 状态 | **MIT** |
| [**Ark-Pets**](https://github.com/isHarryh/Ark-Pets) | **932** | Java/libGDX/Spine | 明日方舟桌宠，Spine 骨骼动画 | Spine 2D 骨骼动画方案（Live2D 替代） | GPL-3.0 |
| [**DyberPet**](https://github.com/ChaozhongLiu/DyberPet) | **732** | Python/PySide6 | 通用桌宠框架，模块化角色定义系统 | 作为框架设计的模块化架构 | GPL-3.0 |
| [**Pet-GPT**](https://github.com/Hanzoe/Pet-GPT) | **410** | Python/PyQt | AI 桌宠，**主动找用户聊天** | 主动对话机制——桌宠不只被动回答，还会主动发起 | GPL-3.0 |
| [**Agentic-Desktop-Pet**](https://github.com/jihe520/Agentic-Desktop-Pet) | **278** | Python/Godot4/LLM/RAG | LLM + 记忆 + 情感 + RPG 系统 + Claude Code | 最完整的 Agentic 桌宠概念设计 | - |
| [**Clyde**](https://github.com/QingJ01/Clyde) | **130** | Rust/Tauri | 轻量 AI 编程助手桌宠 | Rust + Tauri 作为 Electron 的轻量替代方案 | AGPL-3.0 |
| [**yuns-desktop-pet**](https://github.com/JianguSheng/yuns-desktop-pet) | **127** | JS/Electron | AI 桌宠，多模型对话 + MCP 工具调用 + 视觉分析 | MCP 工具调用集成，让桌宠能执行实际操作 | **MIT** |

### 4.3 Tier 3：VTuber & 虚拟人项目

| 项目 | Stars | 技术栈 | 核心特性 | 可借鉴点 | 许可证 |
|------|-------|--------|---------|---------|--------|
| [**live2d-widget**](https://github.com/stevenjoezhang/live2d-widget) | **10.5k** | JS | 网页 Live2D 看板娘，支持 Cubism 2-5，零构建部署 | CDN 模型加载方案，鼠标交互机制，插件化模型切换 | GPL-3.0 |
| [**Inochi2D**](https://github.com/Inochi2D/inochi2d) | **3k** | D/C FFI/Godot | **Live2D 的开源替代方案**，Puppet Animation 标准 | 如 Live2D 许可证受限，这是可行替代路线 | BSD-2-Clause |
| [**vignette**](https://github.com/vignetteapp/vignette) | **518** | C#/.NET 7/UWP/WinUI | 开源 VTuber 工具套件，面部追踪 + Live2D | Windows 原生方案参考 | GPL-3.0 |
| [**Facemoji**](https://github.com/huihut/Facemoji) | **453** | C#/Unity/MediaPipe/Live2D | 面部表情追踪 → Live2D 参数映射 | MediaPipe Face Mesh → Live2D 参数映射算法 | 已归档 |
| [**VTuber-Python-Unity**](https://github.com/mmmmm44/VTuber-Python-Unity) | **551** | Python/C#/OpenCV/WebSocket | Python 追踪 + Unity 渲染，前后端分离 | WebSocket 通信协议，OpenCV 面部特征点提取 | - |
| [**live2d-TTS-LLM-Vtuber**](https://github.com/v3ucn/live2d-TTS-LLM-GPT-SoVITS-Vtuber) | **276** | HTML/JS/GPT-SoVITS | Live2D + TTS + LLM 流式方案，纯 Web | GPT-SoVITS 中文语音合成集成，流式架构 | - |
| [**open-vt**](https://github.com/erodozer/open-vt) | **98** | GDScript/Godot | Linux 平台 Live2D VTuber | Godot 引擎方案，Linux 适配参考 | - |

### 4.4 Tier 4：经典桌宠 & 桌宠框架

| 项目 | Stars | 技术栈 | 核心特性 | 可借鉴点 | 许可证 |
|------|-------|--------|---------|---------|--------|
| [**desktopPet (eSheep)**](https://github.com/Adrianotiger/desktopPet) | **1.1k** | C#/.NET | 复刻 1995 经典 eSheep，XML 角色定义 | 经典精灵图动画架构，XML 行为配置驱动 | - |
| [**Desktop_Gremlin**](https://github.com/Kritzkingvoid/Desktop_Gremlin) | **522** | C# WPF | 模仿 Desktop Goose，在桌面搞破坏 | 互动性是关键——桌宠应能与桌面元素交互 | - |
| [**Shijima-Qt**](https://github.com/pixelomer/Shijima-Qt) | **187** | C++/Qt6 | 跨平台 Shimeji 运行器，自定义角色包 | 原生 C++ 性能，Qt6 跨平台，Shimeji 格式是桌宠通用格式 | GPL-3.0 |
| [**ZcChat**](https://github.com/Zao-chen/ZcChat) | **532** | C++ | Galgame 风格 AI 桌宠 | Galgame 对话系统设计，适合角色扮演场景 | GPL-3.0 |
| [**VirtualCockroach**](https://github.com/FerryYoungFan/VirtualCockroach) | **709** | ActionScript | 桌面蟑螂"宠物" | 非传统宠物也有市场 | - |

### 4.5 Tier 5：Live2D 工具链 & 辅助库

| 项目 | Stars | 技术栈 | 核心特性 | 可借鉴点 | 许可证 |
|------|-------|--------|---------|---------|--------|
| [**react-live2d**](https://github.com/chendishen/react-live2d) | **91** | React/TS | React 组件封装 Live2D | **可直接集成**到 React 项目，减少底层 WebGL 操作 | - |
| [**easy-live2d**](https://github.com/Panzer-Jack/easy-live2d) | **189** | TS/PixiJS | 轻量级 Live2D Web SDK 封装 | 简化的 Live2D 加载和渲染流程 | **MIT** |
| [**live2d-motionSync**](https://github.com/liyao1520/live2d-motionSync) | **100** | TS | Live2D 动作同步库 | 音频/视频驱动 Live2D 参数，实时动作同步 | - |
| [**live2d-motion3**](https://github.com/EasyLive2D/live2d-motion3) | **27** | Python | **程序化生成 Live2D 动作数据** | 无需 Cubism Editor 即可创建 motion3.json，为桌宠批量生成动作 | - |
| [**Motion_PNGTuber**](https://github.com/rotejin/Motion_PNGTuber) | **301** | Python | PNGTuber 与 Live2D 之间的轻量方案 | 实时口型同步、头发物理效果模拟的轻量实现 | - |
| [**prometheus-avatar**](https://github.com/myths-labs/prometheus-avatar) | **5** | TS | LLM 驱动 Live2D 头像 SDK | LLM 驱动 Live2D 的 SDK 化方案，可直接集成 | - |
| [**bongo-cat-next**](https://github.com/liwenka1/bongo-cat-next) | **112** | TS | 键盘/鼠标输入驱动 Live2D 猫咪 | 用户输入 → Live2D 动作映射的交互设计 | - |
| [**JPet**](https://github.com/Xinrea/JPet) | **95** | C++/Svelte/WebView2 | C++ 原生 + WebView2 渲染 Live2D | WebView2 方案比 Electron 更轻量 | - |
| [**petto**](https://github.com/funnycups/petto) | **101** | Dart/Flutter | 跨平台 Live2D 智能助手 | Flutter 移动端 + 桌面端统一方案 | - |
| [**XLand**](https://github.com/huisedenanhai/XLand) | **68** | C#/Unity | Live2D VTuber + 可扩展节点图编辑器 | 节点图编辑器用于复杂动画工作流编排 | - |
| [**DigitalLife**](https://github.com/LeafYeeXYZ/DigitalLife) | **49** | TS/React | Live2D 为载体的"数字生命" | Live2D 作为 AI 代理可视化形象的完整方案 | - |
| [**facial-landmarks-for-cubism**](https://github.com/adrianiainlam/facial-landmarks-for-cubism) | **73** | C++ | 面部特征点 → Live2D 参数映射 | 摄像头面部追踪驱动 Live2D 的核心算法 | - |
| [**VTS-Fullbody-Tracking**](https://github.com/jellydreams/VTS-Fullbody-Tracking) | **30** | Python/MediaPipe | MediaPipe 全身追踪 → VTube Studio | MediaPipe 关键点到 Live2D 参数的映射方法 | - |
| [**SimpleFacerig**](https://github.com/HTTdesu/SimpleFacerig) | **52** | C++/dlib | 简易面捕驱动 Live2D | dlib 面部追踪到 Live2D 参数映射 | - |

### 4.6 Tier 6：口型同步 & 音频驱动专项

| 项目 | Stars | 技术栈 | 口型同步方案 | 可借鉴点 | 许可证 |
|------|-------|--------|------------|---------|--------|
| [**handcrafted-persona-engine**](https://github.com/elevenyellow/handcrafted-persona-engine) | 1.2k | C#/Unity | espeak-ng 音素分析 → 口型映射（**精度最高**） | 音素→口型(phoneme-to-viseme)映射表，生产级方案 | - |
| [**Live2DPet**](https://github.com/x380kkm/Live2DPet) | 56 | JS/Electron | 音频状态机 + 情感累积系统 | 音频播放→默认→静音退化的状态机设计 | MIT |
| [**Live2D-lipSync-Pixijs**](https://github.com/Maski0/Live2D-lipSync-Pixijs) | 8 | TS/PixiJS/Web Audio API | Web Audio API 频率分析 → 口型驱动 | **同技术栈**，可直接参考实现代码 | - |
| [**Live2d-TTS-Audio-LipSync**](https://github.com/zhao896632126/Live2d-TTS-Audio-LipSync) | 14 | JS/Web Audio API | TTS 音频→频率分析→嘴巴开合 | 基于音频频率分析的简单口型驱动方案 | - |
| [**live2dSpeek**](https://github.com/lyz1810/live2dSpeek) | 74 | HTML/JS/edge-TTS | edge-TTS + Live2D 口型驱动 | 最简化的 Live2D + TTS 集成方案 | - |

### 4.7 口型同步方案对比

| 方案 | 原理 | 精度 | 延迟 | 复杂度 | 推荐场景 |
|------|------|------|------|--------|---------|
| **频率分析 (Web Audio API)** | 音频能量 → 嘴巴开合 | 低 | 极低 | 极低 | 快速原型 |
| **RMS 音量分析** | PCM 数据 RMS → ParamMouthOpenY | 中 | 极低 | 低 | **推荐（Open-LLM-VTuber 已验证）** |
| **音素分析 (espeak-ng)** | 文本 → 音素 → 口型 | **高** | 中 | 中 | 生产级最佳效果 |
| **音素 + 频率混合** | TTS 音素 + 实时频率 | **高** | 低 | 高 | 长期目标 |

### 4.8 技术栈分布统计

| 技术栈 | 项目数 | 代表项目 | 优势 | 劣势 |
|--------|--------|---------|------|------|
| **Electron + JS/TS** | 12+ | airi, PPet, clawd-on-desk, openpets | 生态丰富、前端友好、跨平台 | 内存占用较高 |
| **Python + Qt** | 5+ | DyberPet, Pet-GPT, AI-Girlfriend | AI 集成方便、开发快 | 性能一般 |
| **Unity + C#** | 4+ | Mate-Engine, handcrafted-persona | 渲染质量高、功能完整 | 包体大 |
| **Java + libGDX** | 1 | Ark-Pets | 跨平台 | JRE 依赖 |
| **C++ / Rust** | 3+ | Shijima-Qt, Clyde, JPet | 原生性能 | 开发复杂 |
| **Godot** | 2 | Agentic-Desktop-Pet, open-vt | 游戏引擎、完全免费 | Live2D 生态较小 |

### 4.9 2026 桌面宠物趋势总结

1. **AI Agent 监控桌宠**成为独立品类（clawd-on-desk 2.4k stars, openpets 372 stars），增长最快
2. **MCP 协议**是 AI 桌宠与 Agent 交互的新兴标准（openpets、yuns-desktop-pet）
3. **主动对话**机制（Pet-GPT）比被动响应更受欢迎
4. **情感系统**是差异化竞争的关键（kkclaw、Agentic-Desktop-Pet）
5. **moeru-ai/airi**（39.2k stars）证明 AI + Live2D 桌宠方案有巨大市场认可度
6. Electron 仍然是最流行的桌宠技术栈

---

## 五、免费 Live2D 模型资源

### 5.1 官方示例模型（推荐用于开发测试）

| 模型名 | 特点 | 适用场景 |
|--------|------|---------|
| **Niziiro Mao (虹色マオ)** | 正面朝向，Blend Shapes，丰富动作和表情，含 magic 效果 | **首选**，最适合 VTuber/桌宠 |
| **Hiyori Momose (日向)** | Cubism 3.0 标准模型，Skinning，完整动作集 | 经典测试模型 |
| **Tororo & Hijiki** | 猫模型 | 适合宠物类桌宠 |
| **Koharu & Haruto** | SD 角色，丰富表情和动作 | Q 版风格 |
| **Mark-kun** | 简单结构，支持眨眼/物理 | 学习测试 |

**许可**：个人和年销售额 1000 万日元以下的小规模企业可免费商用。

### 5.2 其他资源

| 资源 | 说明 | 注意 |
|------|------|------|
| [Eikanya/Live2d-model](https://github.com/Eikanya/Live2d-model) | 3.1k stars，从游戏提取的模型 | 版权不明确，仅开发测试参考 |
| [nizima 市场](https://nizima.com) | Live2D 官方推荐的创作者市场 | 有免费和付费模型 |

---

## 六、方案对比与推荐

### 6.1 三条技术路线

| 维度 | A. CubismWebFramework (官方) | B. untitled-pixi-live2d-engine | C. pixi-live2d-display (原方案) |
|------|---------------------------|-------------------------------|-------------------------------|
| Cubism 版本 | **5 (最新)** | **5** | 仅 4 |
| PixiJS 版本 | 无依赖 | **v8** | 仅 v6 (已过时) |
| 维护状态 | **官方持续更新** | 社区活跃 | **已停更 2 年** |
| 集成难度 | 中 — 需自行封装 | 低 — 类似 pixi-live2d-display | 低（但不推荐） |
| 口型同步 | 需自行实现（参考 Open-LLM-VTuber） | 需自行实现 | 需自行实现（有 bug） |
| 物理模拟 | 内置 CubismPhysics | 内置 | 内置 |
| WebGL 要求 | **WebGL2** (Electron 支持) | WebGL | WebGL |
| 长期可维护性 | **最佳** | 良好 | **差** |
| 参考实现 | Open-LLM-VTuber 已验证 | 新项目，参考较少 | 最多但过时 |

### 5.2 推荐：方案 A（CubismWebFramework 官方 SDK）

**理由**：

1. **Open-LLM-VTuber 已验证该方案的可行性**，且技术栈与我们高度一致（Electron + React + TypeScript + electron-vite）
2. 官方持续维护，支持 Cubism 5.3（最新），未来无升级障碍
3. TypeScript 原生，类型安全，与我们项目技术栈完美契合
4. 不依赖第三方库的生命周期（pixi-live2d-display 的教训）
5. Electron 的 Chromium 完全支持 WebGL2，无兼容性问题
6. 可直接参考 Open-LLM-VTuber 的内嵌 SDK 模式和封装层

**替代方案 B（untitled-pixi-live2d-engine）** 适合希望快速原型、优先考虑 API 简洁度的场景。如果后续需要深度控制（自定义口型同步、模型管理），仍可能需要切换到方案 A。

### 5.3 从 live2d-py 借鉴的功能清单

| live2d-py 功能 | 方案 A 中的实现方式 | 对应 API |
|----------------|-------------------|----------|
| 模型加载 | `CubismUserModel` + `loadAssets()` | 官方 SDK |
| 视线跟踪（鼠标） | `CubismLook` 效果 + 鼠标位置 | `effect/CubismLook` |
| 精确点击检测 | `hitTest(hitArenaName, x, y)` | `model/CubismModel` |
| 口型同步 | RMS 音频分析 → `ParamMouthOpenY` | 参考 Open-LLM-VTuber 的 `LAppWavFileHandler` |
| 动作播放 | `startMotion(group, no, priority, callbacks)` | `motion/CubismMotion` |
| 表情切换 | `setExpression(expressionId)` | `motion/CubismExpressionMotion` |
| 物理模拟 | `CubismPhysics`（头发、衣服摆动） | `physics/CubismPhysics` |
| 部件透明度 | `setParameterValueById()` | `model/CubismModel` |
| 眨眼/呼吸 | `CubismEyeBlink` / `CubismBreath` | `effect/` |

---

## 六、架构设计

### 6.1 整体架构

```
┌──────────────────────────────────────────────────┐
│              Electron Main Process                │
│  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
│  │  Hermes  │  │MCP Server │  │ WindowManager │  │
│  │  Agent   │  │  :3100    │  │ (transparent) │  │
│  └────┬─────┘  └─────┬─────┘  └───────┬───────┘  │
│       │              │                 │           │
│       └──────────IPC (Shared State)────┘           │
└───────────────────────┬───────────────────────────┘
                        │
┌───────────────────────┴───────────────────────────┐
│              Renderer Process (React)              │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │         AppContext (状态管理)                 │  │
│  │  expression → Live2D 表情映射                │  │
│  │  isStreaming → Talk 动作 + 口型同步          │  │
│  │  messages → [emotion] 标签解析               │  │
│  └────────────────┬────────────────────────────┘  │
│                   │                                │
│  ┌────────────────┴────────────────────────────┐  │
│  │          Live2DPetCharacter                  │  │
│  │  ┌──────────────────────────────────────┐   │  │
│  │  │  CubismWebFramework (WebGL2)          │   │  │
│  │  │  ├─ CubismUserModel                   │   │  │
│  │  │  │  ├─ 表情 (ExpressionManager)       │   │  │
│  │  │  │  ├─ 动作 (MotionQueueManager)      │   │  │
│  │  │  │  ├─ 物理 (CubismPhysics)           │   │  │
│  │  │  │  ├─ 眨眼 (CubismEyeBlink)          │   │  │
│  │  │  │  ├─ 呼吸 (CubismBreath)            │   │  │
│  │  │  │  ├─ 视线 (CubismLook)              │   │  │
│  │  │  │  └─ 口型 (RMS → ParamMouthOpenY)   │   │  │
│  │  │  ├─ CubismRenderer_WebGL              │   │  │
│  │  │  └─ HitTest (命中检测)                │   │  │
│  │  └──────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

### 6.2 目录结构规划

```
src/renderer/src/
├── live2d/
│   ├── core/                        # Cubism Core (live2dcubismcore.min.js)
│   ├── framework/                   # CubismWebFramework 源码（内嵌）
│   ├── app/
│   │   ├── LAppDelegate.ts          # 应用入口（参考 Open-LLM-VTuber）
│   │   ├── LAppModel.ts             # 模型封装（加载、更新、绘制）
│   │   ├── LAppLive2DManager.ts     # 模型生命周期管理
│   │   ├── LAppWavFileHandler.ts    # 音频分析（口型同步）
│   │   └── LAppAllocator.ts         # 内存分配
│   └── api/
│       ├── Live2DAdapter.ts         # 统一 API 封装（供 React 使用）
│       ├── expressionMap.ts         # 情绪 → 表情索引映射
│       └── lipSyncController.ts     # 口型同步控制器
├── components/
│   ├── PetCharacter.tsx             # 现有（CSS 版，保留备用）
│   └── Live2DPetCharacter.tsx       # 新增（Live2D 版）
└── hooks/
    ├── useLive2DModel.ts            # 模型加载与交互 hook
    ├── useLive2DExpression.ts       # 表情控制 hook
    └── useLipSync.ts                # 口型同步 hook
```

### 6.3 表情映射方案

参考 Open-LLM-VTuber 的 `[emotion]` 标签系统，结合现有 Hermes Agent：

```typescript
// expressionMap.ts
export const EMOTION_MAP: Record<string, number> = {
  neutral: 0,   // 默认
  happy: 1,     // 对应现有 happy
  sad: 2,       // 对应现有 sad
  angry: 3,
  surprised: 4,
  thinking: 5,  // 对应现有 thinking
}
```

**Hermes 集成方式**：
1. 修改 Hermes 的 system prompt，要求 AI 在回复中嵌入 `[emotion]` 标签
2. 前端在流式接收时解析标签，剥离文本后驱动 Live2D 表情
3. 保留现有的关键词匹配作为 fallback

---

## 七、口型同步方案

### 7.1 方案选择

参考 Open-LLM-VTuber 的 RMS 方案，这是最适合桌面宠物场景的实现：

```
音频源 → WAV/PCM 数据 → RMS 音量计算 → lipSyncScale 增强 → ParamMouthOpenY
```

### 7.2 具体实现

1. **音频来源**：Hermes TTS 输出的音频流
2. **分析方式**：对 PCM 数据逐帧计算 RMS（均方根）值
3. **参数映射**：`RMS 值 × lipSyncScale(2.0)` → `ParamMouthOpenY`（0-1 范围）
4. **同步机制**：音频播放与口型同步同时启动/停止

### 7.3 无 TTS 时的降级方案

当前 Hermes 没有内置 TTS，可先实现：
- 流式文本输出时播放 Talk 组动作（嘴巴开合动画由动作文件驱动）
- 后续接入 TTS 后切换到 RMS 口型同步

---

## 八、窗口管理方案

### 8.1 透明窗口配置

```typescript
const win = new BrowserWindow({
  transparent: true,
  frame: false,
  resizable: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  hasShadow: false,
  webPreferences: {
    backgroundThrottling: false,  // 防止后台节流
  },
})
```

### 8.2 WebGL 透明渲染

```typescript
// canvas 初始化
const gl = canvas.getContext('webgl2', {
  alpha: true,
  premultipliedAlpha: false,
  antialias: true,
})
gl.clearColor(0, 0, 0, 0)  // 完全透明
```

### 8.3 鼠标穿透（参考 Open-LLM-VTuber）

```typescript
// 默认穿透
win.setIgnoreMouseEvents(true, { forward: true })

// Live2D hitTest 检测到模型时，关闭穿透
// 前端通过 IPC 通知主进程
```

---

## 九、实施阶段

### Phase 1：基础替换（2-3 天）

1. 下载 Cubism SDK for Web，提取 `Core/` 和 `Framework/`
2. 将 Framework 源码内嵌到 `src/renderer/src/live2d/`
3. 实现 `LAppDelegate`、`LAppModel`、`LAppLive2DManager`
4. 新建 `Live2DPetCharacter.tsx`，替换 CSS 版
5. 加载 Niziiro Mao 测试模型，验证透明窗口渲染
6. 打通 expression 状态 → Live2D 表情映射
7. **验证标准**：桌面上看到 Live2D 角色替代 CSS 宠物，点击可打开聊天

### Phase 2：交互增强（2-3 天）

1. 实现鼠标视线跟踪（`CubismLook`）
2. 实现命中检测驱动的鼠标穿透
3. 实现空闲动作循环（Idle motion）
4. 实现点击交互（头部 → 切换表情，身体 → 播放动作）
5. **验证标准**：模型跟随鼠标视线，点击模型有反应，模型外区域鼠标穿透

### Phase 3：情绪系统升级（1-2 天）

1. 修改 Hermes system prompt，加入 `[emotion]` 标签要求
2. 前端实现标签解析器和 `expressionMap`
3. 替换现有 `detectExpression` 关键词匹配
4. 保留关键词匹配作为 fallback
5. **验证标准**：AI 回复能正确触发对应表情，标签不出现在聊天文本中

### Phase 4：口型同步（1-2 天）

1. 实现 `LAppWavFileHandler`（RMS 音频分析）
2. 实现 `lipSyncController`（参数映射 + 灵敏度增强）
3. 接入 Hermes TTS（如已实现）或使用 Talk 动作降级
4. **验证标准**：说话时嘴巴动作与音频同步

### Phase 5：打磨与扩展（按需）

1. 多模型切换（设置面板选择模型）
2. 物理模拟调优（头发、衣服摆动）
3. 窗口拖拽（通过模型区域拖拽移动窗口）
4. 模型资源管理（打包/热加载）
5. `live2dcubismcore.min.js` 的 viteStaticCopy 构建配置

---

## 十、依赖变动

```diff
# package.json
- "pixi.js": "^7.4.3"
- "pixi-live2d-display": "^0.4.0"
```

新增资源文件：
- `src/renderer/src/live2d/core/live2dcubismcore.min.js` — Cubism Core 运行时
- `src/renderer/src/live2d/framework/` — CubismWebFramework 源码
- `assets/live2d/` — 模型目录（.model3.json, .moc3, 纹理, 动作, 表情）

构建配置变更：
- electron-vite 需配置 `viteStaticCopy` 将 `live2dcubismcore.min.js` 复制到输出目录

---

## 十一、许可证注意事项

1. **Cubism SDK**：免费用于个人/年营收 < 2000 万日元的企业
2. **Expandable Application**：如果未来支持用户自行加载模型（类似 VTube Studio），需要向 Live2D 提交审核
3. **当前阶段**：仅内置模型，不涉及此问题
4. **CubismWebFramework**：FOSS 许可，可自由使用和修改
5. **模型资源**：官方示例模型免费用于个人/小企业，注意各模型的具体许可条款

---

## 十二、性能考量

1. **帧率**：锁定 60fps，使用 `requestAnimationFrame` 驱动
2. **内存**：.moc3 文件 1-10MB，纹理是主要消耗（1024×1024 RGBA ≈ 4MB）
3. **GPU**：确保未调用 `app.disableHardwareAcceleration()`，WebGL2 依赖 GPU 加速
4. **透明窗口**：Windows 上可能需要特殊处理（部分 GPU 驱动有兼容问题）
5. **多模型**：建议限制同时加载的模型数量（1-2 个）
6. **后台节流**：设置 `backgroundThrottling: false` 防止窗口失焦时降帧

---

## 附录 A：参考资料

| 资料 | 链接 |
|------|------|
| Cubism SDK for Web 下载 | https://www.live2d.com/download/cubism-sdk/download-web/ |
| CubismWebFramework 源码 | https://github.com/Live2D/CubismWebFramework |
| CubismWebSamples 源码 | https://github.com/Live2D/CubismWebSamples |
| Open-LLM-VTuber | https://github.com/Open-LLM-VTuber/Open-LLM-VTuber |
| Open-LLM-VTuber 前端 | https://github.com/Open-LLM-VTuber/Open-LLM-VTuber-Web |
| untitled-pixi-live2d-engine | https://github.com/GuangChen2333/untitled-pixi-live2d-engine |
| pixi-live2d-display | https://github.com/guansss/pixi-live2d-display |
| live2d-py | https://github.com/EasyLive2D/live2d-py |
| chiikawa-pets | https://github.com/meiguiyisenluo/chiikawa-pets |
| Live2D 官方示例模型 | https://www.live2d.com/en/download/sample-data/ |
| nizima 模型市场 | https://nizima.com |

---

*本文档基于 2026-05-13 的调研结果编写，技术细节以实际实现为准。*
