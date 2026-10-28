import { BookOpen } from 'lucide-react'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageHeader } from '../../ui/PageHeader.tsx'

export default function LibraryPage() {
  return (
    <>
      <PageHeader title="Vocabulario" />
      <EmptyState icon={BookOpen} title="Tu vocabulario aparecerá aquí">
        Podrás buscar tus palabras, filtrarlas por tema, serie o tipo, y ver su ficha completa.
      </EmptyState>
    </>
  )
}
