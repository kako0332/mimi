import { useState, useEffect, type KeyboardEvent } from 'react'

interface Props {
  onSend: (text: string) => void
  disabled: boolean
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)

  const handleSend = () => {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
  }

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    if (listening) {
      setListening(false)
      return
    }

    const recognition = new SR()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setText(prev => prev + transcript)
      setListening(false)
    }

    recognition.onerror = () => { setListening(false) }
    recognition.onend = () => { setListening(false) }

    recognition.start()
    setListening(true)
  }

  const voiceSupported = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  return (
    <div className="chat-input-row">
      {voiceSupported && (
        <button
          className={`voice-btn ${listening ? 'listening' : ''}`}
          onClick={toggleVoice}
          disabled={disabled}
          title={listening ? '停止录音' : '语音输入'}
        >
          {listening ? '●' : '🎤'}
        </button>
      )}
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKey}
        placeholder={disabled ? '连接中...' : '说点什么...'}
        disabled={disabled}
      />
      <button onClick={handleSend} disabled={disabled || !text.trim()}>
        发送
      </button>
      <button
        className="reset-btn"
        onClick={() => window.api.resetSession()}
        title="重置对话会话（session busy 时使用）"
      >
        ↻
      </button>
    </div>
  )
}
