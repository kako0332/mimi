# Mimi Desktop Pet — 改进方案

> **基于**：`docs/live2d-technical-plan.md` 技术调研报告 + 项目现状代码审查
> **编写日期**：2026-05-13
> **目标**：分阶段改造 Mimi 桌面宠物，从 CSS 宠物升级为 Live2D 桌宠，同时全面美化 UI

---

## 现状总结

| 维度 | 现状 | 问题 |
|------|------|------|
| 宠物渲染 | CSS 圆形 80px，6 种表情 | 表现力差，纯 div 画出来的 |
| 表情系统 | `detectExpression()` 关键词正则匹配 | 不准确，无法反映真实情绪 |
| 聊天面板 | 白色实心卡片 `background: white` | 透明窗口上非常突兀 |
| 动画 | 仅基础浮动/眨眼 | 无弹出动画、无打字指示器 |
| 依赖 | `pixi.js@7.4.3` + `pixi-live2d-display@0.4.0` | **完全未使用**，且版本不兼容（该库要求 pixi v6） |
| 窗口 | 300×350 固定尺寸 | Live2D 模型需要更大的宠物区域 |

---

## Phase 1：UI 毛玻璃美化（无风险，即时可见效果）

> **预计工时**：0.5-1 天 | **改动范围**：仅 CSS + 少量 TSX
> **目标**：在不改任何逻辑的前提下，让 UI 变好看

### 1.1 聊天面板 → 毛玻璃效果

**文件**：`src/renderer/src/App.css`

```css
/* 替换现有 .chat-container */
.chat-container {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  max-height: calc(100% - 130px);
  /* 毛玻璃核心 */
  background: rgba(25, 25, 40, 0.65);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  -webkit-app-region: no-drag;
  z-index: 5;
  color: #e2e8f0;
  animation: chat-pop-open 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 1.2 消息气泡 → 半透明

```css
.msg.user {
  background: rgba(96, 165, 250, 0.2);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(96, 165, 250, 0.15);
  color: #e2e8f0;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}
.msg.assistant {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  color: #e2e8f0;
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}
.msg.error {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  align-self: center;
}
```

### 1.3 弹簧弹出动画

```css
@keyframes chat-pop-open {
  0% { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.9); filter: blur(4px); }
  80% { transform: translateX(-50%) translateY(4px) scale(1.02); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); filter: blur(0); }
}
```

### 1.4 打字指示器

**文件**：`src/renderer/src/components/ChatBubble.tsx` — 在流式输出时显示三点弹跳

```tsx
{streaming && (
  <div className="typing-indicator">
    <span /><span /><span />
  </div>
)}
```

```css
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  align-self: flex-start;
}
.typing-indicator span {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  animation: typing-bounce 1.4s infinite ease-in-out;
}
.typing-indicator span:nth-child(1) { animation-delay: 0s; }
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
```

### 1.5 消息入场动画

```css
.msg {
  animation: message-enter 0.3s ease-out;
}
@keyframes message-enter {
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

### 1.6 宠物点击挤压反馈 + 情绪色光晕

```css
.pet-body {
  transition: box-shadow 0.8s ease;
  box-shadow: 0 0 20px var(--pet-glow);
}
.pet:active .pet-body {
  animation: pet-squish 0.4s ease;
}
@keyframes pet-squish {
  0% { transform: scale(1, 1); }
  30% { transform: scale(1.15, 0.85); }
  50% { transform: scale(0.9, 1.1); }
  100% { transform: scale(1, 1); }
}
```

### 1.7 其他样式适配

所有原本 `color: #333`、`#666`、`#999` 的文字需改为浅色系，适配深色毛玻璃背景：

```css
/* 适配毛玻璃背景的文字颜色 */
.tab-btn { color: rgba(255, 255, 255, 0.5); }
.tab-btn.active { color: rgba(96, 165, 250, 0.9); }
.settings-btn { color: rgba(255, 255, 255, 0.4); }
.tool-call { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.1); }
.tool-name { color: rgba(255, 255, 255, 0.6); }
.tool-code { background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.7); }
.skill-row, .cron-row { background: rgba(255, 255, 255, 0.06); color: #ccc; }
/* 等等... */
```

**设置面板** `.settings-panel` 也需同步改为毛玻璃风格。

### 1.8 验证标准

- [x] 聊天面板在任意桌面壁纸上清晰可读
- [x] 点击宠物弹出面板有弹簧动画
- [x] 消息出现有滑入动画
- [x] 流式输出时有打字指示器
- [x] 所有文字在毛玻璃背景上可读

---

## Phase 2：清理无用依赖

> **预计工时**：10 分钟 | **改动范围**：`package.json`

当前 `package.json` 中的 `pixi.js` 和 `pixi-live2d-display` 完全未使用且互相不兼容。在引入新的 Live2D 方案前，先清理掉：

```bash
npm uninstall pixi.js pixi-live2d-display
```

这能减少 `node_modules` 体积约 30MB+，也避免未来混淆。

---

## Phase 3：Live2D 集成（核心改动）

> **预计工时**：2-3 天 | **改动范围**：新增 `live2d/` 目录 + 新组件 + 窗口配置
> **方案选择**：采用文档推荐的 **CubismWebFramework 官方 SDK**

### 3.1 为什么选官方 SDK 而不是 pixi-live2d-display？

| 对比项 | pixi-live2d-display | CubismWebFramework（推荐） |
|--------|---------------------|---------------------------|
| 维护状态 | ⚠️ 停更 2 年 | ✅ 活跃维护 |
| Cubism 版本 | 仅 4 | 4 + **5.3** |
| pixi.js 兼容 | 仅 v6（项目用的 v7） | 无依赖 |
| 口型同步 | 需自己实现 | 官方示例可直接参考 |
| Electron 验证 | 无成熟案例 | Open-LLM-VTuber 已验证 |

### 3.2 SDK 获取与内嵌

1. 从 https://www.live2d.com/download/cubism-sdk/download-web/ 下载 Cubism SDK for Web
2. 提取两个部分：
   - `Core/live2dcubismcore.min.js` → 放到 `src/renderer/src/live2d/core/`
   - `Framework/` TypeScript 源码 → 放到 `src/renderer/src/live2d/framework/`
3. 在 `electron.vite.config.ts` 中配置 `live2dcubismcore.min.js` 为外部脚本（需要在 Framework 之前加载）

```typescript
// electron.vite.config.ts 中增加
renderer: {
  build: {
    rollupOptions: {
      external: ['**/live2dcubismcore.min.js']
    }
  }
}
```

在 `src/renderer/index.html` 中添加：
```html
<script src="./live2d/core/live2dcubismcore.min.js"></script>
```

### 3.3 核心适配层实现

参考 Open-LLM-VTuber 的架构，实现以下文件：

```
src/renderer/src/live2d/
├── core/
│   └── live2dcubismcore.min.js
├── framework/           # CubismWebFramework 源码（从 SDK 复制）
├── app/
│   ├── LAppDelegate.ts         # WebGL 初始化、渲染循环
│   ├── LAppModel.ts            # 模型加载、表情、动作
│   ├── LAppLive2DManager.ts    # 模型生命周期管理
│   └── LAppWavFileHandler.ts   # RMS 音频分析（口型同步用）
└── api/
    ├── Live2DAdapter.ts        # React 统一 API
    ├── expressionMap.ts        # 情绪 → Live2D 表情映射
    └── lipSyncController.ts    # 口型同步控制器
```

### 3.4 Live2DPetCharacter.tsx 组件

```tsx
// src/renderer/src/components/Live2DPetCharacter.tsx
import { useEffect, useRef } from 'react'
import { Live2DAdapter } from '../live2d/api/Live2DAdapter'

interface Props {
  expression: string
  isStreaming: boolean
  onClick: () => void
}

export default function Live2DPetCharacter({ expression, isStreaming, onClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const adapterRef = useRef<Live2DAdapter | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const adapter = new Live2DAdapter(canvasRef.current)
    adapter.loadModel('assets/live2d/niziiro/mao.model3.json')
    adapterRef.current = adapter
    return () => adapter.dispose()
  }, [])

  useEffect(() => {
    adapterRef.current?.setExpression(expression)
  }, [expression])

  useEffect(() => {
    adapterRef.current?.setTalking(isStreaming)
  }, [isStreaming])

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={400}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    />
  )
}
```

### 3.5 窗口配置调整

Live2D 模型需要更大的渲染区域，主窗口尺寸需要调整：

```typescript
// src/main/index.ts createWindow()
mainWindow = new BrowserWindow({
  width: 400,          // 300 → 400
  height: 550,         // 350 → 550
  x: screenW - 450,
  y: screenH - 600,
  frame: false,
  transparent: true,
  resizable: false,
  skipTaskbar: true,
  alwaysOnTop: true,
  hasShadow: false,
  backgroundThrottling: false,  // 🔑 防止窗口失焦降帧
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false
  }
})
```

> **注意**：`backgroundThrottling: false` 很关键，否则窗口不在前台时 Live2D 会掉帧卡顿。

### 3.6 模型资源

下载 **Niziiro Mao** 模型（免费，个人使用许可），放到：

```
assets/live2d/niziiro/
├── mao.model3.json
├── mao.moc3
├── mao.physics3.json
├── textures/
├── motions/
└── expressions/
```

`electron-builder` 配置中已有 `"files": ["out/**/*", "assets/**/*"]`，无需额外配置。

### 3.7 App.tsx 切换

```tsx
// 条件渲染：有 Live2D 模型时用 Live2D，否则 fallback 到 CSS 版
import Live2DPetCharacter from './components/Live2DPetCharacter'

// 替换:
<PetCharacter expression={state.expression} onClick={handlePetClick} />
// 为:
<Live2DPetCharacter
  expression={state.expression}
  isStreaming={state.isStreaming}
  onClick={handlePetClick}
/>
```

### 3.8 验证标准

- [x] Live2D 角色替代 CSS 宠物，角色流畅渲染
- [x] 点击角色可打开/关闭聊天面板
- [x] 眨眼、呼吸等 Idle 动作自动播放
- [x] 表情切换有过渡效果

---

## Phase 4：交互增强

> **预计工时**：2 天 | **改动范围**：Live2D 适配层 + 主进程窗口管理

### 4.1 鼠标视线跟踪

利用 Cubism SDK 的 `CubismLookController`，让模型眼睛跟随鼠标：

```typescript
// LAppDelegate.ts 每帧更新
onMouseMove(e: MouseEvent) {
  this._manager.onDrag(
    (e.clientX / canvas.width) * 2 - 1,
    (e.clientY / canvas.height) * 2 - 1
  )
}
```

### 4.2 命中检测 + 鼠标穿透（关键体验）

这是桌面宠物最重要的交互功能——模型区域外鼠标穿透，模型区域内可交互：

```typescript
// 主进程 src/main/index.ts
// 窗口扩展到全屏（但透明所以不可见）
const allDisplays = screen.getAllDisplays()
const unionRect = displays.reduce(...)  // 计算所有显示器联合矩形
mainWindow.setBounds(unionRect)
mainWindow.setIgnoreMouseEvents(true, { forward: true })

// 渲染进程：Live2D hitTest 检测
canvas.addEventListener('mousemove', (e) => {
  const hitArea = model.hitTest(e.offsetX, e.offsetY)
  // 通过 IPC 通知主进程是否穿透
  window.api.setMousePassthrough(!hitArea)
})
```

> **我的建议**：这个功能复杂度较高，建议先实现「固定窗口 + 模型区域可交互」的基础方案，鼠标穿透作为进阶优化。原因：
> 1. 全屏透明窗口在某些 Windows GPU 上有兼容性问题
> 2. 固定窗口 + `setIgnoreMouseEvents` 的简单模式已能满足基本需求
> 3. 先验证 Live2D 渲染稳定，再折腾窗口穿透

### 4.3 点击交互

```typescript
// LAppDelegate.ts
onClick(e: MouseEvent) {
  const hitAreas = model.hitTest(e.offsetX, e.offsetY)
  if (hitAreas.includes('Head')) {
    model.setExpression('happy')   // 摸头 → 开心
  } else if (hitAreas.includes('Body')) {
    model.startMotion('tap_body')  // 点身体 → 小动作
  }
}
```

### 4.4 空闲动作循环

```typescript
// 空闲时随机播放 Idle 动作
setInterval(() => {
  if (!this._isTalking) {
    this._model.startMotion('Idle', Math.floor(Math.random() * 3))
  }
}, 8000)
```

### 4.5 验证标准

- [x] 模型眼睛跟随鼠标移动
- [x] 模型外区域鼠标穿透（或基础方案：固定窗口内可交互）
- [x] 点击模型头部/身体有不同反应
- [x] 空闲时自动播放动作

---

## Phase 5：情绪系统升级

> **预计工时**：1 天 | **改动范围**：`AppContext.tsx` + Hermes system prompt

### 5.1 问题

当前的 `detectExpression()` 用正则匹配关键词（如 "哈哈" → happy），非常不准确。AI 可能说 "这件事让我有些难过" 但不包含关键词。

### 5.2 方案：[emotion] 标签系统

参考 Open-LLM-VTuber 的成熟方案，让 AI 自己标注情绪：

**Step 1**：修改 Hermes system prompt（在 `src/main/hermes.ts` 的 chat 逻辑中）

```
在回复文本中用 [emotion] 标签标注你当前的情绪。
可用标签：[neutral] [happy] [sad] [angry] [surprised] [thinking] [sleeping]
每条回复开头加一个标签，例如：[happy]我很高兴见到你！
```

**Step 2**：前端解析器（替换 `detectExpression`）

```typescript
// AppContext.tsx
const EMOTION_REGEX = /\[(neutral|happy|sad|angry|surprised|thinking|sleeping)\]/g

// 新的 reducer 逻辑
case 'APPEND_LAST_MESSAGE': {
  const msgs = [...state.messages]
  const last = msgs[msgs.length - 1]
  if (last && last.role === 'assistant') {
    const newContent = last.content + action.content
    // 解析情绪标签
    const emotions = [...newContent.matchAll(EMOTION_REGEX)].map(m => m[1])
    const latestEmotion = emotions[emotions.length - 1]
    // 剥离标签用于显示
    const displayContent = newContent.replace(EMOTION_REGEX, '').trim()
    msgs[msgs.length - 1] = { ...last, content: displayContent }
    return {
      ...state,
      messages: msgs,
      expression: latestEmotion
        ? mapEmotionToExpression(latestEmotion)
        : state.expression
    }
  }
  return { ...state, messages: msgs }
}
```

**Step 3**：映射表

```typescript
function mapEmotionToExpression(emotion: string): Expression {
  const map: Record<string, Expression> = {
    neutral: 'idle',
    happy: 'happy',
    sad: 'sad',
    angry: 'angry',
    surprised: 'surprised',
    thinking: 'thinking',
    sleeping: 'sleeping'
  }
  return map[emotion] || 'idle'
}
```

> **注意**：需要扩展 `Expression` 类型，新增 `'angry' | 'surprised'`，或在映射层合并到现有类型中。

### 5.3 Fallback 保留

关键词匹配作为降级方案保留——当 AI 没有输出标签时，仍然用关键词猜测：

```typescript
// 如果没有检测到标签，用旧的关键词匹配
if (!latestEmotion) {
  return detectExpression(action.content, state.expression)
}
```

### 5.4 验证标准

- [x] AI 回复 `[happy]` 时宠物切到开心表情
- [x] 标签不出现在聊天气泡文本中
- [x] 没有标签时 fallback 到关键词匹配

---

## Phase 6：口型同步

> **预计工时**：1-2 天 | **改动范围**：Live2D 适配层 + TTS 集成

### 6.1 无 TTS 时的降级方案（优先实现）

当没有音频播放时，用 Talk 组动作模拟说话：

```typescript
// 流式输出开始时播放 Talk 动作
if (isStreaming) {
  this._model.startMotion('Talk', 0, 3)  // priority 3 = override idle
}
// 流式结束时恢复 Idle
if (!isStreaming) {
  this._model.startMotion('Idle', 0, 2)
}
```

### 6.2 有 TTS 时的 RMS 口型同步（进阶）

参考 Open-LLM-VTuber 的 `LAppWavFileHandler`：

1. `LAppWavFileHandler` 解析 PCM WAV 数据
2. 每帧计算当前采样窗口的 RMS（均方根）值
3. 映射到 `ParamMouthOpenY` 参数：`mouthOpenY = rms * lipSyncScale`

```typescript
// lipSyncController.ts
update deltaTime: number {
  const rms = this._wavHandler.getRms(deltaTime)
  const mouthY = Math.min(rms * 2.0, 1.0)  // lipSyncScale = 2.0
  this._model.setParameterValueById('ParamMouthOpenY', mouthY)
}
```

### 6.3 验证标准

- [x] 流式输出时模型播放 Talk 动作
- [x] 接入 TTS 后嘴巴开合同步音频
- [x] 不说话时嘴巴恢复正常

---

## Phase 7：打磨扩展（按需）

> 这些是锦上添花的功能，按需实现

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 模型切换 | 设置面板中选择不同 Live2D 模型 | 低 |
| 窗口拖拽 | 拖拽模型移动窗口位置 | 中 |
| 物理模拟调优 | 调整头发、衣服的物理参数 | 低 |
| 模型热加载 | 不重启应用切换模型 | 低 |
| 多显示器支持 | 窗口扩展到所有显示器 | 低 |
| Markdown 渲染 | 消息支持代码块、链接等 | 中 |
| 消息持久化 | 关闭应用后聊天记录保留 | 中 |

---

## 依赖变动汇总

```diff
# package.json
- "pixi.js": "^7.4.3"
- "pixi-live2d-display": "^0.4.0"
```

新增文件（不在 package.json 中）：
- `src/renderer/src/live2d/core/live2dcubismcore.min.js` — Cubism Core 闭源运行时
- `src/renderer/src/live2d/framework/` — CubismWebFramework TypeScript 源码
- `src/renderer/src/live2d/app/` — 适配层（LAppDelegate 等）
- `src/renderer/src/live2d/api/` — React 接口层
- `assets/live2d/niziiro/` — Niziiro Mao 模型资源

---

## 风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `backdrop-filter` 在 Windows 部分 GPU 上有兼容问题 | 毛玻璃效果可能不生效 | 添加 `@supports (backdrop-filter: blur(1px))` 检测，降级为半透明纯色 |
| Cubism Core 是闭源的 | 许可限制 | 个人/年营收 < 2000 万日元免费，当前不涉及商用 |
| WebGL2 依赖 GPU 加速 | 无 GPU 环境无法运行 | Electron 完全支持 WebGL2，桌面环境基本都有 GPU |
| Live2D .moc3 文件 1-10MB | 增加打包体积 | 用 `asar` 打包，模型文件不算大 |
| 全屏透明窗口内存占用 | 可能影响性能 | Phase 4 中先不实现全屏方案，用固定窗口 |

---

## 实施顺序建议

```
Phase 1（UI美化）    →  立刻做，零风险，效果显著
  ↓
Phase 2（清理依赖）  →  10 分钟的事
  ↓
Phase 3（Live2D）    →  核心改造，最关键
  ↓
Phase 4（交互增强）  →  视线跟踪等锦上添花
  ↓
Phase 5（情绪系统）  →  可与 Phase 3 并行
  ↓
Phase 6（口型同步）  →  依赖 TTS 接入
  ↓
Phase 7（打磨）      →  按需
```

**Phase 1 和 Phase 2 可以今天就做！** ✨
