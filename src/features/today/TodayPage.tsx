import { Settings, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { InstallGuide } from '../../app/InstallGuide.tsx'
import { saveDeviceSettings, useDeviceSettings } from '../../db/settings.ts'
import { useInstallState } from '../../lib/install.ts'
import { Button } from '../../ui/Button.tsx'
import { ICON_BUTTON_CLASS } from '../../ui/classes.ts'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageHeader } from '../../ui/PageHeader.tsx'
import { useAddSheet } from '../add/addSheetContext.ts'

export default function TodayPage() {
  const install = useInstallState()
  const { settings, ready } = useDeviceSettings()
  const { openAdd } = useAddSheet()
  const showGuide = install.showIOSGuide && ready && !settings.installGuideDismissed

  return (
    <>
      <PageHeader
        title="Hoy"
        actions={
          <Link to="/settings" aria-label="Ajustes" className={ICON_BUTTON_CLASS}>
            <Settings size={20} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        }
      />
      <div className="space-y-4">
        {showGuide ? (
          <InstallGuide onDismiss={() => void saveDeviceSettings({ installGuideDismissed: true })} />
        ) : null}
        <EmptyState
          icon={Sparkles}
          title="Todavía no hay repasos"
          action={
            <Button variant="primary" onClick={() => openAdd()}>
              Añadir una palabra
            </Button>
          }
        >
          Cuando tengas palabras para repasar, aquí verás cuántas hay hoy y cuántas son nuevas.
        </EmptyState>
      </div>
    </>
  )
}
