import { useState, useEffect, useRef, useCallback } from 'react'
import type { Expression } from '../context/AppContext'
import type { ModelInfo } from '../config/models'
import ModelPicker from './ModelPicker'

interface Props {
  expression: Expression
  onClick: () => void
  modelUrl?: string
  activeModelId?: string
  onSelectModel?: (model: ModelInfo) => void
}

export default function PetCharacter({ expression, onClick, modelUrl, activeModelId, onSelectModel }: Props) {
  const [Live2DComponent, setLive2DComponent] = useState<React.ComponentType<any> | null>(null)
  const [live2dAvailable, setLive2dAvailable] = useState(false)
  const [live2dFailed, setLive2dFailed] = useState(false)
  const [useLive2D, setUseLive2D] = useState(false)
  const petRef = useRef<HTMLDivElement>(null)
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 })
  const [bounce, setBounce] = useState(false)
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    import('./Live2DCharacter')
      .then((mod) => {
        setLive2DComponent(() => mod.default)
        setLive2dAvailable(true)
      })
      .catch(() => {
        setLive2dAvailable(false)
      })
  }, [])

  const shouldTryLive2D = !!(modelUrl && !live2dFailed)

  useEffect(() => {
    if (!modelUrl) setUseLive2D(false)
  }, [modelUrl])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setPickerPos({ x: e.clientX, y: e.clientY })
  }, [])

  const closePicker = useCallback(() => setPickerPos(null), [])

  // CSS mode: mouse tracking for eyes
  useEffect(() => {
    if (useLive2D || shouldTryLive2D) return

    const handleMouseMove = (e: MouseEvent) => {
      const pet = petRef.current
      if (!pet) return
      const rect = pet.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = Math.max(-3, Math.min(3, (e.clientX - cx) / 40))
      const dy = Math.max(-3, Math.min(3, (e.clientY - cy) / 40))
      setEyeOffset({ x: dx, y: dy })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [useLive2D, shouldTryLive2D])

  const handleCSSClick = useCallback(() => {
    setBounce(true)
    onClick()
    setTimeout(() => setBounce(false), 400)
  }, [onClick])

  useEffect(() => {
    if (useLive2D || shouldTryLive2D) return
    const interval = setInterval(() => {
      setBounce(true)
      setTimeout(() => setBounce(false), 400)
    }, 12000 + Math.random() * 8000)
    return () => clearInterval(interval)
  }, [useLive2D, shouldTryLive2D])

  if (shouldTryLive2D && live2dAvailable && Live2DComponent) {
    return (
      <>
        <div
          className={`pet pet-live2d ${expression}`}
          onContextMenu={handleContextMenu}
        >
          <Live2DComponent
            expression={expression}
            modelUrl={modelUrl}
            onModelLoaded={() => setUseLive2D(true)}
            onError={() => {
              setLive2dFailed(true)
              setUseLive2D(false)
            }}
            onClick={(area: string) => {
              if (area === 'Head' || area === 'head') {
                console.log('Pet head patted!')
              }
              onClick()
            }}
          />
        </div>
        {pickerPos && activeModelId && onSelectModel && (
          <ModelPicker
            activeModelId={activeModelId}
            onSelect={onSelectModel}
            anchorX={pickerPos.x}
            anchorY={pickerPos.y}
            onClose={closePicker}
          />
        )}
      </>
    )
  }

  const eyeStyle = {
    transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`
  }

  const mouthClass =
    expression === 'happy' ? 'pet-mouth happy' :
    expression === 'talking' ? 'pet-mouth talking' :
    expression === 'sad' ? 'pet-mouth sad' :
    'pet-mouth'

  return (
    <>
      <div
        ref={petRef}
        className={`pet ${expression}${bounce ? ' bounce' : ''}`}
        onClick={handleCSSClick}
        onContextMenu={handleContextMenu}
      >
        <div className="pet-body">
          <div className="pet-ear left" />
          <div className="pet-ear right" />
          <div className="pet-eyes">
            <div className="pet-eye" style={eyeStyle} />
            <div className="pet-eye" style={eyeStyle} />
          </div>
          <div className={mouthClass} />
        </div>
        <div className="zzz">Z z z</div>
      </div>
      {pickerPos && activeModelId && onSelectModel && (
        <ModelPicker
          activeModelId={activeModelId}
          onSelect={onSelectModel}
          anchorX={pickerPos.x}
          anchorY={pickerPos.y}
          onClose={closePicker}
        />
      )}
    </>
  )
}
