import { Gamepad2 } from 'lucide-react'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageHeader } from '../../ui/PageHeader.tsx'

export default function GamesPage() {
  return (
    <>
      <PageHeader title="Juegos" />
      <EmptyState icon={Gamepad2} title="Juega con tus palabras">
        Los juegos se desbloquean cuando tengas suficientes palabras ya vistas en el repaso.
      </EmptyState>
    </>
  )
}
