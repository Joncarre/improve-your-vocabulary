import { useState } from 'react'

export interface InstallEnv {
  userAgent: string
  platform: string
  maxTouchPoints: number
  /** `matchMedia('(display-mode: standalone)')` */
  displayModeStandalone: boolean
  /** `navigator.standalone` (iOS Safari only) */
  navigatorStandalone: boolean
}

export interface InstallState {
  isIOS: boolean
  /** Running from the home-screen icon (or an installed desktop PWA). */
  isStandalone: boolean
  /** On iOS and still inside a Safari tab: show the "add to home screen" guide. */
  showIOSGuide: boolean
}

export function detectInstallState(env: InstallEnv): InstallState {
  // iPadOS 13+ reports itself as a Mac, so touch support is the tell.
  const isIOS =
    /iPad|iPhone|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1)
  const isStandalone = env.displayModeStandalone || env.navigatorStandalone
  return { isIOS, isStandalone, showIOSGuide: isIOS && !isStandalone }
}

export function readInstallEnv(): InstallEnv {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
  }
}

export function useInstallState(): InstallState {
  const [state] = useState(() => detectInstallState(readInstallEnv()))
  return state
}
