import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/db.ts'
import {
  DEFAULT_DEVICE_VALUES,
  DEFAULT_SHARED_VALUES,
  loadDeviceSettings,
  loadSharedSettings,
  saveDeviceSettings,
  saveSharedSettings,
} from '../../src/db/settings.ts'
import { DeviceSettingsSchema, SharedSettingsSchema } from '../../src/shared/index.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('defaults (spec §4)', () => {
  it('shared settings', async () => {
    expect(DEFAULT_SHARED_VALUES).toEqual({
      newPerDay: 10,
      desiredRetention: 0.9,
      productionEnabled: true,
      dayStartHour: 4,
      showSentenceOnFront: true,
    })
    expect(SharedSettingsSchema.safeParse(await loadSharedSettings()).success).toBe(true)
  })

  it('device settings', async () => {
    expect(DEFAULT_DEVICE_VALUES.autoPlayAudio).toBe(true)
    expect(DEFAULT_DEVICE_VALUES.voiceRate).toBe(0.95)
    expect(DeviceSettingsSchema.safeParse(await loadDeviceSettings()).success).toBe(true)
  })

  it('are not written until the user changes something', async () => {
    await loadSharedSettings()
    await loadDeviceSettings()
    expect(await db.sharedSettings.count()).toBe(0)
    expect(await db.deviceSettings.count()).toBe(0)
  })
})

describe('shared settings (synced)', () => {
  it('persist and are queued for upload', async () => {
    await saveSharedSettings({ newPerDay: 20 })

    expect((await loadSharedSettings()).newPerDay).toBe(20)
    expect(await db.outbox.toArray()).toMatchObject([{ table: 'sharedSettings', id: 'shared' }])
  })

  it('keep the other values when one changes', async () => {
    await saveSharedSettings({ newPerDay: 20 })
    await saveSharedSettings({ desiredRetention: 0.92 })

    expect(await loadSharedSettings()).toMatchObject({ newPerDay: 20, desiredRetention: 0.92, dayStartHour: 4 })
  })

  it('fill fields missing from an older stored record with defaults', async () => {
    await db.sharedSettings.put({ id: 'shared', updatedAt: 5, newPerDay: 3 } as never)
    expect(await loadSharedSettings()).toMatchObject({ newPerDay: 3, dayStartHour: 4, productionEnabled: true })
  })
})

describe('device settings (never synced)', () => {
  it('persist without touching the outbox', async () => {
    await saveDeviceSettings({ appSecret: 'secret', autoPlayAudio: false })

    expect(await loadDeviceSettings()).toMatchObject({ appSecret: 'secret', autoPlayAudio: false })
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('saves made at the same time', () => {
  it('device settings: none of the changes is lost', async () => {
    await Promise.all([
      saveDeviceSettings({ appSecret: 'right' }),
      saveDeviceSettings({ lastSyncAt: 5 }),
      saveDeviceSettings({ voiceRate: 1.1 }),
      saveDeviceSettings({ syncCursor: 9 }),
    ])
    expect(await loadDeviceSettings()).toMatchObject({ appSecret: 'right', lastSyncAt: 5, voiceRate: 1.1, syncCursor: 9 })
  })

  it('shared settings: none of the changes is lost, and each one is queued', async () => {
    await Promise.all([saveSharedSettings({ newPerDay: 3 }), saveSharedSettings({ dayStartHour: 5 }), saveSharedSettings({ productionEnabled: false })])
    expect(await loadSharedSettings()).toMatchObject({ newPerDay: 3, dayStartHour: 5, productionEnabled: false })
    expect(await db.outbox.toArray()).toHaveLength(1)
  })
})
