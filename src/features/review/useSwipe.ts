import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'

const START_DRAG_PX = 12
const SWIPE_PX = 90

export type SwipeSide = 'left' | 'right' | null

interface SwipeOptions {
  enabled: boolean
  onLeft: () => void
  onRight: () => void
}

/**
 * Swipe the card to answer: left = "Otra vez", right = "Bien" (spec §7). Touch and pen only, so
 * the mouse can still select text. Controls inside the card (buttons, fields) are left alone.
 */
export function useSwipe({ enabled, onLeft, onRight }: SwipeOptions) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; pointerId: number; active: boolean } | null>(null)

  const reset = () => {
    start.current = null
    setDragging(false)
    setDx(0)
  }

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!enabled || event.pointerType === 'mouse') return
      if ((event.target as HTMLElement).closest('input, textarea, button, a, select')) return
      start.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, active: false }
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const origin = start.current
      if (!origin) return
      const moveX = event.clientX - origin.x
      const moveY = event.clientY - origin.y
      if (!origin.active) {
        // A mostly vertical gesture is a scroll inside the card, not a swipe.
        if (Math.abs(moveY) > Math.abs(moveX) && Math.abs(moveY) > START_DRAG_PX) return reset()
        if (Math.abs(moveX) < START_DRAG_PX) return
        origin.active = true
        try {
          event.currentTarget.setPointerCapture(origin.pointerId)
        } catch {
          // The pointer is already gone: the drag still works with the events it gets.
        }
        setDragging(true)
      }
      setDx(moveX)
    },
    onPointerUp() {
      const distance = dx
      const wasActive = start.current?.active
      reset()
      if (!wasActive) return
      if (distance <= -SWIPE_PX) onLeft()
      else if (distance >= SWIPE_PX) onRight()
    },
    onPointerCancel: reset,
  }

  const side: SwipeSide = dx <= -SWIPE_PX / 2 ? 'left' : dx >= SWIPE_PX / 2 ? 'right' : null
  const style: CSSProperties = {
    transform: dx === 0 ? undefined : `translateX(${dx}px) rotate(${dx / 30}deg)`,
    transition: dragging ? 'none' : 'transform 200ms ease-out',
    touchAction: 'pan-y',
  }
  return { handlers, style, side }
}
