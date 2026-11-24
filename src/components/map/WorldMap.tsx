import { MapAtmosphere } from '#/components/map/MapAtmosphere.tsx'
import { Terrain } from '#/components/map/Terrain.tsx'
import { STATUS_HEX } from '#/components/ui/StatusBadge.tsx'
import { DISTRICTS, type District } from '#/lib/district.ts'
import type { GlitchSummary } from '#/lib/glitch.ts'
import { MAP } from '#/lib/map-geometry.ts'

const { width: W, height: H } = MAP

/** Each glitch gets one of its district's pre-computed marker slots (stable per glitch). */
export function placeMarkers(glitches: GlitchSummary[]) {
  const placed: { glitch: GlitchSummary; x: number; y: number }[] = []
  for (const d of DISTRICTS) {
    const slots = MAP.districts[d].markers
    glitches
      .filter((g) => g.district === d)
      .sort((a, b) => a.glitchId.localeCompare(b.glitchId))
      .forEach((glitch, i) => {
        const [x, y] = slots[i % slots.length]
        placed.push({ glitch, x, y })
      })
  }
  return placed
}

/** Full map of Achrona: generated terrain + live glitch markers. */
export function WorldMap({ glitches }: { glitches: GlitchSummary[] }) {
  const open = glitches.filter((g) => g.status !== 'FIXED')
  const markers = placeMarkers(open)

  return (
    <div className="map-fit">
      <div className="achrona-map map-stage relative">
        <Terrain />
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full">
          {markers.map(({ glitch, x, y }) => (
            <g key={glitch.glitchId} transform={`translate(${x} ${y})`} aria-label={`${glitch.glitchId}, ${glitch.status}`}>
              <circle r="8" fill={STATUS_HEX[glitch.status]} stroke="white" strokeWidth="2.5" />
            </g>
          ))}
          {DISTRICTS.map((d: District) => {
            const [x, y] = MAP.districts[d].label
            return (
              <text key={d} x={x} y={y} textAnchor="middle" className="map-label font-map">
                {MAP.districts[d].name}
              </text>
            )
          })}
        </svg>
        <MapAtmosphere />
      </div>
    </div>
  )
}
