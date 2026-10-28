/** True when the key press came from a field where the user is typing. */
export function isTyping(event: KeyboardEvent): boolean {
  return Boolean((event.target as HTMLElement).closest('input, textarea, select'))
}

/** Whether the device has a mouse or trackpad (then fields take focus by themselves; on a phone that would open the keyboard). */
export function hasFinePointer(): boolean {
  return window.matchMedia?.('(pointer: fine)').matches ?? false
}

/** Milliseconds from a clock that only goes forward, for timing answers. */
export function clock(): number {
  return performance.now()
}
