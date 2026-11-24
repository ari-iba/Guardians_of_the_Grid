import { memo } from 'react'
import terrainSvg from '#/assets/achrona-map.svg?raw'

/**
 * The generated terrain (src/assets/achrona-map.svg), inlined so its colours follow the
 * --mp-* CSS variables of the current theme. Static: it never re-renders.
 */
export const Terrain = memo(function Terrain({ className = '' }: { className?: string }) {
  return <div className={`map-terrain ${className}`} dangerouslySetInnerHTML={{ __html: terrainSvg }} />
})
