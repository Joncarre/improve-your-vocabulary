import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from './AppShell.tsx'

// One chunk per screen: the app shell loads first and each screen on demand.
const TodayPage = lazy(() => import('../features/today/TodayPage.tsx'))
const LibraryShell = lazy(() => import('../features/library/LibraryShell.tsx'))
const SourcePage = lazy(() => import('../features/library/SourcePage.tsx'))
const EntryPage = lazy(() => import('../features/entry/EntryPage.tsx'))
const PhoneticsPage = lazy(() => import('../features/phonetics/PhoneticsPage.tsx'))
const GamesPage = lazy(() => import('../features/games/GamesPage.tsx'))
const ProgressPage = lazy(() => import('../features/progress/ProgressPage.tsx'))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage.tsx'))

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TodayPage />} />
        {/* Vocabulario and the entry page share a layout: list + word side by side on desktop. */}
        <Route element={<LibraryShell />}>
          <Route path="vocabulary" element={null} />
          <Route path="entry/:id" element={<EntryPage />} />
        </Route>
        <Route path="source/:id" element={<SourcePage />} />
        <Route path="phonetics" element={<PhoneticsPage />} />
        <Route path="games" element={<GamesPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
