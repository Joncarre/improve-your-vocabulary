import { Settings, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { InstallGuide } from '../../app/InstallGuide.tsx'
import { saveDeviceSettings, useDeviceSettings } from '../../db/settings.ts'
import { useInstallState } from '../../lib/install.ts'
import { buttonClass, ICON_BUTTON_CLASS } from '../../ui/classes.ts'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageHeader } from '../../ui/PageHeader.tsx'

export default function TodayPage() {
  const install = useInstallState()
  const { settings, ready } = useDeviceSettings()
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
          title="Todavía no hay palabras"
          action={
            <Link to="/add" className={buttonClass('primary')}>
              Añadir la primera
            </Link>
          }
        >
          Cuando añadas palabras, aquí verás cuántas hay por repasar hoy y cuántas son nuevas.
        </EmptyState>
      </div>
    </>
  )
}
