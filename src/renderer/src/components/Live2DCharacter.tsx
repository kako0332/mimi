import { useEffect, useRef, useState, useCallback } from 'react'
import { Live2DAdapter } from '../live2d/api/Live2DAdapter'

const DRAG_THRESHOLD = 5

interface Props {
  expression: string
  modelUrl?: string
  onModelLoaded?: () => void
  onError?: (err: Error) => void
  onClick?: (area?: string) => void
}

export default function Live2DCharacter({
  expression,
  modelUrl,
  onModelLoaded,
  onError,
  onClick
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const adapterRef = useRef<Live2DAdapter | null>(null)
  const dragState = useRef<{ startX: number; startY: number; lastX: number; lastY: number; dragging: boolean } | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Initialize adapter
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !modelUrl) return

    const abortController = new AbortController()
    let mounted = true

    const adapter = new Live2DAdapter(canvas)
    adapterRef.current = adapter

    adapter
      .loadModel(modelUrl, abortController.signal)
      .then(() => {
        if (!mounted) return
        setLoaded(true)
        onModelLoaded?.()
        adapter.startMotion('Idle', 0, 3)
      })
      .catch((err: Error) => {
        if (!mounted) return
        if (err.name === 'AbortError') return
        console.error('Live2D load failed:', err)
        onError?.(err)
      })

    return () => {
      mounted = false
      abortController.abort()
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

  // Random idle motion timer
  useEffect(() => {
    if (!loaded) return
    const interval = setInterval(() => {
      adapterRef.current?.startMotion('Idle', Math.floor(Math.random() * 3), 1)
    }, 8000 + Math.random() * 7000)
    return () => clearInterval(interval)
  }, [loaded])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragState.current = {
      startX: e.screenX,
      startY: e.screenY,
      lastX: e.screenX,
      lastY: e.screenY,
      dragging: false
    }
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const ds = dragState.current
    if (!ds) {
      // Not holding — look-at
      if (adapterRef.current && loaded) {
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
        adapterRef.current.setDragging(
          Math.max(-1, Math.min(1, x)),
          Math.max(-1, Math.min(1, y))
        )
      }
      return
    }

    const dx = e.screenX - ds.startX
    const dy = e.screenY - ds.startY

    if (!ds.dragging && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
      ds.dragging = true
    }

    if (ds.dragging) {
      const moveX = e.screenX - ds.lastX
      const moveY = e.screenY - ds.lastY
      ds.lastX = e.screenX
      ds.lastY = e.screenY
      window.api?.moveWindowBy(moveX, moveY)
    }
  }, [loaded])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId)
    const ds = dragState.current
    dragState.current = null

    if (!ds || ds.dragging) return

    // Click — do hit test
    if (!adapterRef.current || !loaded) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)

    const hitAreas = adapterRef.current.hitTest(x, y)
    if (hitAreas.length > 0) {
      adapterRef.current.startMotion('TapBody', 0, 3)
      onClick?.(hitAreas[0])
    } else {
      onClick?.()
    }
  }, [loaded, onClick])

  // Reset look-at when mouse leaves
  const handlePointerLeave = useCallback(() => {
    if (dragState.current) return // don't reset during drag
    if (!adapterRef.current || !loaded) return
    adapterRef.current.setDragging(0, 0)
  }, [loaded])

  return (
    <canvas
      ref={canvasRef}
      className="live2d-canvas"
      width={560}
      height={800}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: 'pointer',
        background: 'transparent',
        touchAction: 'none'
      }}
    />
  )
}
