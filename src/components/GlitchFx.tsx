import { useEffect, useState } from 'react'

const DURATION = 600

/**
 * Full-screen glitch: RGB split + shake on the app (via `html.glitching`), scanlines and torn
 * colour bands on top. Plays for 600 ms every time `trigger` increases.
 * prefers-reduced-motion keeps only a short static flash (see styles.css).
 */
export function GlitchFx({ trigger }: { trigger: number }) {
  const [active, setActive] = useState(false)
  const [bands, setBands] = useState<{ top: number; height: number; hue: number }[]>([])

  useEffect(() => {
    if (trigger === 0) return
    setBands(
      Array.from({ length: 6 }, () => ({
        top: Math.random() * 95,
        height: 1 + Math.random() * 6,
        hue: Math.random() < 0.5 ? 190 : 340,
      })),
    )
    setActive(true)
    document.documentElement.classList.add('glitching')
    const id = setTimeout(() => {
      setActive(false)
      document.documentElement.classList.remove('glitching')
    }, DURATION)
    return () => {
      clearTimeout(id)
      document.documentElement.classList.remove('glitching')
    }
  }, [trigger])

  if (!active) return null
  return (
    <div aria-hidden className="glitch-overlay">
      {bands.map((b, i) => (
        <span
          key={i}
          className="glitch-band"
          style={{ top: `${b.top}%`, height: `${b.height}%`, background: `hsl(${b.hue} 100% 60% / 0.28)`, animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  )
}
