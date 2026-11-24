import { useEffect, useState } from 'react'

const KEY = 'gotg-boot'
const DURATION = 2000

/** Called after a successful login: queue the boot sequence, unless it already ran this session. */
export function queueBootSequence(): void {
  try {
    if (sessionStorage.getItem(KEY) !== 'done') sessionStorage.setItem(KEY, 'pending')
  } catch {
    /* storage unavailable: just skip the intro */
  }
}

function takePendingBoot(): boolean {
  try {
    if (sessionStorage.getItem(KEY) !== 'pending') return false
    sessionStorage.setItem(KEY, 'done')
    return true
  } catch {
    return false
  }
}

/** 2 s terminal intro after login. Click or Esc skips it. */
export function BootSequence({ codename }: { codename: string }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [visible, setVisible] = useState(0)

  const lines = [
    'Initializing the Grid…',
    'Syncing timelines…',
    'Calibrating ley-line sensors…',
    `Guardian ${codename} authenticated ✓`,
  ]

  useEffect(() => {
    if (takePendingBoot()) setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const step = (DURATION - 400) / lines.length
    const timers = reduced
      ? [setTimeout(() => setVisible(lines.length), 0)]
      : lines.map((_, i) => setTimeout(() => setVisible(i + 1), 120 + i * step))
    const close = () => {
      setClosing(true)
      timers.push(setTimeout(() => setOpen(false), 300))
    }
    timers.push(setTimeout(close, DURATION))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('keydown', onKey)
    }
  }, [open]) // lines only change with the codename, which is fixed while open

  if (!open) return null
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => {
        setClosing(true)
        setTimeout(() => setOpen(false), 300)
      }}
      className={`boot-screen fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-[#07051a] px-6 transition-opacity duration-300 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="w-full max-w-lg font-mono text-sm text-emerald-300 sm:text-base">
        <p className="mb-4 text-xs tracking-[0.3em] text-violet-300/80 uppercase">Achrona mission control · v7.0</p>
        {lines.slice(0, visible).map((line, i) => (
          <p key={line} className={`boot-line ${i === lines.length - 1 ? 'font-bold text-white' : ''}`}>
            <span className="text-violet-400">&gt; </span>
            {line}
          </p>
        ))}
        {visible < lines.length && <span className="boot-cursor">▋</span>}
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="boot-progress h-full bg-linear-to-r from-violet-500 to-emerald-400" />
        </div>
        <p className="mt-4 text-xs text-white/40">Click or press Esc to skip</p>
      </div>
    </div>
  )
}
