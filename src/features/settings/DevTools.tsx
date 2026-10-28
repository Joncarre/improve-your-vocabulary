import { useState } from 'react'
import { clearDevData, seedDevData } from '../../dev/devData.ts'
import { Button } from '../../ui/Button.tsx'
import { SettingRow, SettingsSection } from '../../ui/controls.tsx'

/** Development only (never part of the production build): a big test collection to look at the app with. */
export default function DevTools() {
  const [message, setMessage] = useState('')

  const run = async (work: () => Promise<string>) => {
    setMessage('Trabajando…')
    setMessage(await work())
  }

  return (
    <SettingsSection title="Desarrollo" note="Solo existe en desarrollo. Los datos de prueba no se sincronizan y se pueden borrar sin tocar tus palabras.">
      <SettingRow label="Palabras de prueba" description={message || 'Hasta 1.000 phrasal verbs en todos los estados'}>
        <Button onClick={() => void run(async () => `${await seedDevData(1000)} palabras creadas`)}>Crear 1.000</Button>
      </SettingRow>
      <SettingRow label="Borrar las de prueba">
        <Button
          variant="danger"
          onClick={() =>
            void run(async () => {
              await clearDevData()
              return 'Datos de prueba borrados'
            })
          }
        >
          Borrar
        </Button>
      </SettingRow>
    </SettingsSection>
  )
}
