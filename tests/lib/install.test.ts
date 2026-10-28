import { describe, expect, it } from 'vitest'
import { detectInstallState, type InstallEnv } from '../../src/lib/install.ts'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

function env(overrides: Partial<InstallEnv>): InstallEnv {
  return {
    userAgent: DESKTOP_CHROME,
    platform: 'Win32',
    maxTouchPoints: 0,
    displayModeStandalone: false,
    navigatorStandalone: false,
    ...overrides,
  }
}

describe('detectInstallState', () => {
  it('shows the guide on an iPhone inside a Safari tab', () => {
    const state = detectInstallState(env({ userAgent: IPHONE_SAFARI, platform: 'iPhone', maxTouchPoints: 5 }))
    expect(state).toEqual({ isIOS: true, isStandalone: false, showIOSGuide: true })
  })

  it('does not show it once launched from the home-screen icon (navigator.standalone)', () => {
    const state = detectInstallState(
      env({ userAgent: IPHONE_SAFARI, platform: 'iPhone', maxTouchPoints: 5, navigatorStandalone: true }),
    )
    expect(state).toEqual({ isIOS: true, isStandalone: true, showIOSGuide: false })
  })

  it('recognises standalone through display-mode too', () => {
    expect(detectInstallState(env({ displayModeStandalone: true })).isStandalone).toBe(true)
  })

  it('treats an iPad that reports itself as a Mac as iOS', () => {
    const state = detectInstallState(env({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 5 }))
    expect(state.isIOS).toBe(true)
    expect(state.showIOSGuide).toBe(true)
  })

  it('never shows the iOS guide on a desktop browser', () => {
    expect(detectInstallState(env({}))).toEqual({ isIOS: false, isStandalone: false, showIOSGuide: false })
    // A real Mac has no touch screen.
    expect(detectInstallState(env({ userAgent: IPAD_AS_MAC, platform: 'MacIntel' })).isIOS).toBe(false)
  })
})
