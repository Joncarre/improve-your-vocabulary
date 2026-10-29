import { useLiveQuery } from 'dexie-react-hooks'
import { ChartNoAxesColumn, Flame } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useNow } from '../../lib/useNow.ts'
import { WORD_STATE_LABEL_ES, WORD_STATES, type WordState } from '../../srs/state.ts'
import { Button } from '../../ui/Button.tsx'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageHeader } from '../../ui/PageHeader.tsx'
import { Skeleton } from '../../ui/Skeleton.tsx'
import { useAddSheet } from '../add/addSheetContext.ts'
import { BarChart, Ring, SegmentBar, type Bar, type Segment, type Tick } from './charts.tsx'
import { loadProgress, type ProgressData } from './data.ts'
import { forecastLabel, formatDayMonth, formatLongDay, plural } from './format.ts'
import type { FailedWord } from './stats.ts'

/** Same colours as the state chips of the entry page. */
const STATE_TONE: Record<WordState, string> = {
  new: 'bg-other',
  learning: 'bg-hard',
  review: 'bg-easy',
  consolidated: 'bg-good',
  mastered: 'bg-accent',
}

function Panel({ title, summary, children, className = '' }: { title: string; summary?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`mb-3 break-inside-avoid rounded-card border border-border bg-surface p-4 ${className}`.trim()}>
      <h2 className="text-caption font-medium uppercase tracking-wider text-text-3">{title}</h2>
      {summary ? <div className="mt-1.5">{summary}</div> : null}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** The big number of a panel with what it counts next to it. */
function Headline({ value, unit }: { value: ReactNode; unit: string }) {
  return (
    <p className="flex items-baseline gap-2">
      <span className="text-[30px] font-semibold leading-none tabular-nums">{value}</span>
      <span className="text-secondary text-text-2">{unit}</span>
    </p>
  )
}

const Nothing = ({ children }: { children: ReactNode }) => <p className="py-6 text-center text-secondary text-text-2">{children}</p>

function StreakPanel({ data }: { data: ProgressData }) {
  const { days, doneToday } = data.streak
  return (
    <section aria-label="Racha" className="mb-3 flex break-inside-avoid items-center gap-4 rounded-card border border-border bg-surface p-4">
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-full ${days > 0 ? 'bg-hard/15 text-hard' : 'bg-surface-2 text-text-3'}`}>
        <Flame size={24} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-section font-semibold">{days === 1 ? '1 día seguido' : `${days} días seguidos`}</p>
        <p className="text-secondary text-text-2">{doneToday ? '¡Hoy ya has repasado!' : days > 0 ? 'Repasa hoy para mantener la racha.' : 'Empieza hoy tu racha.'}</p>
      </div>
    </section>
  )
}

function ReviewsPanel({ data }: { data: ProgressData }) {
  const total = data.accuracy.total
  const first = data.days[0]
  const last = data.days[data.days.length - 1]
  const bars: Bar[] = data.days.map((day, index) => ({ key: day.key, value: day.total, label: formatLongDay(day.key), strong: index === data.days.length - 1 }))
  const ticks: Tick[] = first && last ? [{ index: 0, text: formatDayMonth(first.key) }, { index: bars.length - 1, text: 'hoy' }] : []
  return (
    <Panel title="Repasos · 30 días" summary={<Headline value={total} unit={`${total === 1 ? 'repaso' : 'repasos'} · media ${(total / Math.max(1, data.days.length)).toLocaleString('es-ES', { maximumFractionDigits: 1 })} al día`} />}>
      {total === 0 ? (
        <Nothing>Todavía no has repasado nada en los últimos 30 días.</Nothing>
      ) : (
        <BarChart
          bars={bars}
          ticks={ticks}
          tone="text-easy"
          gap={2}
          columns={['Día', 'Repasos']}
          valueLabel={(value) => plural(value, 'repaso', 'repasos')}
          caption={`Repasos por día de los últimos 30 días: ${plural(total, 'repaso', 'repasos')} en total.`}
        />
      )}
    </Panel>
  )
}

function AccuracyPanel({ data }: { data: ProgressData }) {
  const { rate, correct, total } = data.accuracy
  const percent = rate === null ? null : Math.round(rate * 100)
  return (
    <Panel title="Aciertos · 30 días">
      <div className="flex items-center gap-5">
        <Ring value={rate} tone="text-good">
          {percent === null ? '—' : `${percent} %`}
        </Ring>
        <div className="min-w-0">
          {total === 0 ? (
            <p className="text-secondary text-text-2">Cuando repases, aquí verás qué parte de tus respuestas es correcta.</p>
          ) : (
            <>
              <p className="text-body font-medium">
                {plural(correct, 'respuesta correcta', 'respuestas correctas')} de {total}
              </p>
              <p className="mt-1 text-secondary text-text-2">«Difícil» cuenta como acierto: lo recordabas, aunque con esfuerzo.</p>
            </>
          )}
        </div>
      </div>
    </Panel>
  )
}

function StatesPanel({ data }: { data: ProgressData }) {
  const segments: Segment[] = WORD_STATES.map((state) => ({ key: state, value: data.states[state], tone: STATE_TONE[state], label: WORD_STATE_LABEL_ES[state] }))
  return (
    <Panel title="Tus palabras" summary={<Headline value={data.words} unit={data.words === 1 ? 'palabra' : 'palabras'} />}>
      {data.words === 0 ? <Nothing>Aquí verás cuántas palabras son nuevas, están en repaso o ya las dominas.</Nothing> : <SegmentBar segments={segments} />}
    </Panel>
  )
}

function ForecastPanel({ data }: { data: ProgressData }) {
  const total = data.forecast.reduce((sum, day) => sum + day.count, 0)
  const bars: Bar[] = data.forecast.map((day, index) => ({ key: day.key, value: day.count, label: formatLongDay(day.key), strong: index === 0 }))
  const ticks: Tick[] = data.forecast.map((day, index) => ({ index, text: forecastLabel(day.key, index) }))
  return (
    <Panel title="Previsión · 7 días" summary={<Headline value={total} unit={`${total === 1 ? 'tarjeta' : 'tarjetas'} por repasar`} />}>
      {total === 0 ? (
        <Nothing>No tienes repasos previstos en los próximos 7 días.</Nothing>
      ) : (
        <BarChart
          bars={bars}
          ticks={ticks}
          tone="text-good"
          gap={8}
          columns={['Día', 'Tarjetas']}
          valueLabel={(value) => plural(value, 'tarjeta', 'tarjetas')}
          caption={`Tarjetas por repasar en los próximos 7 días: ${plural(total, 'tarjeta', 'tarjetas')}. Lo atrasado cuenta en hoy.`}
        />
      )}
    </Panel>
  )
}

function AddedPanel({ data }: { data: ProgressData }) {
  const total = data.weeks.reduce((sum, week) => sum + week.count, 0)
  const bars: Bar[] = data.weeks.map((week, index) => ({
    key: week.start,
    value: week.count,
    label: index === data.weeks.length - 1 ? `Esta semana (desde el ${formatDayMonth(week.start)})` : `Semana del ${formatDayMonth(week.start)}`,
    strong: index === data.weeks.length - 1,
  }))
  const first = data.weeks[0]
  const ticks: Tick[] = first ? [{ index: 0, text: formatDayMonth(first.start) }, { index: bars.length - 1, text: 'esta semana' }] : []
  return (
    <Panel title="Añadidas por semana" summary={<Headline value={total} unit={`${total === 1 ? 'palabra' : 'palabras'} en ${data.weeks.length} semanas`} />}>
      {total === 0 ? (
        <Nothing>No has añadido palabras en las últimas {data.weeks.length} semanas.</Nothing>
      ) : (
        <BarChart
          bars={bars}
          ticks={ticks}
          tone="text-adjective"
          gap={8}
          columns={['Semana', 'Palabras']}
          valueLabel={(value) => plural(value, 'palabra', 'palabras')}
          caption={`Palabras añadidas por semana en las últimas ${data.weeks.length} semanas: ${plural(total, 'palabra', 'palabras')} en total.`}
        />
      )}
    </Panel>
  )
}

function FailedPanel({ failed }: { failed: FailedWord[] }) {
  const most = failed[0]?.fails ?? 1
  return (
    <Panel title="Las 10 más falladas">
      {failed.length === 0 ? (
        <Nothing>Todavía no has fallado ninguna palabra en un repaso. ¡Bien!</Nothing>
      ) : (
        <ol className="-mx-2 divide-y divide-border">
          {failed.map(({ entry, fails }, index) => {
            const sense = entry.senses.find((candidate) => candidate.matchesContext) ?? entry.senses[0]
            return (
              <li key={entry.id}>
                <Link to={`/entry/${entry.id}`} className="flex min-h-14 items-center gap-3 rounded-control px-2 py-2 active:bg-surface-2">
                  <span aria-hidden="true" className="w-5 shrink-0 text-right text-secondary tabular-nums text-text-3">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-[18px] font-medium">{entry.lemma}</span>
                    {sense?.meaningEs ? <span className="block truncate text-secondary text-text-2">{sense.meaningEs}</span> : null}
                  </span>
                  <span className="flex w-24 shrink-0 flex-col items-end gap-1">
                    <span className="text-secondary font-medium tabular-nums text-again">{plural(fails, 'fallo', 'fallos')}</span>
                    <span aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-again" style={{ width: `${(fails / most) * 100}%` }} />
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}

function Loading() {
  return (
    <div role="status" aria-label="Cargando" className="space-y-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-52 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

/** Progreso (spec §9): the streak, the last 30 days, the states, the next 7 days, the words added and the most failed. */
export default function ProgressPage() {
  const { openAdd } = useAddSheet()
  // The days change with the clock, not only with the data.
  const now = useNow(5 * 60_000)
  const data = useLiveQuery(() => loadProgress(now), [now])

  return (
    <>
      <PageHeader title="Progreso" />
      {data === undefined ? (
        <Loading />
      ) : data.added === 0 ? (
        <EmptyState
          icon={ChartNoAxesColumn}
          title="Todavía no hay datos"
          action={
            <Button variant="primary" onClick={() => openAdd()}>
              Añadir una palabra
            </Button>
          }
        >
          Tus repasos, tu racha y las palabras que más fallas se mostrarán aquí.
        </EmptyState>
      ) : (
        <>
          {/* One column on a phone; on a computer the panels flow into two balanced columns, in the same order. */}
          <div className="lg:columns-2 lg:gap-4 lg:pb-3">
            <StreakPanel data={data} />
            <ReviewsPanel data={data} />
            <AccuracyPanel data={data} />
            <ForecastPanel data={data} />
            <StatesPanel data={data} />
            <AddedPanel data={data} />
          </div>
          <FailedPanel failed={data.failed} />
        </>
      )}
    </>
  )
}
