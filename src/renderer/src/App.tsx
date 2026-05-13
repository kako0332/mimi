import { useState, useCallback, useEffect } from 'react'
import { useAppState } from './context/AppContext'
import PetCharacter from './components/PetCharacter'
import ChatBubble from './components/ChatBubble'
import ChatInput from './components/ChatInput'
import SettingsPanel from './components/SettingsPanel'
import SkillsPanel from './components/SkillsPanel'
import MemoryPanel from './components/MemoryPanel'
import CronPanel from './components/CronPanel'

type Tab = 'chat' | 'skills' | 'memory' | 'cron'

export default function App() {
  const { state, send } = useAppState()
  const [chatOpen, setChatOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('chat')

  // Apply theme class
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
  }, [state.theme])

  const handlePetClick = useCallback(() => {
    if (settingsOpen) {
      setSettingsOpen(false)
    }
    setChatOpen(prev => !prev)
  }, [settingsOpen])

  const handleCloseChat = useCallback(() => setChatOpen(false), [])
  const handleOpenSettings = useCallback(() => {
    setChatOpen(false)
    setSettingsOpen(true)
  }, [])
  const handleCloseSettings = useCallback(() => setSettingsOpen(false), [])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chat', label: '聊天' },
    { key: 'skills', label: '技能' },
    { key: 'memory', label: '记忆' },
    { key: 'cron', label: '定时' }
  ]

  const latestNotification = state.notifications[state.notifications.length - 1]

  return (
    <div className="app">
      <div className="drag-region" />
      <PetCharacter expression={state.expression} onClick={handlePetClick} modelUrl={state.live2dModelUrl} />

      {latestNotification && (
        <div className="pet-notification" key={latestNotification.timestamp}>
          <strong>{latestNotification.title}</strong>
          <span>{latestNotification.message}</span>
        </div>
      )}

      {chatOpen && !settingsOpen && (
        <div className="chat-container">
          <div className="tab-bar">
            {tabs.map(t => (
              <button
                key={t.key}
                className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setActiveTab(t.key)}
              >{t.label}</button>
            ))}
          </div>

          {activeTab === 'chat' && (
            <>
              <ChatBubble messages={state.messages} streaming={state.isStreaming} />
              <ChatInput
                onSend={send}
                disabled={!state.connected || state.isStreaming}
              />
              {!state.connected && (
                <div className="offline-hint">连接断开，请检查 Hermes 是否运行</div>
              )}
            </>
          )}

          {activeTab === 'skills' && <SkillsPanel />}
          {activeTab === 'memory' && <MemoryPanel />}
          {activeTab === 'cron' && <CronPanel />}

          <button className="settings-btn" onClick={handleOpenSettings}>设置</button>
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel onClose={handleCloseSettings} />
      )}
    </div>
  )
}
