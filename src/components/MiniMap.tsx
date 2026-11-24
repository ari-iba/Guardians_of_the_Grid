import { Link } from '@tanstack/react-router'
import { ArrowRight, Map as MapIcon } from 'lucide-react'
import { MapAtmosphere } from '#/components/map/MapAtmosphere.tsx'
import { Terrain } from '#/components/map/Terrain.tsx'
import { Card } from '#/components/ui/Card.tsx'
import { STATUS_HEX } from '#/components/ui/StatusBadge.tsx'
import { DISTRICTS } from '#/lib/district.ts'
import { GLITCH_STATUSES, type GlitchSummary } from '#/lib/glitch.ts'
import { MAP } from '#/lib/map-geometry.ts'

/** Small, static map preview for the overview, linking to the full /map tab. */
export function MiniMap({ glitches }: { glitches: GlitchSummary[] }) {
  const open = glitches.filter((g) => g.status !== 'FIXED')
  return (
    <Card className="flex flex-col gap-3 p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
          <MapIcon className="size-4" /> Map of Achrona
        </h2>
        <span className="text-xs text-muted">{open.length} open</span>
      </div>
      <div className="achrona-map relative overflow-hidden rounded-2xl border border-line" aria-hidden>
        <Terrain />
        <MapAtmosphere />
        <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} className="absolute inset-0 size-full">
          {DISTRICTS.map((d) => {
            const here = open.filter((g) => g.district === d)
            if (here.length === 0) return null
            // Worst status decides the colour.
            const worst = GLITCH_STATUSES.find((s) => here.some((g) => g.status === s))!
            const [x, y] = MAP.districts[d].capital
            return (
              <g key={d} transform={`translate(${x} ${y - 40})`} data-district-island={d}>
                <circle r="34" fill={STATUS_HEX[worst]} opacity="0.25" className="map-pulse" />
                <circle r="28" fill={STATUS_HEX[worst]} stroke="white" strokeWidth="5" />
                <text y="11" textAnchor="middle" className="fill-white text-[32px] font-bold">
                  {here.length}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <Link
        to="/map"
        className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/15"
      >
        Open map <ArrowRight className="size-4" />
      </Link>
    </Card>
  )
}
