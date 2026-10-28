import { useEffect, useState } from 'react'

export interface ViewportBox {
  /** Distance from the top of the layout viewport to the top of what is actually visible. */
  top: number
  /** Height of what is actually visible: it shrinks while the on-screen keyboard is open. */
  height: number
  keyboardOpen: boolean
}

function read(): ViewportBox {
  const viewport = window.visualViewport
  const height = viewport?.height ?? window.innerHeight
  const top = viewport?.offsetTop ?? 0
  return {
    top: Math.round(top),
    height: Math.round(height),
    // A keyboard takes well over 100 px; browser bars changing size do not.
    keyboardOpen: window.innerHeight - height - top > 100,
  }
}

/**
 * Tracks the visual viewport. On iOS the layout viewport does not shrink when the keyboard opens,
 * so a modal pinned to it ends up under the keyboard: pin it to this box instead.
 */
export function useVisualViewport(): ViewportBox {
  const [box, setBox] = useState(read)

  useEffect(() => {
    const viewport = window.visualViewport
    const update = () => setBox(read())
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    update()
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return box
}
