import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Layers, Minus, Plus, RotateCcw } from 'lucide-react'
import { DistrictPanel } from '#/components/map/DistrictPanel.tsx'
import { Clouds, Effects, Storm, prefersReducedMotion, useMarkerChanges } from '#/components/map/MapEffects.tsx'
import { MapAtmosphere } from '#/components/map/MapAtmosphere.tsx'
import { Terrain } from '#/components/map/Terrain.tsx'
import { usePanZoom } from '#/components/map/usePanZoom.ts'
import { magicColor } from '#/components/MagicGauge.tsx'
import { STATUS_HEX } from '#/components/ui/StatusBadge.tsx'
import { DISTRICTS, DISTRICT_LABELS, type District } from '#/lib/district.ts'
import { GLITCH_STATUSES, type GlitchSummary } from '#/lib/glitch.ts'
import type { Guardian } from '#/lib/guardian.ts'
import { MAP, polygonPath } from '#/lib/map-geometry.ts'

const { width: W, height: H } = MAP
/** Below this zoom (relative to "fit"), busy districts collapse into one numbered marker. */
const CLUSTER_BELOW_ZOOM = 1.5
const CLUSTER_MIN = 3
const MARKER_R = 8 // screen px

type Layer = 'glitches' | 'heatmap' | 'roads' | 'labels'
const LAYER_LABELS: Record<Layer, string> = { glitches: 'Glitches', heatmap: 'Sensor heatmap', roads: 'Roads', labels: 'Labels' }
const DEFAULT_LAYERS: Record<Layer, boolean> = { glitches: true, heatmap: false, roads: true, labels: true }
const LAYERS_KEY = 'gotg-map-layers'

/** Small string hash → slot index, so a glitch keeps its spot when others come and go. */
function hashSlot(id: string, n: number): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (h >>> 0) % n
}

/**
 * Each glitch gets one of its district's pre-computed marker slots. The slot comes from the
 * glitch id (collisions move to the next free slot), so markers don't jump around.
 */
export function placeMarkers(glitches: GlitchSummary[]) {
  const placed: { glitch: GlitchSummary; x: number; y: number }[] = []
  for (const d of DISTRICTS) {
    const slots = MAP.districts[d].markers
    const used = new Set<number>()
    glitches
      .filter((g) => g.district === d)
      .sort((a, b) => a.glitchId.localeCompare(b.glitchId))
      .forEach((glitch) => {
        let slot = hashSlot(glitch.glitchId, slots.length)
        for (let tries = 0; used.has(slot) && tries < slots.length; tries++) slot = (slot + 1) % slots.length
        used.add(slot)
        const [x, y] = slots[slot]
        placed.push({ glitch, x, y })
      })
  }
  return placed
}

function useLayers() {
  const [layers, setLayers] = useState(DEFAULT_LAYERS)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYERS_KEY)
      if (saved) setLayers({ ...DEFAULT_LAYERS, ...JSON.parse(saved) })
    } catch {
      /* ignore */
    }
  }, [])
  const toggle = (layer: Layer) =>
    setLayers((current) => {
      const next = { ...current, [layer]: !current[layer] }
      try {
        localStorage.setItem(LAYERS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  return [layers, toggle] as const
}

type WorldMapProps = {
  glitches: GlitchSummary[]
  magic: Record<District, number>
  guardian: Guardian
  defenders: Guardian[]
  /** Shown top-left (e.g. the REPLAY badge). */
  badge?: ReactNode
  /** False while replaying history: no ripples, nudges or star bursts. */
  live?: boolean
  /** Lockdown: red storm over the districts with open glitches. */
  lockdown?: boolean
}

/** Interactive map of Achrona: pan/zoom, markers, clusters, district panel, layers. */
export function WorldMap({ glitches, magic, guardian, defenders, badge, live = true, lockdown = false }: WorldMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const { view, zoom, animating, dragged, zoomBy, reset, nudgeTo, handlers } = usePanZoom(viewportRef, W, H)
  const [layers, toggleLayer] = useLayers()
  const [layersOpen, setLayersOpen] = useState(false)
  const [hover, setHover] = useState<{ district: District; x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<{ district: District; glitchId: string | null } | null>(null)

  const open = useMemo(() => glitches.filter((g) => g.status !== 'FIXED'), [glitches])
  const openBy = useMemo(() => {
    const map = new Map<District, GlitchSummary[]>()
    for (const g of open) map.set(g.district, [...(map.get(g.district) ?? []), g])
    return map
  }, [open])
  const clustered = (d: District) => zoom < CLUSTER_BELOW_ZOOM && (openBy.get(d)?.length ?? 0) >= CLUSTER_MIN
  const markers = useMemo(() => placeMarkers(open), [open])

  // New glitch → ripple + a short camera nudge towards its district (unless the user is busy).
  const { ripples, bursts, healed, exits } = useMarkerChanges(markers, glitches, live, (district) => {
    if (selected || prefersReducedMotion()) return
    const [x, y] = MAP.districts[district].capital
    nudgeTo(x, y, 0.3)
  })
  const stormDistricts = lockdown && live ? DISTRICTS.filter((d) => (openBy.get(d)?.length ?? 0) > 0) : []

  const k = view.k || 1
  const screen = (x: number, y: number) => ({ left: view.tx + x * k, top: view.ty + y * k })
  const select = (district: District, glitchId: string | null = null) => {
    setSelected({ district, glitchId })
    setHover(null)
  }

  const pointerToLocal = (e: React.PointerEvent) => {
    const rect = viewportRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  return (
    <div
      ref={viewportRef}
      className={`achrona-map map-viewport relative size-full touch-none overflow-hidden select-none ${
        layers.roads ? '' : 'map-hide-roads'
      } ${layers.labels ? '' : 'map-hide-labels'}`}
      {...handlers}
      onClickCapture={(e) => {
        // A drag ends with a click; don't treat it as one.
        if (dragged.current) {
          e.stopPropagation()
          dragged.current = false
        }
      }}
      role="application"
      aria-label="Map of Achrona. Drag to pan, scroll or pinch to zoom, Tab to move between districts."
    >
      {/* World layer: terrain + overlays in map units, moved with one transform. */}
      <div
        className={`map-world absolute top-0 left-0 origin-top-left ${animating ? 'map-world-animate' : ''}`}
        style={{ width: W, height: H, transform: `translate3d(${view.tx}px, ${view.ty}px, 0) scale(${k})`, visibility: view.k ? 'visible' : 'hidden' }}
      >
        <Terrain />
        <Clouds />
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="absolute inset-0 overflow-visible">
          {stormDistricts.length > 0 && <Storm districts={stormDistricts} />}
          {/* Sensor heatmap: districts coloured by their latest magic reading. */}
          {layers.heatmap && (
            <g clipPath="url(#m-land-clip)" pointerEvents="none">
              {DISTRICTS.map((d) => (
                <path key={d} d={polygonPath(MAP.districts[d].polygon)} fill={magicColor(magic[d] ?? 80)} opacity="0.42" />
              ))}
            </g>
          )}

          {/* Districts: hover highlight, click/Enter opens the panel. */}
          <g clipPath="url(#m-land-clip)">
            {DISTRICTS.map((d) => {
              const active = hover?.district === d || selected?.district === d
              const count = openBy.get(d)?.length ?? 0
              return (
                <path
                  key={d}
                  d={polygonPath(MAP.districts[d].polygon)}
                  className={`map-district ${active ? 'is-active' : ''}`}
                  strokeWidth={3 / k}
                  pointerEvents="all"
                  tabIndex={0}
                  role="button"
                  aria-label={`${DISTRICT_LABELS[d]}: ${count} open glitch${count === 1 ? '' : 'es'}, magic ${magic[d] ?? '?'}%`}
                  onPointerMove={(e) => setHover({ district: d, ...pointerToLocal(e) })}
                  onPointerLeave={() => setHover((h) => (h?.district === d ? null : h))}
                  onFocus={() => {
                    const p = screen(...MAP.districts[d].label)
                    setHover({ district: d, x: p.left, y: p.top })
                  }}
                  onBlur={() => setHover(null)}
                  onClick={() => select(d)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      select(d)
                    }
                  }}
                />
              )
            })}
          </g>

          {layers.glitches && (
            <g>
              {markers
                .filter(({ glitch }) => !clustered(glitch.district))
                .map(({ glitch, x, y }) => (
                  <g
                    key={glitch.glitchId}
                    transform={`translate(${x} ${y}) scale(${1 / k})`}
                    className="map-marker"
                    data-glitch-marker={glitch.glitchId}
                    tabIndex={0}
                    role="button"
                    aria-label={`${glitch.glitchId}, ${glitch.status}${glitch.source === 'auto' ? ', auto-detected' : ''}: ${glitch.description} (${DISTRICT_LABELS[glitch.district]})`}
                    onClick={() => select(glitch.district, glitch.glitchId)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select(glitch.district, glitch.glitchId))}
                  >
                    <g className="marker-in">
                      <MarkerGlyph glitch={glitch} />
                    </g>
                  </g>
                ))}
              {exits.map(({ glitch, x, y }) => (
                <g key={`exit-${glitch.glitchId}`} transform={`translate(${x} ${y}) scale(${1 / k})`} pointerEvents="none">
                  <g className="marker-out">
                    <MarkerGlyph glitch={glitch} />
                  </g>
                </g>
              ))}
              {DISTRICTS.filter(clustered).map((d) => {
                const list = openBy.get(d)!
                const worst = GLITCH_STATUSES.find((s) => list.some((g) => g.status === s))!
                const [x, y] = MAP.districts[d].capital
                return (
                  <g
                    key={d}
                    transform={`translate(${x} ${y + 40}) scale(${1 / k})`}
                    className="map-marker"
                    tabIndex={0}
                    role="button"
                    aria-label={`${list.length} open glitches in ${DISTRICT_LABELS[d]}`}
                    onClick={() => select(d)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select(d))}
                  >
                    {worst === 'LEAKED' && <circle r="16" fill={STATUS_HEX.LEAKED} className="map-pulse" />}
                    <circle r="16" fill={STATUS_HEX[worst]} stroke="white" strokeWidth="3" />
                    <text y="5" textAnchor="middle" className="fill-white text-[14px] font-bold">
                      {list.length}
                    </text>
                    {list.some((g) => g.source === 'auto') && (
                      <text x="14" y="-10" fontSize="11">🤖</text>
                    )}
                  </g>
                )
              })}
            </g>
          )}
          <Effects ripples={ripples} bursts={bursts} healed={healed} k={k} />
        </svg>
      </div>

      {/* Labels in screen space: they move with the map but never grow huge. */}
      {layers.labels && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {DISTRICTS.map((d) => {
            const p = screen(...MAP.districts[d].label)
            return (
              <span
                key={d}
                className="map-district-label font-map absolute -translate-x-1/2 -translate-y-full whitespace-nowrap"
                style={{ left: p.left, top: p.top, fontSize: Math.min(17, Math.max(10, 13 * Math.sqrt(zoom))) }}
              >
                {DISTRICT_LABELS[d]}
              </span>
            )
          })}
        </div>
      )}

      <MapAtmosphere />

      {/* Hover tooltip */}
      {hover && !selected && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 w-52 -translate-x-1/2 -translate-y-[calc(100%+16px)] rounded-xl border border-line bg-card/95 p-3 text-sm shadow-xl backdrop-blur"
          style={{ left: hover.x, top: hover.y }}
        >
          <p className="font-map font-bold text-fg">{DISTRICT_LABELS[hover.district]}</p>
          <p className="mt-1 text-muted">
            <strong className="text-fg">{openBy.get(hover.district)?.length ?? 0}</strong> open glitches
          </p>
          <p className="text-muted">
            Magic <strong style={{ color: magicColor(magic[hover.district] ?? 80) }}>{magic[hover.district] ?? '?'}%</strong>
          </p>
          <p className="mt-1 text-xs text-muted">Click for details</p>
        </div>
      )}

      {badge && <div className="pointer-events-none absolute top-3 left-3 z-10">{badge}</div>}

      {/* Controls */}
      <div
        className={`absolute top-3 right-3 z-20 flex flex-col gap-2 transition-[right] duration-300 ${selected ? 'md:right-[25.5rem]' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-card/90 shadow-lg backdrop-blur">
          <MapButton label="Zoom in" onClick={() => zoomBy(1.5)}><Plus className="size-4" /></MapButton>
          <MapButton label="Zoom out" onClick={() => zoomBy(1 / 1.5)}><Minus className="size-4" /></MapButton>
          <MapButton label="Reset view" onClick={reset}><RotateCcw className="size-4" /></MapButton>
        </div>
        <div className="relative">
          <MapButton label="Layers" onClick={() => setLayersOpen((o) => !o)} pressed={layersOpen} standalone>
            <Layers className="size-4" />
          </MapButton>
          {layersOpen && (
            <fieldset className="absolute top-0 right-12 w-48 rounded-xl border border-line bg-card/95 p-3 text-sm shadow-xl backdrop-blur">
              <legend className="sr-only">Map layers</legend>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Layers</p>
              {(Object.keys(LAYER_LABELS) as Layer[]).map((layer) => (
                <label key={layer} className="flex cursor-pointer items-center gap-2 py-1 text-fg">
                  <input type="checkbox" checked={layers[layer]} onChange={() => toggleLayer(layer)} className="accent-[var(--accent)]" />
                  {LAYER_LABELS[layer]}
                </label>
              ))}
            </fieldset>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col gap-1.5 rounded-xl border border-line bg-card/85 px-3 py-2 text-[11px] text-fg shadow backdrop-blur">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {GLITCH_STATUSES.filter((s) => s !== 'FIXED').map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-full ring-2 ring-white/80" style={{ background: STATUS_HEX[s] }} /> {s}
            </span>
          ))}
          <span>🤖 auto-detected</span>
        </div>
        {layers.heatmap && (
          <div className="flex items-center gap-2">
            <span>Magic</span>
            <span className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${magicColor(0)}, ${magicColor(50)}, ${magicColor(100)})` }} />
            <span>0 → 100%</span>
          </div>
        )}
      </div>

      {selected && (
        <DistrictPanel
          district={selected.district}
          glitches={glitches}
          magic={magic[selected.district]}
          guardian={guardian}
          defenders={defenders}
          highlightId={selected.glitchId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function MarkerGlyph({ glitch }: { glitch: GlitchSummary }) {
  return (
    <>
      <circle r={MARKER_R + 8} fill="transparent" />
      {glitch.status === 'LEAKED' && <circle r={MARKER_R} fill={STATUS_HEX.LEAKED} className="map-pulse" />}
      <circle r={MARKER_R} fill={STATUS_HEX[glitch.status]} stroke="white" strokeWidth="2.5" className="map-marker-dot" />
      {glitch.source === 'auto' && (
        <g transform="translate(8 -8)">
          <circle r="7" fill="var(--card)" stroke="var(--line)" />
          <text y="3" textAnchor="middle" fontSize="8">
            🤖
          </text>
        </g>
      )}
    </>
  )
}

function MapButton({
  label,
  onClick,
  children,
  pressed,
  standalone,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  pressed?: boolean
  standalone?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`flex size-10 items-center justify-center text-fg transition hover:bg-subtle ${
        standalone ? 'rounded-xl border border-line bg-card/90 shadow-lg backdrop-blur' : 'border-b border-line last:border-b-0'
      } ${pressed ? 'bg-subtle' : ''}`}
    >
      {children}
    </button>
  )
}
