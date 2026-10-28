import { Play, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import { playAudio, stopAudio, usePlayingKey } from '../../audio/useSpeech.ts'
import { britishVoices, cachedVoices, preloadVoices } from '../../audio/voices.ts'
import { saveDeviceSettings, useDeviceSettings } from '../../db/settings.ts'
import { Button } from '../../ui/Button.tsx'
import { SelectField, SettingRow } from '../../ui/controls.tsx'

const TEST_KEY = 'voice-test'
const TEST_PHRASE = 'Hello! This is how I sound. Would you like a cup of tea?'
const AUTOMATIC = ''

/** Rows for the Audio section: which British voice to use and a button to hear it. */
export function VoiceSettings() {
  const { settings } = useDeviceSettings()
  const playing = usePlayingKey() === TEST_KEY
  // The list of voices arrives a moment after the page opens: until then the select is not drawn,
  // so it never flashes "Automática" over the voice that was chosen.
  const [{ voices, loaded }, setList] = useState(() => {
    const cached = cachedVoices()
    return { voices: britishVoices(cached), loaded: cached.length > 0 }
  })

  useEffect(() => {
    let cancelled = false
    void preloadVoices().then((all) => {
      if (!cancelled) setList({ voices: britishVoices(all), loaded: true })
    })
    return () => {
      cancelled = true
      stopAudio()
    }
  }, [])

  const chosen = voices.some((voice) => voice.voiceURI === settings.voiceURI) ? settings.voiceURI : undefined
  const options = [
    { value: AUTOMATIC, label: 'Automática (la mejor disponible)' },
    ...voices.map((voice) => ({ value: voice.voiceURI, label: voice.name })),
  ]

  return (
    <>
      <SettingRow
        label="Voz"
        description={
          !loaded
            ? 'Buscando voces…'
            : voices.length === 0
              ? 'Este dispositivo no ofrece voces de inglés británico.'
              : undefined
        }
      >
        {loaded ? (
          <SelectField
            label="Voz"
            value={chosen ?? AUTOMATIC}
            options={options}
            onChange={(voiceURI) => void saveDeviceSettings({ voiceURI })}
          />
        ) : null}
      </SettingRow>
      <SettingRow label="Probar la voz" description="Usa la velocidad elegida">
        <Button
          onClick={() =>
            playing ? stopAudio() : playAudio({ key: TEST_KEY, text: TEST_PHRASE, audioUrl: undefined })
          }
        >
          {playing ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {playing ? 'Parar' : 'Probar'}
        </Button>
      </SettingRow>
    </>
  )
}
