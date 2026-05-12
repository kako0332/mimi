# Mimi - Desktop Pet

A desktop pet powered by [Hermes Agent](https://github.com/NousResearch/Hermes-Agent), built with Electron + React + TypeScript.

## v0.1.0 - Phase 1

Initial release.

### Features

- **Pet Character** - Flat vector style blue circle pet with 6 expressions (idle, happy, talking, sad, thinking, sleeping), pure CSS animations
- **Hermes Chat** - Real-time streaming chat via Hermes Agent's OpenAI-compatible SSE API (`localhost:8642/v1`)
- **Popup Chat Bubble** - Click the pet to open/close chat, supports streaming responses with cursor animation
- **Settings Panel** - Configure API URL, API Key, always-on-top toggle, auto-start toggle, connection test
- **System Tray** - Tray icon with context menu (show, settings, quit)
- **Offline Detection** - Auto-detects Hermes connection status every 10s, switches to sad expression and disables input when offline
- **Transparent Frameless Window** - Drag-to-move via top region, always-on-top by default

### Prerequisites

- Node.js >= 18
- [Hermes Agent](https://github.com/NousResearch/Hermes-Agent) running at `localhost:8642` (optional, for chat features)

### Development

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Project Structure

```
desktop-pet/
├── src/
│   ├── main/
│   │   ├── index.ts          # Electron main process
│   │   └── hermes.ts         # Hermes API client (SSE streaming)
│   ├── preload/
│   │   ├── index.ts          # Preload script (contextBridge)
│   │   └── index.d.ts        # TypeScript declarations
│   └── renderer/
│       └── src/
│           ├── App.tsx        # Root component
│           ├── App.css        # Pet animations + layout styles
│           ├── main.tsx       # React entry
│           ├── context/
│           │   └── AppContext.tsx  # Global state (Context + useReducer)
│           └── components/
│               ├── PetCharacter.tsx
│               ├── ChatBubble.tsx
│               ├── ChatInput.tsx
│               └── SettingsPanel.tsx
├── assets/
│   └── tray-icon.png
├── VERSION
└── electron.vite.config.ts
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 33 + electron-vite 2 |
| Frontend | React 18 + TypeScript 5 |
| State | React Context + useReducer |
| Persistence | electron-store |
| Streaming | SSE + MessagePort IPC |
