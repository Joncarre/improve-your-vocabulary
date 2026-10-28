import { Eye, EyeOff } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { InstallGuide } from '../../app/InstallGuide.tsx'
import {
  saveDeviceSettings,
  saveSharedSettings,
  useDeviceSettings,
  useSharedSettings,
} from '../../db/settings.ts'
import { useInstallState } from '../../lib/install.ts'
import { formatBytes, readStorageStatus, type StorageStatus } from '../../lib/storage.ts'
import { IconButton } from '../../ui/Button.tsx'
import { Chip } from '../../ui/Chip.tsx'
import { RangeField, SelectField, SettingRow, SettingsSection, Stepper, Switch } from '../../ui/controls.tsx'
import { PageHeader } from '../../ui/PageHeader.tsx'
import { VoiceSettings } from './VoiceSettings.tsx'

// Test data tools: removed from the production build together with this branch.
const DevTools = import.meta.env.DEV ? lazy(() => import('./DevTools.tsx')) : null

const HOUR_OPTIONS = Array.from({ length: 9 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, '0')}:00`,
}))

const percent = (value: number) => `${Math.round(value * 100)} %`
const speed = (value: number) => `${value.toFixed(2).replace('.', ',')}×`

function storageSummary(status: StorageStatus | null): string {
  if (!status) return 'Comprobando…'
  if (!status.supported) return 'No disponible'
  if (status.persisted === null) return 'Desconocido'
  return status.persisted ? 'Concedido' : 'No concedido'
}

export default function SettingsPage() {
  const { settings: shared } = useSharedSettings()
  const { settings: device } = useDeviceSettings()
  const install = useInstallState()
  const [secretDraft, setSecretDraft] = useState<string | null>(null)
  const [secretVisible, setSecretVisible] = useState(false)
  const [storage, setStorage] = useState<StorageStatus | null>(null)

  useEffect(() => {
    void readStorageStatus().then(setStorage)
  }, [])

  const secret = secretDraft ?? device.appSecret

  return (
    <>
      <PageHeader title="Ajustes" />

      <SettingsSection title="Estudio">
        <SettingRow label="Palabras nuevas por día">
          <Stepper
            label="Palabras nuevas por día"
            value={shared.newPerDay}
            min={0}
            max={50}
            onChange={(newPerDay) => void saveSharedSettings({ newPerDay })}
          />
        </SettingRow>
        <SettingRow label="Retención objetivo" description="Más alta = más repasos">
          <RangeField
            label="Retención objetivo"
            value={shared.desiredRetention}
            min={0.85}
            max={0.95}
            step={0.01}
            format={percent}
            onChange={(desiredRetention) => void saveSharedSettings({ desiredRetention })}
          />
        </SettingRow>
        <SettingRow label="Tarjetas de producción" description="Del español al inglés">
          <Switch
            label="Tarjetas de producción"
            checked={shared.productionEnabled}
            onChange={(productionEnabled) => void saveSharedSettings({ productionEnabled })}
          />
        </SettingRow>
        <SettingRow label="El día empieza a las">
          <SelectField
            label="El día empieza a las"
            value={String(shared.dayStartHour)}
            options={HOUR_OPTIONS}
            onChange={(hour) => void saveSharedSettings({ dayStartHour: Number(hour) })}
          />
        </SettingRow>
        <SettingRow label="Mostrar mi frase en el anverso">
          <Switch
            label="Mostrar mi frase en el anverso"
            checked={shared.showSentenceOnFront}
            onChange={(showSentenceOnFront) => void saveSharedSettings({ showSentenceOnFront })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title="Audio"
        note="En este dispositivo. En el iPhone se oyen mucho mejor las voces mejoradas: Ajustes → Accesibilidad → Contenido leído → Voces → Inglés, y descarga una de «Reino Unido»."
      >
        <SettingRow label="Reproducir audio al mostrar la palabra">
          <Switch
            label="Reproducir audio al mostrar la palabra"
            checked={device.autoPlayAudio}
            onChange={(autoPlayAudio) => void saveDeviceSettings({ autoPlayAudio })}
          />
        </SettingRow>
        <VoiceSettings />
        <SettingRow label="Velocidad de la voz">
          <RangeField
            label="Velocidad de la voz"
            value={device.voiceRate}
            min={0.6}
            max={1.2}
            step={0.05}
            format={speed}
            onChange={(voiceRate) => void saveDeviceSettings({ voiceRate })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title="Acceso"
        note="Se guarda solo en este dispositivo. Es el mismo en el iPhone y en el PC."
      >
        <div className="px-3 py-2">
          <label htmlFor="app-secret" className="block text-body">
            Secreto de la app
          </label>
          <div className="mt-1.5 flex items-center gap-1">
            <input
              id="app-secret"
              type={secretVisible ? 'text' : 'password'}
              value={secret}
              onChange={(event) => {
                setSecretDraft(event.target.value)
                void saveDeviceSettings({ appSecret: event.target.value })
              }}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-10 min-w-0 flex-1 rounded-control border border-border bg-surface-2 px-3 text-text"
            />
            <IconButton
              label={secretVisible ? 'Ocultar secreto' : 'Mostrar secreto'}
              onClick={() => setSecretVisible((visible) => !visible)}
            >
              {secretVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </IconButton>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Almacenamiento">
        <SettingRow label="Almacenamiento persistente" description="Evita que el sistema borre tus datos">
          <span className="text-text-2">{storageSummary(storage)}</span>
        </SettingRow>
        {storage?.usage !== undefined && storage.quota !== undefined ? (
          <SettingRow label="Espacio usado">
            <span className="text-text-2">
              {formatBytes(storage.usage)} de {formatBytes(storage.quota)}
            </span>
          </SettingRow>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Instalación">
        <SettingRow label="Se está usando como">
          <span className="text-text-2">{install.isStandalone ? 'App instalada' : 'Navegador'}</span>
        </SettingRow>
      </SettingsSection>
      {install.showIOSGuide ? (
        <div className="mt-3">
          <InstallGuide />
        </div>
      ) : null}

      {DevTools ? (
        <Suspense fallback={null}>
          <DevTools />
        </Suspense>
      ) : null}

      <SettingsSection title="Diagnóstico tipográfico" note="Sirve para comprobar que el dispositivo dibuja bien la IPA y los colores.">
        <div className="space-y-3 p-3">
          <p className="font-serif text-word-entry">decision</p>
          <p className="ipa text-ipa text-text-2">/dɪˈsɪʒn/ · ˈ ˌ ː ə ɜ ʊ ɒ ʌ æ θ ð ʃ ʒ ŋ</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="noun">sustantivo</Chip>
            <Chip tone="verb">verbo</Chip>
            <Chip tone="adjective">adjetivo</Chip>
            <Chip tone="adverb">adverbio</Chip>
            <Chip tone="phrasal">phrasal verb</Chip>
            <Chip tone="idiom">expresión</Chip>
            <Chip tone="other">otros</Chip>
          </div>
        </div>
      </SettingsSection>
    </>
  )
}
