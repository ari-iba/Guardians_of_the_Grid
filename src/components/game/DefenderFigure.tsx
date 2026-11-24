/** A small drawn defender: colours (and helmet vs. hood) derived from the guardian id, so always the same. */

function hash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

export function figureTraits(guardianId: string) {
  const h = hash(guardianId)
  return {
    hue: h % 360,
    helmet: (h >> 9) % 2 === 0,
    skin: ['#f5d0a9', '#e0ac7e', '#c68a5b', '#8d5a3b'][(h >> 4) % 4],
  }
}

/**
 * The figure as an SVG group, drawn around (0, 0) = the feet. About 24 × 30 units.
 * Use it inside any <svg> (map overlay) or through <DefenderFigure> as a standalone icon.
 */
export function FigureGlyph({ guardianId }: { guardianId: string }) {
  const { hue, helmet, skin } = figureTraits(guardianId)
  const main = `hsl(${hue} 72% 52%)`
  const dark = `hsl(${hue} 60% 34%)`
  const light = `hsl(${hue} 85% 72%)`
  return (
    <g>
      <ellipse cx="0" cy="1" rx="7.5" ry="2" fill="black" opacity="0.22" />
      {/* legs + boots */}
      <rect x="-4.4" y="-7" width="3.4" height="7.5" rx="1.2" fill={dark} />
      <rect x="1" y="-7" width="3.4" height="7.5" rx="1.2" fill={dark} />
      {/* cape */}
      <path d="M-6.5,-16 L-8.5,-5 L8.5,-5 L6.5,-16 Z" fill={dark} opacity="0.85" />
      {/* tunic */}
      <path d="M-6.5,-6 Q-7,-17 0,-17.5 Q7,-17 6.5,-6 Z" fill={main} stroke={dark} strokeWidth="0.8" />
      <path d="M0,-14.5 L1.2,-12 L3.8,-11.8 L1.8,-10.1 L2.4,-7.5 L0,-8.9 L-2.4,-7.5 L-1.8,-10.1 L-3.8,-11.8 L-1.2,-12 Z" fill={light} />
      {/* arms */}
      <rect x="-9.4" y="-16" width="3" height="8.5" rx="1.5" fill={main} stroke={dark} strokeWidth="0.6" />
      <rect x="6.4" y="-16" width="3" height="8.5" rx="1.5" fill={main} stroke={dark} strokeWidth="0.6" />
      {/* head */}
      <circle cx="0" cy="-22" r="5.6" fill={skin} stroke="rgb(0 0 0 / 0.25)" strokeWidth="0.6" />
      {helmet ? (
        <path d="M-6.1,-22.5 A6.1 6.1 0 0 1 6.1,-22.5 L6.1,-21.4 L-6.1,-21.4 Z M-1,-29.5 L1,-29.5 L0.6,-27.6 L-0.6,-27.6 Z" fill={light} stroke={dark} strokeWidth="0.7" />
      ) : (
        <path d="M-6.4,-20 Q-6.8,-29.5 0,-29.2 Q6.8,-29.5 6.4,-20 Q4.5,-25.5 0,-25.6 Q-4.5,-25.5 -6.4,-20 Z" fill={dark} />
      )}
      <circle cx="-2" cy="-21.6" r="0.95" fill="#1f1235" />
      <circle cx="2" cy="-21.6" r="0.95" fill="#1f1235" />
    </g>
  )
}

/** Standalone figure (squad bar, landing animation). */
export function DefenderFigure({
  guardianId,
  className = '',
  title,
}: {
  guardianId: string
  className?: string
  title?: string
}) {
  return (
    <svg viewBox="-12 -32 24 35" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <FigureGlyph guardianId={guardianId} />
    </svg>
  )
}
