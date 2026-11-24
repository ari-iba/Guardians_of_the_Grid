import { useEffect, useMemo } from 'react'

const COLORS = ['#22d3ee', '#e879f9', '#facc15', '#34d399', '#f472b6', '#fff']

/** Fullscreen level-up moment with confetti. Click, Esc or 4 s closes it. */
export function LevelUpOverlay({ level, title, onClose }: { level: number; title: string; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, 4200)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const confetti = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 2.2 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 220,
        spin: 360 + Math.random() * 720,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.round(Math.random() * 6),
      })),
    [],
  )

  return (
    <div
      role="alertdialog"
      aria-label={`Level up! Level ${level} — ${title}`}
      onClick={onClose}
      className="levelup-screen fixed inset-0 z-[95] flex cursor-pointer flex-col items-center justify-center gap-5 overflow-hidden bg-black/75 px-6 text-center backdrop-blur-sm"
    >
      {confetti.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="confetti"
          style={
            {
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 0.6,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              '--drift': `${c.drift}px`,
              '--spin': `${c.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
      <p className="levelup-pop font-pixel text-3xl text-neon-gold sm:text-5xl" style={{ textShadow: '0 0 18px #facc15, 0 4px 0 #000' }}>
        LEVEL UP!
      </p>
      <p className="levelup-pop font-pixel text-sm leading-relaxed text-white sm:text-lg" style={{ animationDelay: '0.25s' }}>
        Level {level} — {title}
      </p>
      <p className="text-sm text-white/60">Click anywhere to continue</p>
    </div>
  )
}
