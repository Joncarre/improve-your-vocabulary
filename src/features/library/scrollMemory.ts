/** Where the list was scrolled to when a word was opened, so "back" lands in the same place on a phone. */
let savedListScroll = 0

export function rememberListScroll(): void {
  savedListScroll = window.scrollY
}

export function getSavedListScroll(): number {
  return savedListScroll
}
