import { HardDrive, KeyRound, Smartphone } from 'lucide-react'
import { saveDeviceSettings, useDeviceSettings } from '../db/settings.ts'
import { Button } from '../ui/Button.tsx'

const POINTS = [
  {
    icon: Smartphone,
    text: 'Abre la app siempre desde el icono de la pantalla de inicio. En el iPhone, la app instalada guarda sus datos aparte de Safari.',
  },
  {
    icon: HardDrive,
    text: 'Tus palabras se guardan en este dispositivo y funcionan sin conexión.',
  },
  {
    icon: KeyRound,
    text: 'Cuando esté activa la sincronización, introduce el mismo secreto en Ajustes de cada dispositivo.',
  },
]

/** First-run welcome: explains the installed-app storage on iOS. Shown once. */
export function Onboarding() {
  const { settings, ready } = useDeviceSettings()
  if (!ready || settings.onboardingDone) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      // There is one button and it has the focus: Tab stays on it instead of wandering behind the welcome.
      onKeyDown={(event) => event.key === 'Tab' && event.preventDefault()}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] backdrop-blur-sm md:items-center"
    >
      <div className="w-full max-w-md rounded-sheet border border-border bg-surface p-5">
        <h2 id="onboarding-title" className="font-serif text-title font-medium">
          Bienvenido
        </h2>
        <ul className="mt-4 space-y-3">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-secondary text-text-2">
              <Icon size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <Button
          variant="primary"
          autoFocus
          className="mt-5 w-full"
          onClick={() => void saveDeviceSettings({ onboardingDone: true })}
        >
          Entendido
        </Button>
      </div>
    </div>
  )
}
