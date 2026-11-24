import { useState, type MouseEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { METRICS, METRIC_LABELS, SENSOR_THRESHOLD, type Metric, type SensorPoint } from '#/lib/sensors.ts'
import type { AutoGlitchMarker } from '#/lib/sensors.functions.ts'

export const SERIES_COLOR: Record<Metric, string> = {
  magic: 'var(--series-magic)',
  time_stability: 'var(--series-time)',
  portal_flux: 'var(--series-flux)',
}

const W = 340
const H = 150
const PAD = { left: 26, right: 34, top: 14, bottom: 18 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom
const y = (v: number) => PAD.top + plotH * (1 - v / 100)
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

type SensorChartProps = {
  label: string
  series: Record<Metric, SensorPoint[]>
  markers: AutoGlitchMarker[]
}

/** Three health metrics (0–100) over time, one shared axis, red zone under the threshold. */
export function SensorChart({ label, series, markers }: SensorChartProps) {
  const navigate = useNavigate()
  const [hoverT, setHoverT] = useState<number | null>(null)

  const all = METRICS.flatMap((m) => series[m])
  if (all.length < 2) return <p className="py-10 text-center text-sm text-muted">Waiting for sensor data…</p>

  const t0 = Math.min(...all.map((p) => Date.parse(p.timestamp)))
  const t1 = Math.max(...all.map((p) => Date.parse(p.timestamp)))
  const span = Math.max(1, t1 - t0)
  const x = (t: number) => PAD.left + ((t - t0) / span) * plotW

  const nearest = (points: SensorPoint[], t: number) =>
    points.reduce((best, p) => (Math.abs(Date.parse(p.timestamp) - t) < Math.abs(Date.parse(best.timestamp) - t) ? p : best), points[0])

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const t = t0 + ((px - PAD.left) / plotW) * span
    setHoverT(Math.min(t1, Math.max(t0, t)))
  }

  const visibleMarkers = markers.filter((m) => Date.parse(m.timestamp) >= t0)
  const hoverValues = hoverT === null ? null : METRICS.map((m) => ({ metric: m, point: series[m].length ? nearest(series[m], hoverT) : null }))
  const hoverPoint = hoverValues?.find((v) => v.point)?.point

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full overflow-visible"
        role="img"
        aria-label={`${label}: sensor history for ${METRICS.map((m) => METRIC_LABELS[m]).join(', ')}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverT(null)}
      >
        {/* Red zone: below the threshold a glitch is created automatically. */}
        <rect x={PAD.left} y={y(SENSOR_THRESHOLD)} width={plotW} height={y(0) - y(SENSOR_THRESHOLD)} fill="var(--danger-zone)" />
        <line x1={PAD.left} x2={PAD.left + plotW} y1={y(SENSOR_THRESHOLD)} y2={y(SENSOR_THRESHOLD)} stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />

        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.left - 5} y={y(v) + 3} textAnchor="end" className="fill-muted text-[8px] tabular-nums">
              {v}
            </text>
          </g>
        ))}
        <text x={PAD.left - 5} y={y(SENSOR_THRESHOLD) + 3} textAnchor="end" className="fill-red-500 text-[8px] font-semibold tabular-nums">
          {SENSOR_THRESHOLD}
        </text>

        {/* Auto-glitch markers */}
        {visibleMarkers.map((m) => {
          const mx = x(Date.parse(m.timestamp))
          return (
            <g
              key={m.glitchId}
              className="cursor-pointer"
              role="link"
              tabIndex={0}
              aria-label={`Auto-detected ${m.glitchId}`}
              onClick={() => navigate({ to: '/glitches/$glitchId', params: { glitchId: m.glitchId } })}
              onKeyDown={(e) => e.key === 'Enter' && navigate({ to: '/glitches/$glitchId', params: { glitchId: m.glitchId } })}
            >
              <title>{`${m.glitchId} · auto-detected${m.metric ? ` (${METRIC_LABELS[m.metric]})` : ''} · ${m.status}`}</title>
              <line x1={mx} x2={mx} y1={PAD.top} y2={y(0)} stroke="var(--fg)" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
              <rect x={mx - 9} y={PAD.top - 13} width="18" height="14" rx="4" fill="var(--card)" stroke="var(--line)" />
              <text x={mx} y={PAD.top - 3} textAnchor="middle" className="text-[9px]">🤖</text>
            </g>
          )
        })}

        {METRICS.map((metric) => {
          const pts = series[metric]
          if (pts.length < 2) return null
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(Date.parse(p.timestamp)).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
          const last = pts[pts.length - 1]
          return (
            <g key={metric}>
              <path d={d} fill="none" stroke={SERIES_COLOR[metric]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(Date.parse(last.timestamp))} cy={y(last.value)} r="3" fill={SERIES_COLOR[metric]} stroke="var(--card)" strokeWidth="1.5" />
            </g>
          )
        })}

        {/* Direct labels: latest values, in text ink (colour sits on the dot). */}
        {METRICS.map((metric, i) => {
          const last = series[metric][series[metric].length - 1]
          if (!last) return null
          return (
            <g key={metric} transform={`translate(${W - PAD.right + 6} ${PAD.top + 8 + i * 14})`}>
              <circle r="3" cx="0" cy="-3" fill={SERIES_COLOR[metric]} />
              <text x="6" y="0" className={`text-[9px] font-semibold tabular-nums ${last.value < SENSOR_THRESHOLD ? 'fill-red-500' : 'fill-fg'}`}>
                {Math.round(last.value)}
              </text>
            </g>
          )
        })}

        {hoverT !== null && (
          <line x1={x(hoverT)} x2={x(hoverT)} y1={PAD.top} y2={y(0)} stroke="var(--muted)" strokeWidth="1" />
        )}
        {hoverValues?.map(({ metric, point }) =>
          point ? (
            <circle key={metric} cx={x(Date.parse(point.timestamp))} cy={y(point.value)} r="4" fill={SERIES_COLOR[metric]} stroke="var(--card)" strokeWidth="2" pointerEvents="none" />
          ) : null,
        )}
      </svg>

      {hoverValues && hoverPoint && hoverT !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-40 rounded-xl border border-line bg-card/95 p-2 text-xs shadow-lg backdrop-blur"
          style={{ left: `${Math.min(62, Math.max(0, (x(hoverT) / W) * 100 - 20))}%` }}
        >
          <p className="mb-1 font-semibold text-muted tabular-nums">{timeFormat.format(new Date(hoverPoint.timestamp))}</p>
          {hoverValues.map(({ metric, point }) => (
            <p key={metric} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-fg">
                <span className="size-2 rounded-full" style={{ background: SERIES_COLOR[metric] }} />
                {METRIC_LABELS[metric]}
              </span>
              <span className={`font-semibold tabular-nums ${point && point.value < SENSOR_THRESHOLD ? 'text-red-500' : 'text-fg'}`}>
                {point ? Math.round(point.value) : '–'}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
