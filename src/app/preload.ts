/*
 * Every screen is its own chunk, loaded when its route first renders. For the screen that is opening, the
 * download can start as soon as the app starts instead of after its first render, which saves a good part of
 * a slow connection's round trip. `import()` of the same module is the same download as the `lazy()` of the
 * router, so nothing is fetched twice.
 */
const ROUTES: ReadonlyArray<readonly [RegExp, () => Promise<unknown>]> = [
  [/^\/$/, () => import('../features/today/TodayPage.tsx')],
  [/^\/(vocabulary|entry\/)/, () => import('../features/library/LibraryShell.tsx')],
  [/^\/review/, () => import('../features/review/ReviewPage.tsx')],
  [/^\/games\/[^/]+/, () => import('../features/games/GamePage.tsx')],
  [/^\/games/, () => import('../features/games/GamesPage.tsx')],
  [/^\/progress/, () => import('../features/progress/ProgressPage.tsx')],
  [/^\/settings/, () => import('../features/settings/SettingsPage.tsx')],
]

export function preloadRoute(pathname: string): void {
  const match = ROUTES.find(([pattern]) => pattern.test(pathname))
  // A failed download is not an error here: the router asks for the screen again when it renders it.
  if (match) void match[1]().catch(() => undefined)
}
