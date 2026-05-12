import { useEffect, useRef } from 'react'
import type { Message } from '../context/AppContext'

interface Props {
  messages: Message[]
  streaming: boolean
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
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
