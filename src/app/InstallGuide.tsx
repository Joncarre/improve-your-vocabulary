import { Share, SquarePlus, Smartphone, ToggleRight } from 'lucide-react'
import { Button } from '../ui/Button.tsx'
import { Card } from '../ui/Card.tsx'

const STEPS = [
  { icon: Share, text: 'Pulsa el botón Compartir de Safari.' },
  { icon: SquarePlus, text: 'Elige «Añadir a pantalla de inicio».' },
  { icon: ToggleRight, text: 'Deja activado «Abrir como app web» y pulsa Añadir.' },
  { icon: Smartphone, text: 'Abre la app desde su icono nuevo y úsala siempre desde ahí.' },
]

/** Shown on iOS while the app is still open in a Safari tab. */
export function InstallGuide({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <Card className="p-3">
      <h2 className="text-section font-semibold">Instala la app en tu iPhone</h2>
      <ol className="mt-3 space-y-2.5">
        {STEPS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-secondary text-text-2">
            <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-caption text-text-3">
        En iOS, la app instalada guarda sus datos aparte de Safari: lo que añadas en una pestaña no aparecerá en el icono.
      </p>
      {onDismiss ? (
        <Button variant="ghost" className="mt-2 -ml-4" onClick={onDismiss}>
          Ya la tengo instalada
        </Button>
      ) : null}
    </Card>
  )
}
