import { useState, useEffect, useRef } from 'react'
import { MODELS, type ModelInfo } from '../config/models'

interface Props {
  activeModelId: string
  onSelect: (model: ModelInfo) => void
  anchorX: number
  anchorY: number
  onClose: () => void
}

export default function ModelPicker({ activeModelId, onSelect, anchorX, anchorY, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="model-picker"
      style={{ left: anchorX, top: anchorY }}
    >
      {MODELS.map(model => (
        <div
          key={model.id}
          className={`model-picker-item${model.id === activeModelId ? ' active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(model)
            onClose()
          }}
        >
          <span className="model-emoji">{model.emoji}</span>
          <span className="model-name">{model.name}</span>
          {model.id === activeModelId && <span className="model-check">✓</span>}
        </div>
      ))}
    </div>
  )
}
