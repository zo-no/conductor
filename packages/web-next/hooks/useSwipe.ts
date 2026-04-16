import { useRef } from 'react'

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

export function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void, threshold = 50): SwipeHandlers {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (startX.current === null || startY.current === null) return

    const dx = e.changedTouches[0].clientX - startX.current
    const dy = e.changedTouches[0].clientY - startY.current

    // Only trigger if horizontal movement dominates
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return

    if (dx < 0) onSwipeLeft()
    else onSwipeRight()

    startX.current = null
    startY.current = null
  }

  return { onTouchStart, onTouchEnd }
}
