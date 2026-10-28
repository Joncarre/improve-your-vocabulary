import { useLiveQuery } from 'dexie-react-hooks'
import type { DeviceSettings, SharedSettings } from '../shared/index.ts'
import { db } from './db.ts'
import { writeRecord } from './repo.ts'

type SharedValues = Omit<SharedSettings, 'id' | 'updatedAt' | 'deletedAt'>
type DeviceValues = Omit<DeviceSettings, 'id'>

/** Defaults from the spec (§4). Nothing is written until the user changes a setting. */
export const DEFAULT_SHARED_VALUES: SharedValues = {
  newPerDay: 10,
  desiredRetention: 0.9,
  productionEnabled: true,
  dayStartHour: 4,
  showSentenceOnFront: true,
}

export const DEFAULT_DEVICE_VALUES: DeviceValues = {
  autoPlayAudio: true,
  voiceRate: 0.95,
  appSecret: '',
  syncCursor: 0,
  onboardingDone: false,
  installGuideDismissed: false,
}

function withSharedDefaults(stored: SharedSettings | null | undefined): SharedSettings {
  return { id: 'shared', updatedAt: 0, ...DEFAULT_SHARED_VALUES, ...stored }
}

function withDeviceDefaults(stored: DeviceSettings | null | undefined): DeviceSettings {
  return { id: 'device', ...DEFAULT_DEVICE_VALUES, ...stored }
}

export async function loadSharedSettings(): Promise<SharedSettings> {
  return withSharedDefaults(await db.sharedSettings.get('shared'))
}

/** Shared settings are synced, so saving them goes through the outbox. */
export async function saveSharedSettings(patch: Partial<SharedValues>): Promise<SharedSettings> {
  const current = await loadSharedSettings()
  return writeRecord('sharedSettings', { ...current, ...patch })
}

export async function loadDeviceSettings(): Promise<DeviceSettings> {
  return withDeviceDefaults(await db.deviceSettings.get('device'))
}

/** Device settings never leave this device: no outbox. */
export async function saveDeviceSettings(patch: Partial<DeviceValues>): Promise<DeviceSettings> {
  const next = { ...(await loadDeviceSettings()), ...patch }
  await db.deviceSettings.put(next)
  return next
}

export interface SettingsState<T> {
  settings: T
  /** False until the first read finishes, so the UI does not flash default values. */
  ready: boolean
}

export function useSharedSettings(): SettingsState<SharedSettings> {
  // null = read finished and nothing stored; undefined = still reading.
  const stored = useLiveQuery(async () => (await db.sharedSettings.get('shared')) ?? null)
  return { settings: withSharedDefaults(stored), ready: stored !== undefined }
}

export function useDeviceSettings(): SettingsState<DeviceSettings> {
  const stored = useLiveQuery(async () => (await db.deviceSettings.get('device')) ?? null)
  return { settings: withDeviceDefaults(stored), ready: stored !== undefined }
}
