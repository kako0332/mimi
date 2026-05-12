import { useState, useCallback } from 'react'
import { useAppState } from './context/AppContext'
import PetCharacter from './components/PetCharacter'
import ChatBubble from './components/ChatBubble'
import ChatInput from './components/ChatInput'
import SettingsPanel from './components/SettingsPanel'

export default function App() {
  const { state } = useAppState()
  const [chatOpen, setChatOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  return (
    <div className="app">
      <div className="drag-region" />
      <PetCharacter expression={state.expression} onClick={handlePetClick} />

      {chatOpen && !settingsOpen && (
        <div className="chat-container">
          <ChatBubble messages={state.messages} streaming={state.isStreaming} />
          <ChatInput
            onSend={state.send}
            disabled={!state.connected || state.isStreaming}
          />
          {!state.connected && (
            <div className="offline-hint">连接断开，请检查 Hermes 是否运行</div>
          )}
          <button className="settings-btn" onClick={handleOpenSettings}>设置</button>
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel
          onClose={handleCloseSettings}
        />
      )}
    </div>
  )
}
