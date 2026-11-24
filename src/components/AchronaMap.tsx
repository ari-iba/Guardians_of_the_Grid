import { useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { STATUS_HEX } from '#/components/ui/StatusBadge.tsx'
import { DISTRICTS, DISTRICT_LABELS, type District } from '#/lib/district.ts'
import type { GlitchStatus } from '#/lib/glitch.ts'

const W = 800
const H = 480

type Island = { cx: number; cy: number; rx: number; ry: number; seed: number }

/** Hand-placed islands; coastlines are generated from these so the map stays tiny. */
const ISLANDS: Record<District, Island> = {
  clocktower: { cx: 190, cy: 128, rx: 122, ry: 74, seed: 3 },
  archives: { cx: 505, cy: 105, rx: 118, ry: 64, seed: 7 },
  'old-market': { cx: 400, cy: 262, rx: 86, ry: 60, seed: 11 },
  harbor: { cx: 662, cy: 282, rx: 100, ry: 90, seed: 5 },
  'ember-fields': { cx: 170, cy: 352, rx: 116, ry: 84, seed: 13 },
  skyforge: { cx: 470, cy: 412, rx: 92, ry: 48, seed: 17 },
}

/** Deterministic wobbly closed shape (Catmull-Rom → cubic Bézier). */
function blobPath({ cx, cy, rx, ry, seed }: Island, inset = 0): string {
  const n = 12
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const wobble = 1 + 0.1 * Math.sin(seed * 1.7 + i * 2.3) + 0.06 * Math.cos(seed * 0.9 + i * 4.1)
    return [cx + Math.cos(a) * (rx - inset) * wobble, cy + Math.sin(a) * (ry - inset) * wobble]
  })
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return `${d} Z`
}

const PATHS = Object.fromEntries(DISTRICTS.map((d) => [d, blobPath(ISLANDS[d])])) as Record<District, string>
const INNER = Object.fromEntries(DISTRICTS.map((d) => [d, blobPath(ISLANDS[d], 14)])) as Record<District, string>

/** Ley lines: every district is linked to the Old Market hub, plus a coastal ring. */
const LEY_LINES: [District, District][] = [
  ['old-market', 'clocktower'], ['old-market', 'archives'], ['old-market', 'harbor'],
  ['old-market', 'ember-fields'], ['old-market', 'skyforge'], ['clocktower', 'archives'],
  ['archives', 'harbor'], ['harbor', 'skyforge'], ['skyforge', 'ember-fields'], ['ember-fields', 'clocktower'],
]

/** Marker position for the i-th glitch in a district: a small spiral around the centre. */
function markerPosition(district: District, i: number) {
  const { cx, cy } = ISLANDS[district]
  if (i === 0) return { x: cx, y: cy + 4 }
  const angle = i * 2.4
  const radius = 20 + 7 * Math.floor(i / 6)
  return { x: cx + Math.cos(angle) * radius, y: cy + 4 + Math.sin(angle) * radius * 0.7 }
}

export type MapGlitch = {
  glitchId: string
  status: GlitchStatus
  district: District
  description: string
  assignedCodename?: string | null
  auto?: boolean
}

type AchronaMapProps = {
  glitches: MapGlitch[]
  activeDistrict?: District
  onDistrictClick?: (district: District) => void
  /** Rendered under the map (e.g. timeline replay controls). */
  footer?: ReactNode
  /** Disable navigation (e.g. while replaying history). */
  readOnly?: boolean
  /** Shown in the top-left corner of the map (e.g. a REPLAY badge). */
  badge?: ReactNode
}

export function AchronaMap({ glitches, activeDistrict, onDistrictClick, footer, readOnly, badge }: AchronaMapProps) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState<{ glitch: MapGlitch; x: number; y: number } | null>(null)
  const open = glitches.filter((g) => g.status !== 'FIXED')
  const openByDistrict = new Map<District, MapGlitch[]>()
  for (const g of open) openByDistrict.set(g.district, [...(openByDistrict.get(g.district) ?? []), g])

  const go = (glitchId: string) => {
    if (!readOnly) void navigate({ to: '/glitches/$glitchId', params: { glitchId } })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl border border-line">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full select-none" role="img" aria-label="Map of Achrona with open glitches">
          <defs>
            <radialGradient id="map-sea" cx="50%" cy="45%" r="75%">
              <stop offset="0%" stopColor="var(--map-sea-light)" />
              <stop offset="100%" stopColor="var(--map-sea)" />
            </radialGradient>
            <pattern id="map-waves" width="48" height="24" patternUnits="userSpaceOnUse">
              <path d="M0 12 q 6 -6 12 0 t 12 0" fill="none" stroke="var(--map-wave)" strokeWidth="1" />
            </pattern>
            <filter id="map-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>

          <rect width={W} height={H} fill="url(#map-sea)" />
          <rect width={W} height={H} fill="url(#map-waves)" opacity="0.7" />

          {LEY_LINES.map(([a, b]) => (
            <line
              key={`${a}-${b}`}
              x1={ISLANDS[a].cx} y1={ISLANDS[a].cy} x2={ISLANDS[b].cx} y2={ISLANDS[b].cy}
              className="ley-line" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 7" opacity="0.45"
            />
          ))}

          {DISTRICTS.map((district) => {
            const alert = (openByDistrict.get(district)?.length ?? 0) > 0
            const active = activeDistrict === district
            const { cx, cy, ry } = ISLANDS[district]
            return (
              <g
                key={district}
                className={onDistrictClick ? 'cursor-pointer' : undefined}
                onClick={() => onDistrictClick?.(district)}
                role={onDistrictClick ? 'button' : undefined}
                aria-label={onDistrictClick ? `Filter on ${DISTRICT_LABELS[district]}` : undefined}
                aria-pressed={onDistrictClick ? active : undefined}
                tabIndex={onDistrictClick ? 0 : undefined}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onDistrictClick?.(district))}
              >
                {alert && <path d={PATHS[district]} fill="#ef4444" filter="url(#map-glow)" className="district-alert" />}
                <path
                  data-district-island={district}
                  d={PATHS[district]}
                  fill="var(--map-land)"
                  stroke={active ? 'var(--accent)' : alert ? '#ef4444' : 'var(--map-coast)'}
                  strokeWidth={active ? 3 : 2}
                  className="transition-[stroke] duration-300"
                />
                <path d={INNER[district]} fill="none" stroke="var(--map-coast)" strokeWidth="1" strokeDasharray="2 5" opacity="0.6" />
                {alert && <path d={PATHS[district]} fill="#ef4444" opacity="0.12" pointerEvents="none" />}
                <text
                  x={cx} y={cy - ry + 36} textAnchor="middle"
                  className="pointer-events-none fill-[var(--map-label)] text-[13px] font-semibold tracking-[0.12em] uppercase"
                >
                  {DISTRICT_LABELS[district]}
                </text>
              </g>
            )
          })}

          {/* Compass rose */}
          <g transform="translate(742 430)" opacity="0.55" className="pointer-events-none">
            <circle r="20" fill="none" stroke="var(--map-label)" strokeWidth="1" />
            <path d="M0 -24 L5 0 L0 24 L-5 0 Z" fill="var(--map-label)" />
            <text y="-28" textAnchor="middle" className="fill-[var(--map-label)] text-[10px] font-bold">N</text>
          </g>

          {DISTRICTS.flatMap((district) =>
            (openByDistrict.get(district) ?? []).map((g, i) => {
              const { x, y } = markerPosition(district, i)
              const color = STATUS_HEX[g.status]
              return (
                <g
                  key={g.glitchId}
                  data-glitch-marker={g.glitchId}
                  transform={`translate(${x} ${y})`}
                  className={readOnly ? undefined : 'cursor-pointer'}
                  role={readOnly ? undefined : 'link'}
                  tabIndex={readOnly ? undefined : 0}
                  aria-label={`${g.glitchId}, ${g.status}: ${g.description}`}
                  onClick={(e) => (e.stopPropagation(), go(g.glitchId))}
                  onKeyDown={(e) => e.key === 'Enter' && go(g.glitchId)}
                  onMouseEnter={() => setHovered({ glitch: g, x, y })}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered({ glitch: g, x, y })}
                  onBlur={() => setHovered(null)}
                >
                  <circle r="9" fill={color} className="map-pulse" />
                  <circle r="8" fill={color} stroke="white" strokeWidth="2.5" />
                  {g.auto && <text y="3.5" textAnchor="middle" className="pointer-events-none text-[9px]">🤖</text>}
                </g>
              )
            }),
          )}
        </svg>

        {hovered && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 w-60 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl border border-line bg-card/95 p-3 text-sm shadow-xl backdrop-blur"
            style={{ left: `${(hovered.x / W) * 100}%`, top: `${(hovered.y / H) * 100}%` }}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-muted">{hovered.glitch.glitchId}</span>
              <span className="text-xs font-bold" style={{ color: STATUS_HEX[hovered.glitch.status] }}>
                {hovered.glitch.status}
              </span>
              {hovered.glitch.auto && <span title="Auto-detected">🤖</span>}
            </div>
            <p className="mt-1 line-clamp-2 text-fg">{hovered.glitch.description}</p>
            <p className="mt-1 text-xs text-muted">
              {DISTRICT_LABELS[hovered.glitch.district]} · {hovered.glitch.assignedCodename ?? 'Unassigned'}
            </p>
          </div>
        )}

        {badge && <div className="pointer-events-none absolute top-2 left-2">{badge}</div>}
        <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-card/80 px-2 py-1 text-[11px] text-muted backdrop-blur">
          {(['LEAKED', 'ASSESSING', 'CONTAINING'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ background: STATUS_HEX[s] }} /> {s}
            </span>
          ))}
        </div>
      </div>
      {footer}
    </div>
  )
}
