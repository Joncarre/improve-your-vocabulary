import { Button } from './Button.tsx'
import { ModalSheet } from './ModalSheet.tsx'

interface ConfirmSheetProps {
  title: string
  message: string
  confirmLabel: string
  /** Style the confirm button as destructive. */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Asks before doing something that cannot be undone. */
export function ConfirmSheet({ title, message, confirmLabel, danger = false, onConfirm, onCancel }: ConfirmSheetProps) {
  return (
    <ModalSheet title={title} onClose={onCancel}>
      <p className="pt-2 text-secondary text-text-2">{message}</p>
      <div className="mt-4 flex flex-col gap-2">
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button autoFocus onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </ModalSheet>
  )
}
