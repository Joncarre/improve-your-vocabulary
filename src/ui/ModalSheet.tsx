import { X } from 'lucide-react'
import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useVisualViewport } from '../lib/useVisualViewport.ts'
import { IconButton } from './Button.tsx'

interface ModalSheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Always visible below the scrolling content (the main action). */
  footer?: ReactNode
}

/**
 * Bottom sheet on phones and centred dialog on desktop. It is pinned to the visual viewport, so
 * the on-screen keyboard never covers its fields or its action button.
 */
export function ModalSheet({ title, onClose, children, footer }: ModalSheetProps) {
  const titleId = useId()
  const { top, height, keyboardOpen } = useVisualViewport()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-x-0 z-50 flex items-end justify-center lg:items-center" style={{ top, height }}>
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-lg flex-col rounded-t-sheet border border-b-0 border-border bg-surface lg:rounded-sheet lg:border-b"
        style={{ maxHeight: height - 8 }}
      >
        <div className="flex items-center justify-between pl-4 pr-1 pt-1">
          <h2 id={titleId} className="text-section font-semibold">
            {title}
          </h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer ? (
          <div
            className="border-t border-border px-4 pt-3"
            style={{ paddingBottom: keyboardOpen ? 12 : 'calc(env(safe-area-inset-bottom) + 12px)' }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
