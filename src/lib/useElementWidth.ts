import { useCallback, useRef, useState } from 'react'

/**
 * The width of an element in pixels, kept up to date when it is resized; 0 until it has been measured.
 * Put `ref` on the element. Charts use it to draw at the real size instead of stretching a drawing.
 */
export function useElementWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState(0)
  const observer = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!node) return
    setWidth(Math.round(node.getBoundingClientRect().width))
    observer.current = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width))
    })
    observer.current.observe(node)
  }, [])

  return [ref, width] as const
}
