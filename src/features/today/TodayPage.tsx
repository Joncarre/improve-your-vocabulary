import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Flame, Hourglass, Settings, Sparkles, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { InstallGuide } from '../../app/InstallGuide.tsx'
import { primeSpeech } from '../../audio/speech.ts'
import { saveDeviceSettings, useDeviceSettings } from '../../db/settings.ts'
import { useInstallState } from '../../lib/install.ts'
import { SyncIndicator, SyncStaleBanner } from '../../sync/SyncIndicator.tsx'
import { Button } from '../../ui/Button.tsx'
import { ICON_BUTTON_CLASS } from '../../ui/classes.ts'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageHeader } from '../../ui/PageHeader.tsx'
import { Skeleton } from '../../ui/Skeleton.tsx'
import { formatDue } from '../entry/progress.ts'
import { useAddSheet } from '../add/addSheetContext.ts'
import { loadToday, type TodayData } from './todayData.ts'

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[30px] font-semibold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-secondary text-text-2">{label}</div>
    </div>
  )
}

function StudyCard({ data, onStart }: { data: TodayData; onStart: () => void }) {
  const { counts } = data.queue
  const due = counts.learning + counts.review
  const total = due + counts.new
  const [now] = useState(() => Date.now())

  return (
    <section aria-label="Repaso de hoy" className="rounded-sheet border border-border bg-surface p-5">
      {total === 0 ? (
        <div className="py-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-2 text-good">
            <Sparkles size={22} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-section font-semibold">Todo al día</h2>
          <p className="mt-1 text-secondary text-text-2">
            {data.nextDue !== null ? `Lo siguiente toca ${formatDue(data.nextDue, now)}.` : 'No tienes nada pendiente.'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-caption font-medium uppercase tracking-wider text-text-3">Para hoy</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Figure value={String(due)} label="por repasar" />
            <Figure value={String(counts.new)} label={counts.new === 1 ? 'nueva' : 'nuevas'} />
            <Figure value={`≈ ${data.minutes}`} label="min" />
          </div>
          {data.queue.backlogMode ? (
            <p className="mt-4 flex items-start gap-2 rounded-card border border-hard/40 bg-hard/10 p-3 text-secondary text-hard">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Tienes muchos repasos acumulados: van primero los más urgentes y no entran palabras nuevas hasta bajar de 50.
            </p>
          ) : null}
          <Button variant="primary" className="mt-5 h-12 w-full text-[16px]" onClick={onStart}>
            Empezar
          </Button>
        </>
      )}
    </section>
  )
}

function StreakCard({ data }: { data: TodayData }) {
  const { days, doneToday } = data.streak
  return (
    <section aria-label="Racha" className="flex items-center gap-4 rounded-card border border-border bg-surface p-4">
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-full ${days > 0 ? 'bg-hard/15 text-hard' : 'bg-surface-2 text-text-3'}`}>
        <Flame size={24} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-section font-semibold">{days === 1 ? '1 día seguido' : `${days} días seguidos`}</p>
        <p className="text-secondary text-text-2">
          {doneToday ? '¡Hoy ya has repasado!' : days > 0 ? 'Repasa hoy para mantener la racha.' : 'Empieza hoy tu racha.'}
        </p>
      </div>
    </section>
  )
}

function LinkRow({ to, icon: Icon, title, text }: { to: string; icon: typeof Hourglass; title: string; text: string }) {
  return (
    <Link to={to} className="flex min-h-14 items-center gap-3 rounded-card border border-border bg-surface px-4 py-2 active:bg-surface-2">
      <Icon size={20} strokeWidth={1.75} className="shrink-0 text-text-2" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-secondary text-text-2">{text}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-text-3" aria-hidden="true" />
    </Link>
  )
}

export default function TodayPage() {
  const install = useInstallState()
  const navigate = useNavigate()
  const { settings, ready } = useDeviceSettings()
  const { openAdd } = useAddSheet()
  const showGuide = install.showIOSGuide && ready && !settings.installGuideDismissed

  // The numbers also change with the clock (a card falls due), not only with the data.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const data = useLiveQuery(() => loadToday(), [tick])

  // Backlog mode has two thresholds, so the last value is remembered between visits.
  const backlogMode = data?.queue.backlogMode
  useEffect(() => {
    if (backlogMode !== undefined && backlogMode !== (settings.backlogMode ?? false)) void saveDeviceSettings({ backlogMode })
  }, [backlogMode, settings.backlogMode])

  const start = () => {
    // The first tap unlocks speech on iOS, so the word can be spoken automatically in the session.
    primeSpeech()
    navigate('/review')
  }

  return (
    <>
      <PageHeader
        title="Hoy"
        actions={
          <>
            <SyncIndicator />
            <Link to="/settings" aria-label="Ajustes" className={ICON_BUTTON_CLASS}>
              <Settings size={20} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </>
        }
      />
      <div className="space-y-4">
        <SyncStaleBanner />
        {showGuide ? <InstallGuide onDismiss={() => void saveDeviceSettings({ installGuideDismissed: true })} /> : null}

        {data === undefined ? (
          <div role="status" aria-label="Cargando" className="space-y-3">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : data.words === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Todavía no hay repasos"
            action={
              <Button variant="primary" onClick={() => openAdd()}>
                Añadir una palabra
              </Button>
            }
          >
            Cuando tengas palabras para repasar, aquí verás cuántas hay hoy y cuántas son nuevas.
          </EmptyState>
        ) : (
          <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
            <StudyCard data={data} onStart={start} />
            <div className="space-y-3">
              <StreakCard data={data} />
              {data.leeches > 0 ? (
                <LinkRow to="/leeches" icon={Flame} title={`Rebeldes (${data.leeches})`} text="Palabras que se te resisten: ejemplos nuevos o archivar" />
              ) : null}
              {data.pending > 0 ? (
                <LinkRow
                  to="/vocabulary?estado=pending"
                  icon={Hourglass}
                  title={`Pendientes de completar (${data.pending})`}
                  text="Esperan a la IA; se completan solas con conexión"
                />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
