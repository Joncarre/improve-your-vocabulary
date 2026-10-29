import { useEffect, useState, type RefObject } from 'react'

/**
 * Where the focus goes back to when each open dialog closes, by the panel of the dialog. A dialog can be
 * replaced by another one at once (the frame that shows while the real sheet loads), and the second then
 * finds the focus inside the first: when its own place is gone it follows the chain to where the first came from.
 */
const returnTargets = new WeakMap<Element, HTMLElement | null>()

/**
 * What a modal dialog owes to people who use a keyboard or a screen reader. While it is open everything else
 * on the page is `inert` (Tab cannot leave the dialog, VoiceOver cannot read what is behind it and taps cannot
 * reach it); focus moves into the dialog, to the panel itself unless a control inside asked for it with
 * `autoFocus`; and when it closes, focus goes back to where it was. Dialogs on top of each other each silence
 * the one below, and give it back in reverse order.
 */
export function useModalFocus(overlay: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>): void {
  // Taken while rendering for the first time: by the time the effects run, a field inside the dialog with `autoFocus`
  // already has the focus, and that is not the place to go back to.
  const [previous] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null))

  useEffect(() => {
    const own = overlay.current
    const box = panel.current
    if (!own || !box) return
    returnTargets.set(box, previous)

    const silenced = [...document.body.children].filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child !== own && !child.inert && child.tagName !== 'SCRIPT',
    )
    for (const element of silenced) element.inert = true
    if (!box.contains(document.activeElement)) box.focus({ preventScroll: true })

    return () => {
      for (const element of silenced) element.inert = false
      let target = previous
      while (target && !target.isConnected) target = returnTargets.get(target) ?? null
      target?.focus({ preventScroll: true })
    }
  }, [overlay, panel, previous])
}
