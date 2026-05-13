import { useEffect, useRef, useState, useCallback } from 'react'
import { Live2DAdapter } from '../live2d/api/Live2DAdapter'

interface Props {
  expression: string
  modelUrl?: string
  onModelLoaded?: () => void
  onError?: (err: Error) => void
  onClick?: () => void
}

/**
 * Live2DCharacter — renders a Live2D Cubism model in a canvas element.
 * Falls back gracefully if WebGL or core is unavailable.
 */
export default function Live2DCharacter({
  expression,
  modelUrl,
  onModelLoaded,
  onError,
  onClick
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const adapterRef = useRef<Live2DAdapter | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Initialize adapter
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !modelUrl) return

    const adapter = new Live2DAdapter(canvas)
    adapterRef.current = adapter

    adapter
      .loadModel(modelUrl)
      .then(() => {
        setLoaded(true)
        onModelLoaded?.()
      })
      .catch((err: Error) => {
        console.error('Live2D load failed:', err)
        onError?.(err)
      })

    return () => {
      adapter.dispose()
      adapterRef.current = null
    }
  }, [modelUrl])

  // Update expression
  useEffect(() => {
    if (adapterRef.current && loaded) {
      adapterRef.current.setExpression(expression)
    }
  }, [expression, loaded])

  // Mouse tracking for look-at
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!adapterRef.current || !loaded) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    adapterRef.current.setDragging(x, y)
  }, [loaded])

  return (
    <canvas
      ref={canvasRef}
      className="live2d-canvas"
      width={400}
      height={600}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: 'pointer'
      }}
    />
  )
}
