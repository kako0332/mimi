import { useEffect, useRef, useState } from 'react'
import type { Message, ToolCall } from '../context/AppContext'

interface Props {
  messages: Message[]
  streaming: boolean
}

function ToolCallCard({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false)

  const statusIcon = tc.status === 'running' ? '...'
    : tc.status === 'done' ? '✓'
    : '✗'

  const statusClass = `tool-status ${tc.status}`

  return (
    <div className="tool-call" onClick={() => setExpanded(!expanded)}>
      <div className="tool-header">
        <span className={statusClass}>{statusIcon}</span>
        <span className="tool-name">{tc.name}</span>
      </div>
      {expanded && (
        <div className="tool-detail">
          {tc.args && (
            <div className="tool-section">
              <span className="tool-label">参数</span>
              <pre className="tool-code">{tc.args}</pre>
            </div>
          )}
          {tc.result && (
            <div className="tool-section">
              <span className="tool-label">结果</span>
              <pre className="tool-code">{tc.result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ChatBubble({ messages, streaming }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="chat-bubble">
      {messages.map((msg, i) => (
        <div key={i} className={`msg ${msg.role}`}>
          {msg.content}
          {streaming && msg.role === 'assistant' && i === messages.length - 1 && (
            <span className="cursor">|</span>
          )}
          {msg.toolCalls && msg.toolCalls.length > 0 && (
            <div className="tool-calls">
              {msg.toolCalls.map(tc => (
                <ToolCallCard key={tc.id} tc={tc} />
              ))}
            </div>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
