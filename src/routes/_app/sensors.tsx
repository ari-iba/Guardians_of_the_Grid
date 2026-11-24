import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Bot, LoaderCircle, RotateCcw, ShieldAlert, Siren, UserCheck, Zap } from 'lucide-react'
import { LiveIndicator } from '#/components/LiveIndicator.tsx'
import { SERIES_COLOR, SensorChart } from '#/components/SensorChart.tsx'
import { Card } from '#/components/ui/Card.tsx'
import { useAppUi } from '#/lib/app-ui.ts'
import { DISTRICTS, DISTRICT_LABELS } from '#/lib/district.ts'
import {
  getSensorDashboard,
  resetSensorSimulation,
  setSimulationOption,
} from '#/lib/sensors.functions.ts'
import { METRICS, METRIC_LABELS, SENSOR_THRESHOLD } from '#/lib/sensors.ts'

export const Route = createFileRoute('/_app/sensors')({
  loader: () => getSensorDashboard(),
  head: () => ({ meta: [{ title: 'Sensors · Control Center' }] }),
  component: SensorsPage,
})

function SensorsPage() {
  const { series, markers, simulation } = Route.useLoaderData()
  const { guardian } = Route.useRouteContext()
  const isCommander = guardian.role === 'commander'

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">Desync Engine</p>
        <h1 className="title-pixel text-xl text-fg md:text-2xl">Sensor grid</h1>
        <LiveIndicator />
      </header>

      <SimulationPanel simulation={simulation} isCommander={isCommander} />

      {/* One legend for all small multiples, above the charts. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
        {METRICS.map((m) => (
          <span key={m} className="inline-flex items-center gap-2">
            <span className="h-0.5 w-5 rounded-full" style={{ background: SERIES_COLOR[m] }} />
            <span className="text-fg">{METRIC_LABELS[m]}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm border-t border-dashed border-red-500 bg-red-500/15" />
          Below {SENSOR_THRESHOLD}% → auto-glitch
        </span>
        <span className="inline-flex items-center gap-1.5">🤖 Auto-detected glitch (click to open)</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DISTRICTS.map((district) => {
          const attacked = simulation.attacks[district]
          const open = markers.filter((m) => m.district === district && m.status !== 'FIXED').length
          return (
            <Card key={district} className={`flex flex-col gap-3 p-4 ${attacked ? 'border-red-500/60' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-fg">{DISTRICT_LABELS[district]}</h2>
                {attacked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-300">
                    <Siren className="size-3.5 animate-pulse" /> Under attack
                  </span>
                ) : open > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300">
                    <Bot className="size-3.5" /> {open} open
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Stable
                  </span>
                )}
              </div>
              <SensorChart
                label={DISTRICT_LABELS[district]}
                series={series[district]}
                markers={markers.filter((m) => m.district === district)}
              />
            </Card>
          )
        })}
      </div>

      <details className="rounded-2xl border border-line p-4">
        <summary className="cursor-pointer text-sm font-semibold text-fg">Latest readings as a table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 pr-4 font-normal">District</th>
                {METRICS.map((m) => (
                  <th key={m} className="py-2 pr-4 font-normal">
                    {METRIC_LABELS[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DISTRICTS.map((d) => (
                <tr key={d} className="border-b border-line">
                  <td className="py-2 pr-4 text-fg">{DISTRICT_LABELS[d]}</td>
                  {METRICS.map((m) => {
                    const v = series[d][m].at(-1)?.value
                    return (
                      <td key={m} className={`py-2 pr-4 tabular-nums ${v !== undefined && v < SENSOR_THRESHOLD ? 'font-semibold text-red-600' : 'text-fg'}`}>
                        {v === undefined ? '–' : `${Math.round(v)}%`}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

function SimulationPanel({
  simulation,
  isCommander,
}: {
  simulation: { autoDesync: boolean; autoAssign: boolean; attacks: object }
  isCommander: boolean
}) {
  const router = useRouter()
  const { notify, startWave } = useAppUi()
  const [pending, setPending] = useState<string | null>(null)

  async function run(label: string, action: () => Promise<unknown>, message?: (result: never) => string) {
    setPending(label)
    try {
      const result = await action()
      await router.invalidate()
      if (message) notify(message(result as never), label === 'attack' ? 'danger' : 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Action failed.', 'danger')
    } finally {
      setPending(null)
    }
  }

  const attackCount = Object.keys(simulation.attacks).length

  return (
    <Card className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
        <Toggle
          label="Auto-Desync"
          description="Spontaneous Desync events (≈ 1 per 2–3 min)"
          icon={<Zap className="size-4" />}
          checked={simulation.autoDesync}
          disabled={!isCommander || pending !== null}
          onChange={(value) => run('desync', () => setSimulationOption({ data: { key: 'autoDesync', value } }))}
        />
        <Toggle
          label="Auto-assign"
          description="New auto-glitches go to the least busy defender"
          icon={<UserCheck className="size-4" />}
          checked={simulation.autoAssign}
          disabled={!isCommander || pending !== null}
          onChange={(value) => run('assign', () => setSimulationOption({ data: { key: 'autoAssign', value } }))}
        />
      </div>
      {isCommander ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending !== null}
            onClick={startWave}
            title="Wave = a simulated Desync attack: 2–3 districts crash and monsters spawn"

            className="btn-game inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <ShieldAlert className="size-4" />
            Start wave (simulate attack)
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => run('reset', () => resetSensorSimulation(), () => 'Simulation reset: all sensors back to normal')}
            className="btn-game inline-flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-fg disabled:opacity-50"
          >
            {pending === 'reset' ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            Reset simulation
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {attackCount > 0 ? `${attackCount} district(s) under attack.` : 'Only a commander can change the simulation.'}
        </p>
      )}
    </Card>
  )
}

function Toggle({
  label,
  description,
  icon,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  icon: React.ReactNode
  checked: boolean
  disabled: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
          checked ? 'bg-accent' : 'bg-line'
        }`}
      >
        <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
      </button>
      <span className="flex flex-col">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
          {icon} {label}
        </span>
        <span className="text-xs text-muted">{description}</span>
      </span>
    </label>
  )
}
