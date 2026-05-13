import { useEffect, useState } from 'react'
import { useAppState } from '../context/AppContext'

export default function MemoryPanel() {
  const { state, refreshSessions } = useAppState()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])

  useEffect(() => { refreshSessions() }, [refreshSessions])

  useEffect(() => {
    if (!selectedId) return
    window.api.getSessionMessages(selectedId)
      .then(data => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]))
  }, [selectedId])

  const sessions = state.sessions.slice(0, 20)

  if (sessions.length === 0) {
    return <div className="panel-empty">暂无会话记录<br /><span className="panel-hint">请确认 Hermes Dashboard 已启动</span></div>
  }

  if (selectedId) {
    return (
      <div className="panel-list">
        <button className="back-btn" onClick={() => setSelectedId(null)}>返回列表</button>
        <div className="session-messages">
          {messages.map((m, i) => (
            <div key={i} className={`session-msg ${m.role || ''}`}>
              <span className="session-msg-role">{m.role === 'user' ? '你' : 'Hermes'}</span>
              <span className="session-msg-text">{m.content || '(空)'}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="panel-list">
      {sessions.map(s => (
        <div key={s.id} className="session-row" onClick={() => setSelectedId(s.id)}>
          <span className="session-title">{s.title || s.id}</span>
          <span className="session-date">{s.updated_at ? new Date(s.updated_at).toLocaleDateString('zh-CN') : ''}</span>
        </div>
      ))}
    </div>
  )
}
