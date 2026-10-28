export type SaveResult = 'shared' | 'downloaded' | 'cancelled' | 'needs-tap'

/** The Web Share API with files: available on iOS and Android, rarely on desktop. */
function canShareFile(file: File): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

function download(file: File): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  // The browser needs a moment to start reading the file before its address is released.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Hands the file to the user: the share sheet (to save it in Archivos or iCloud Drive) when there
 * is one, a plain download otherwise. Sharing must start from a tap; if the browser says the tap
 * is too old ('needs-tap'), calling this again from a new tap works.
 */
export async function saveFile(file: File): Promise<SaveResult> {
  if (!canShareFile(file)) {
    download(file)
    return 'downloaded'
  }
  try {
    await navigator.share({ files: [file], title: file.name })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    if (error instanceof DOMException && error.name === 'NotAllowedError') return 'needs-tap'
    download(file)
    return 'downloaded'
  }
}
