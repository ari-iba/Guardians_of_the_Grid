import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Siren, Star, Trophy, Waves, X } from 'lucide-react'
import { Avatar } from '#/components/game/MonsterCard.tsx'
import type { ToastTone } from '#/components/Toaster.tsx'
import { useNow } from '#/lib/app-ui.ts'
import { DISTRICT_LABELS, type District } from '#/lib/district.ts'
import type { GlitchSummary } from '#/lib/glitch.ts'
import { startSimulatedAttack } from '#/lib/sensors.functions.ts'
import { playAlarm, playBeep, playLevelUp } from '#/lib/sound.ts'

const ACTIVE_KEY = 'gotg-wave'
const COUNT_KEY = 'gotg-wave-count'
/** Give the sensors time to crash before a wave can be "cleared". */
const MIN_WAVE_MS = 30_000
/** A wave nobody finishes is dropped after this. */
const MAX_WAVE_MS = 30 * 60_000

type ActiveWave = { n: number; startedAt: number; districts: District[] }
type WaveReport = { n: number; seconds: number; defeated: number; mvp: string | null; stars: 1 | 2 | 3 }

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

/** ≤ 3 min = 3 stars, ≤ 8 min = 2, slower = 1. */
export function waveStars(seconds: number): 1 | 2 | 3 {
  return seconds <= 180 ? 3 : seconds <= 480 ? 2 : 1
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Monsters that spawned during this wave: auto-detected glitches since it started. */
const waveMonsters = (glitches: GlitchSummary[], wave: ActiveWave) =>
  glitches.filter((g) => g.source === 'auto' && Date.parse(g.timestamp) >= wave.startedAt - 2000)

/**
 * "Simulate attack" as a wave: 3-2-1 countdown, siren banner, then the wave is tracked until
 * every monster that spawned is defeated, followed by a report (time, MVP, 1–3 stars).
 */
export function useWaveDirector(glitches: GlitchSummary[], notify: (message: string, tone?: ToastTone) => void) {
  const router = useRouter()
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'incoming'>('idle')
  const [count, setCount] = useState(3)
  const [active, setActive] = useState<ActiveWave | null>(null)
  const [report, setReport] = useState<WaveReport | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    setActive(load<ActiveWave>(ACTIVE_KEY))
    return () => timers.current.forEach(clearTimeout)
  }, [])

  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms))

  const startWave = useCallback(() => {
    if (phase !== 'idle') return
    setPhase('countdown')
    setCount(3)
    playBeep()
    later(1000, () => {
      setCount(2)
      playBeep()
    })
    later(2000, () => {
      setCount(1)
      playBeep()
    })
    later(3000, async () => {
      playBeep(true)
      try {
        const { districts } = await startSimulatedAttack()
        const n = (load<number>(COUNT_KEY) ?? 0) + 1
        save(COUNT_KEY, n)
        const wave = { n, startedAt: Date.now(), districts: districts as District[] }
        save(ACTIVE_KEY, wave)
        setActive(wave)
        setReport(null)
        setPhase('incoming')
        playAlarm()
        await router.invalidate()
        if (districts.length === 0) notify('Every district is already under attack', 'warning')
        later(3200, () => setPhase('idle'))
      } catch (err) {
        setPhase('idle')
        notify(err instanceof Error ? err.message : 'Could not start the wave.', 'danger')
      }
    })
  }, [phase, router, notify])

  const abandon = () => {
    save(ACTIVE_KEY, null)
    setActive(null)
  }

  // Is the wave over? Every monster that spawned has been defeated.
  useEffect(() => {
    if (!active) return
    const elapsed = Date.now() - active.startedAt
    if (elapsed > MAX_WAVE_MS) return abandon()
    const monsters = waveMonsters(glitches, active)
    if (elapsed < MIN_WAVE_MS || monsters.length === 0 || monsters.some((g) => g.status !== 'FIXED')) return
    const clearedAt = Math.max(...monsters.map((g) => Date.parse(g.statusChangedAt)))
    const seconds = Math.max(1, Math.round((clearedAt - active.startedAt) / 1000))
    const fixes = new Map<string, number>()
    for (const g of monsters) if (g.assignedCodename) fixes.set(g.assignedCodename, (fixes.get(g.assignedCodename) ?? 0) + 1)
    const mvp = [...fixes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    setReport({ n: active.n, seconds, defeated: monsters.length, mvp, stars: waveStars(seconds) })
    playLevelUp()
    abandon()
  }, [glitches, active])

  const element = (
    <>
      {phase === 'countdown' && (
        <div role="alert" aria-label={`Wave starting in ${count}`} className="fixed inset-0 z-[96] flex flex-col items-center justify-center gap-6 bg-black/70 backdrop-blur-sm">
          <p className="font-pixel text-xs text-red-300 sm:text-sm">DESYNC WAVE IN</p>
          <span key={count} className="wave-count font-pixel text-8xl text-white sm:text-9xl">
            {count}
          </span>
        </div>
      )}
      {phase === 'incoming' && active && (
        <div role="alert" className="wave-siren fixed inset-x-0 top-1/3 z-[96] flex flex-col items-center gap-2 px-4 py-6 text-center text-white shadow-2xl">
          <p className="inline-flex items-center gap-3 font-pixel text-lg sm:text-3xl" style={{ textShadow: '0 4px 0 #000' }}>
            <Siren className="size-6 sm:size-8" /> WAVE {active.n} INCOMING
          </p>
          <p className="text-sm font-semibold text-white/90">
            {active.districts.length ? `Sensors crashing in ${active.districts.map((d) => DISTRICT_LABELS[d]).join(', ')}` : 'The Desync is stirring'} — monsters will spawn in seconds.
          </p>
        </div>
      )}
      {active && phase === 'idle' && <WaveChip wave={active} glitches={glitches} onAbandon={abandon} />}
      {report && <WaveReportDialog report={report} onClose={() => setReport(null)} />}
    </>
  )

  return { startWave, element }
}

function WaveChip({ wave, glitches, onAbandon }: { wave: ActiveWave; glitches: GlitchSummary[]; onAbandon: () => void }) {
  const now = useNow(1000)
  const monsters = waveMonsters(glitches, wave)
  const left = monsters.filter((g) => g.status !== 'FIXED').length
  return (
    <div
      title="Wave = a simulated Desync attack. Defeat (fix) every monster that spawned to clear it."
      className="fixed bottom-20 left-4 z-[60] md:bottom-4 flex items-center gap-3 rounded-2xl border border-red-500/60 bg-card-strong/95 px-3 py-2 shadow-xl backdrop-blur md:left-24"
    >
      <Waves className="size-5 text-red-500" />
      <span className="flex flex-col">
        <span className="font-pixel text-[10px] text-fg">WAVE {wave.n}</span>
        <span className="text-xs text-muted" suppressHydrationWarning>
          {monsters.length === 0 ? 'Monsters spawning…' : `${left} of ${monsters.length} monsters left`}
          {now !== null && ` · ${mmss((now - wave.startedAt) / 1000)}`}
        </span>
      </span>
      <button type="button" onClick={onAbandon} aria-label="Stop tracking this wave" title="Stop tracking this wave" className="rounded p-1 text-muted hover:bg-subtle hover:text-fg">
        <X className="size-4" />
      </button>
    </div>
  )
}

function WaveReportDialog({ report, onClose }: { report: WaveReport; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="wave-report-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-[var(--panel-border)] bg-card-strong p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-5 p-6 text-center">
        <p className="font-pixel text-[10px] text-neon-cyan">WAVE REPORT</p>
        <h2 id="wave-report-title" className="title-pixel text-xl text-neon-gold">
          WAVE {report.n} CLEARED!
        </h2>
        <div className="flex gap-2" aria-label={`${report.stars} of 3 stars`} title="Stars: 3 = cleared within 3 min, 2 = within 8 min, 1 = slower">
          {[1, 2, 3].map((i) => (
            <Star
              key={i}
              className={`star-pop size-12 ${i <= report.stars ? 'fill-neon-gold text-neon-gold' : 'text-line'}`}
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          ))}
        </div>
        <dl className="grid w-full grid-cols-3 gap-2">
          <div className="rounded-xl bg-panel p-2">
            <dt className="text-xs text-muted">Time</dt>
            <dd className="font-pixel text-sm">{mmss(report.seconds)}</dd>
          </div>
          <div className="rounded-xl bg-panel p-2">
            <dt className="text-xs text-muted">Defeated</dt>
            <dd className="font-pixel text-sm">{report.defeated}</dd>
          </div>
          <div className="rounded-xl bg-panel p-2">
            <dt className="text-xs text-muted">MVP</dt>
            <dd className="flex items-center justify-center gap-1 text-sm font-semibold">
              {report.mvp ? (
                <>
                  <Avatar codename={report.mvp} className="size-5 text-[7px]" /> {report.mvp}
                </>
              ) : (
                '–'
              )}
            </dd>
          </div>
        </dl>
        {report.mvp && (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Trophy className="size-4 text-neon-gold" /> {report.mvp} defeated the most monsters this wave.
          </p>
        )}
        <button type="button" onClick={onClose} className="btn-game rounded-xl bg-accent px-5 py-2.5 font-semibold text-white">
          Continue
        </button>
      </div>
    </dialog>
  )
}
