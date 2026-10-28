export interface ToastMessage {
  id: number
  message: string
}

let current: ToastMessage | null = null
let counter = 0
const listeners = new Set<() => void>()

function emit(next: ToastMessage | null) {
  current = next
  for (const listener of listeners) listener()
}

/** Shows a short message above the navigation for a few seconds. */
export function showToast(message: string, durationMs = 3500) {
  counter += 1
  const id = counter
  emit({ id, message })
  setTimeout(() => {
    if (current?.id === id) emit(null)
  }, durationMs)
}

export function subscribeToToasts(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function currentToast(): ToastMessage | null {
  return current
}
