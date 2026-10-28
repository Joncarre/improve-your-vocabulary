import { Plus } from 'lucide-react'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageHeader } from '../../ui/PageHeader.tsx'

/** Placeholder for the "+" button: the real add sheet arrives in phase 2. */
export default function AddPage() {
  return (
    <>
      <PageHeader title="Añadir palabra" />
      <EmptyState icon={Plus} title="Muy pronto">
        Aquí podrás apuntar una palabra o expresión con la frase donde la encontraste.
      </EmptyState>
    </>
  )
}
