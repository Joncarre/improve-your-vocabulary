import { useLayoutEffect, useRef } from 'react'

/** The smallest text of a tile (spec §12). */
export const MIN_TILE_FONT = 11

/**
 * Makes a text fit its box. Put `box` on the tile and `text` on the element that holds the text: the
 * text starts at `max` px and shrinks a pixel at a time, before the screen is painted, until it neither
 * runs past the width nor past the height. A word is only broken in the middle when it does not fit
 * even at the smallest size. It fits again when the box changes size.
 */
export function useFitText<Box extends HTMLElement, Text extends HTMLElement>(content: string, max: number) {
  const box = useRef<Box | null>(null)
  const text = useRef<Text | null>(null)

  useLayoutEffect(() => {
    const outer = box.current
    const inner = text.current
    if (!outer || !inner) return

    const fit = () => {
      const style = getComputedStyle(outer)
      const height = outer.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      const overflows = () => inner.scrollWidth > inner.clientWidth + 0.5 || inner.offsetHeight > height + 0.5
      inner.style.overflowWrap = 'normal'
      inner.style.display = ''
      inner.style.webkitLineClamp = ''
      let size = max
      inner.style.fontSize = `${size}px`
      while (size > MIN_TILE_FONT && overflows()) {
        size -= 1
        inner.style.fontSize = `${size}px`
      }
      if (overflows()) inner.style.overflowWrap = 'anywhere'
      if (overflows()) {
        // Still too long at the smallest size: cut it with an ellipsis rather than let it run out of the tile.
        const lineHeight = parseFloat(getComputedStyle(inner).lineHeight) || size * 1.25
        inner.style.display = '-webkit-box'
        inner.style.webkitLineClamp = String(Math.max(1, Math.floor(height / lineHeight)))
      }
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(outer)
    return () => observer.disconnect()
  }, [content, max])

  return { box, text }
}
