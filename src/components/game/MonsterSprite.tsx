import { useMemo } from 'react'
import type { GlitchStatus, GlitchSummary } from '#/lib/glitch.ts'
import { monsterTraits } from '#/lib/monster.ts'

const CX = 50
const CY = 57

/** Smooth closed blob through points around the centre. */
function blobPath(radii: number[], base: number): string {
  const pts = radii.map((f, i) => {
    const a = (i / radii.length) * Math.PI * 2 - Math.PI / 2
    return [CX + Math.cos(a) * base * f, CY + Math.sin(a) * base * f * 0.95] as const
  })
  const mid = (p: readonly number[], q: readonly number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const start = mid(pts[pts.length - 1], pts[0])
  let d = `M ${start[0].toFixed(1)} ${start[1].toFixed(1)}`
  pts.forEach((p, i) => {
    const m = mid(p, pts[(i + 1) % pts.length])
    d += ` Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`
  })
  return `${d} Z`
}

/**
 * A generated creature for a glitch. Shape, colour, eyes, mouth and horns come from the
 * glitch id (always the same monster); the expression follows the status.
 */
export function MonsterSprite({
  glitch,
  status = glitch.status,
  className = '',
  title,
}: {
  glitch: Pick<GlitchSummary, 'glitchId' | 'district' | 'metric' | 'status'>
  status?: GlitchStatus
  className?: string
  title?: string
}) {
  const t = useMemo(() => monsterTraits(glitch), [glitch.glitchId, glitch.district, glitch.metric])
  const body = `hsl(${t.hue} 78% 56%)`
  const shade = `hsl(${t.hue} 70% 38%)`
  const ink = `hsl(${t.hue} 55% 14%)`
  const angry = status === 'LEAKED'
  const dizzy = status === 'CONTAINING'

  const eyeY = t.eyes === 3 ? 50 : 51
  const eyes =
    t.eyes === 1
      ? [{ x: 50, y: eyeY, r: 10 * t.eyeSize }]
      : t.eyes === 2
        ? [
            { x: 39, y: eyeY, r: 7 * t.eyeSize },
            { x: 61, y: eyeY, r: 7 * t.eyeSize },
          ]
        : [
            { x: 35, y: eyeY + 2, r: 5.5 * t.eyeSize },
            { x: 50, y: eyeY - 5, r: 6 * t.eyeSize },
            { x: 65, y: eyeY + 2, r: 5.5 * t.eyeSize },
          ]

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title} overflow="visible">
      {title && <title>{title}</title>}
      {/* Shadow on the arena floor */}
      <ellipse cx={50} cy={93} rx={26} ry={4} fill="rgb(0 0 0 / 0.28)" />

      <g transform={`rotate(${t.tilt} ${CX} ${CY})`}>
        {/* Topper */}
        {t.topper === 'horns' && (
          <g fill={shade} stroke={ink} strokeWidth={2.5} strokeLinejoin="round">
            <path d="M 34 36 Q 24 22 30 10 Q 36 24 44 31 Z" />
            <path d="M 66 36 Q 76 22 70 10 Q 64 24 56 31 Z" />
          </g>
        )}
        {t.topper === 'antennae' && (
          <g stroke={ink} strokeWidth={2.5} strokeLinecap="round">
            <path d="M 43 32 Q 40 20 33 13" fill="none" />
            <path d="M 57 32 Q 60 20 67 13" fill="none" />
            <circle cx={33} cy={12} r={4} fill="var(--neon-gold, #facc15)" />
            <circle cx={67} cy={12} r={4} fill="var(--neon-gold, #facc15)" />
          </g>
        )}
        {t.topper === 'spikes' && (
          <g fill={shade} stroke={ink} strokeWidth={2.5} strokeLinejoin="round">
            <path d="M 36 34 L 38 20 L 45 30 Z" />
            <path d="M 45 30 L 50 15 L 55 30 Z" />
            <path d="M 55 30 L 62 20 L 64 34 Z" />
          </g>
        )}

        {/* Feet */}
        {Array.from({ length: t.feet }, (_, i) => {
          const x = 50 + (i - (t.feet - 1) / 2) * (36 / t.feet) * 1.4
          return <ellipse key={i} cx={x} cy={86} rx={7} ry={5} fill={shade} stroke={ink} strokeWidth={2.5} />
        })}

        {/* Body */}
        <path d={blobPath(t.body, 30)} fill={body} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <path d={blobPath(t.body.map((f) => f * 0.62), 30)} fill={shade} opacity={0.35} transform="translate(0 9)" />
        <ellipse cx={38} cy={38} rx={9} ry={5} fill="#fff" opacity={0.35} transform="rotate(-25 38 38)" />

        {/* Eyes */}
        {eyes.map((e, i) => (
          <g key={i}>
            <circle cx={e.x} cy={e.y} r={e.r} fill="#fff" stroke={ink} strokeWidth={2} />
            {dizzy ? (
              <path
                d={`M ${e.x - e.r * 0.45} ${e.y - e.r * 0.45} L ${e.x + e.r * 0.45} ${e.y + e.r * 0.45} M ${e.x + e.r * 0.45} ${e.y - e.r * 0.45} L ${e.x - e.r * 0.45} ${e.y + e.r * 0.45}`}
                stroke={ink}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            ) : (
              <>
                <circle cx={e.x + e.r * 0.15} cy={e.y + e.r * 0.1} r={e.r * 0.5} fill={ink} />
                <circle cx={e.x + e.r * 0.3} cy={e.y - e.r * 0.15} r={e.r * 0.16} fill="#fff" />
              </>
            )}
            {angry && (
              <path
                d={`M ${e.x - e.r} ${e.y - e.r - 2 - (e.x < 50 ? 0 : 4)} L ${e.x + e.r} ${e.y - e.r - 2 - (e.x < 50 ? 4 : 0)}`}
                stroke={ink}
                strokeWidth={3}
                strokeLinecap="round"
              />
            )}
          </g>
        ))}

        {/* Mouth */}
        {t.mouth === 'fangs' && (
          <g stroke={ink} strokeWidth={2.2} strokeLinejoin="round">
            <path d="M 38 68 Q 50 75 62 68" fill="none" strokeLinecap="round" />
            <path d="M 42 69.5 L 44.5 76 L 47 71.5 Z" fill="#fff" />
            <path d="M 53 71.5 L 55.5 76 L 58 69.5 Z" fill="#fff" />
          </g>
        )}
        {t.mouth === 'grin' && (
          <path
            d={dizzy ? 'M 40 72 Q 45 68 50 72 Q 55 76 60 72' : 'M 38 67 Q 50 80 62 67 Z'}
            fill={dizzy ? 'none' : ink}
            stroke={ink}
            strokeWidth={2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {t.mouth === 'o' && <ellipse cx={50} cy={71} rx={5} ry={dizzy ? 3 : 6} fill={ink} />}

        {/* Sweat drop when it's being contained */}
        {dizzy && <path d="M 78 40 Q 74 47 78 50 Q 82 47 78 40 Z" fill="#7dd3fc" stroke={ink} strokeWidth={1.5} />}
      </g>
    </svg>
  )
}
