import { memo } from 'react'

/**
 * Screen-space overlays on top of the map (they don't move with pan/zoom, so the
 * expensive filters render once):
 * - parchment: paper grain via feTurbulence + yellowed vignette (light theme)
 * - hologram: scanlines + edge glow (dark theme)
 * Which ones show is decided in CSS by the theme.
 */
export const MapAtmosphere = memo(function MapAtmosphere() {
  return (
    <div aria-hidden className="map-atmosphere pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="map-paper absolute inset-0 size-full">
        <filter id="map-paper-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.31  0 0 0 0 0.16  0 0 0 0.55 -0.05" />
        </filter>
        <filter id="map-paper-stains" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="3" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.4  0 0 0 0 0.18  0 0 0 0.7 -0.32" />
        </filter>
        <rect width="100%" height="100%" filter="url(#map-paper-stains)" />
        <rect width="100%" height="100%" filter="url(#map-paper-grain)" />
      </svg>
      <div className="map-vignette absolute inset-0" />
      <div className="map-scanlines absolute inset-0" />
    </div>
  )
})
