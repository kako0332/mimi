import { useState, useEffect } from 'react'
import type { Expression } from '../context/AppContext'
import Live2DCharacter from './Live2DCharacter'

interface Props {
  expression: Expression
  onClick: () => void
  modelUrl?: string
}

/**
 * PetCharacter — dual-mode pet renderer.
 * If a Live2D modelUrl is provided and Live2D loads successfully, renders a Live2D model.
 * Otherwise falls back to the CSS pet.
 */
export default function PetCharacter({ expression, onClick, modelUrl }: Props) {
  const [useLive2D, setUseLive2D] = useState(false)
  const [live2dFailed, setLive2dFailed] = useState(false)

  // Attempt Live2D if a model URL is configured
  const shouldTryLive2D = !!(modelUrl && !live2dFailed)

  useEffect(() => {
    if (!modelUrl) {
      setUseLive2D(false)
    }
  }, [modelUrl])

  if (shouldTryLive2D && (useLive2D || !live2dFailed)) {
    return (
      <div className={`pet pet-live2d ${expression}`} onClick={onClick}>
        <Live2DCharacter
          expression={expression}
          modelUrl={modelUrl}
          onModelLoaded={() => setUseLive2D(true)}
          onError={() => {
            setLive2dFailed(true)
            setUseLive2D(false)
          }}
        />
      </div>
    )
  }

  // CSS Fallback pet
  return (
    <div className={`pet ${expression}`} onClick={onClick}>
      <div className="pet-body">
        <div className="pet-ear left" />
        <div className="pet-ear right" />
        <div className="pet-eyes">
          <div className="pet-eye" />
          <div className="pet-eye" />
        </div>
        <div className="pet-mouth" />
      </div>
      <div className="zzz">Z z z</div>
    </div>
  )
}
