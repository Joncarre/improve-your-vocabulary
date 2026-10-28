import { ChartNoAxesColumn } from 'lucide-react'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageHeader } from '../../ui/PageHeader.tsx'

export default function ProgressPage() {
  return (
    <>
      <PageHeader title="Progreso" />
      <EmptyState icon={ChartNoAxesColumn} title="Todavía no hay datos">
        Tus repasos, tu racha y las palabras que más fallas se mostrarán aquí.
      </EmptyState>
    </>
  )
}
