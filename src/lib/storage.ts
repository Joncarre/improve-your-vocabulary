export interface StorageStatus {
  /** The browser exposes the Storage API at all. */
  supported: boolean
  /** Whether the origin's data is protected from eviction (null when unknown). */
  persisted: boolean | null
  usage?: number
  quota?: number
}

function currentStorage(): StorageManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage
}

/** Ask the browser not to evict our data. Resolves to null when the API is unavailable. */
export async function requestPersistence(storage: StorageManager | undefined = currentStorage()): Promise<boolean | null> {
  if (!storage || typeof storage.persist !== 'function') return null
  try {
    if (await storage.persisted()) return true
    return await storage.persist()
  } catch {
    return false
  }
}

export async function readStorageStatus(storage: StorageManager | undefined = currentStorage()): Promise<StorageStatus> {
  if (!storage) return { supported: false, persisted: null }
  const status: StorageStatus = { supported: true, persisted: null }
  try {
    if (typeof storage.persisted === 'function') status.persisted = await storage.persisted()
    if (typeof storage.estimate === 'function') {
      const { usage, quota } = await storage.estimate()
      if (usage !== undefined) status.usage = usage
      if (quota !== undefined) status.quota = quota
    }
  } catch {
    // Reading the estimate is best effort.
  }
  return status
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}
