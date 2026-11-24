// Typed access to the generated map geometry (src/lib/map-geometry.json, made by `npm run map:generate`).
import raw from './map-geometry.json'
import type { District } from './district.ts'

export type MapPoint = [number, number]

export type DistrictGeometry = {
  name: string
  /** District capital (icon position). */
  capital: MapPoint
  label: MapPoint
  /** Voronoi cell; clip with the land (#m-land-clip) to get the district on land. */
  polygon: MapPoint[]
  /** Spread-out positions for glitch markers inside the district, nearest to the capital first. */
  markers: MapPoint[]
}

export const MAP = raw as unknown as {
  width: number
  height: number
  seed: number
  districts: Record<District, DistrictGeometry>
}

export const polygonPath = (points: MapPoint[]) => `M${points.map(([x, y]) => `${x},${y}`).join('L')}Z`
