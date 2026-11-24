import { useCallback, useEffect, useMemo, useState } from 'react'
import { History, Pause, Play, Radio } from 'lucide-react'
import { useNow } from '#/lib/app-ui.ts'
import type { GlitchSummary } from '#/lib/glitch.ts'
import { getStatusHistory, type StatusChange } from '#/lib/glitches.functions.ts'
import { REPLAY_WINDOW_MS, replayEvents, snapshotAt } from '#/lib/replay.ts'

const STEP_MS = 10_000
/** 10× speed: every 100 ms of real time moves the replay 1 s forward. */
const PLAY_TICK_MS = 100
const PLAY_ADVANCE_MS = 1000

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function ago(ms: number): string {
  const s = Math.round(ms / 1000)
  return `−${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export type ReplayState = { at: number; glitches: GlitchSummary[] } | null

/** "Last 60 min" slider + play button under the map. Calls onChange(null) when back to live. */
export function TimelineReplay({ glitches, onChange }: { glitches: GlitchSummary[]; onChange: (state: ReplayState) => void }) {
  const now = useNow(1000)
  const [history, setHistory] = useState<StatusChange[] | null>(null)
  const [end, setEnd] = useState<number | null>(null)
  const [at, setAt] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const windowEnd = end ?? now ?? 0
  const windowStart = windowEnd - REPLAY_WINDOW_MS

  const goLive = useCallback(() => {
    setAt(null)
    setEnd(null)
    setPlaying(false)
    setHistory(null) // refetch next time, so the replay includes new changes
    onChange(null)
  }, [onChange])

  const engage = (t: number) => {
    const e = end ?? Date.now()
    setEnd(e)
    if (t >= e) return goLive()
    setAt(Math.max(e - REPLAY_WINDOW_MS, t))
    if (!history) {
      getStatusHistory()
        .then(setHistory)
        .catch(() => setError('Could not load the status history.'))
    }
  }

  // Publish the snapshot whenever the moment, the history or the live data changes.
  useEffect(() => {
    if (at !== null && history) onChange({ at, glitches: snapshotAt(glitches, history, at) })
  }, [at, history, glitches, onChange])

  // Playback at 10× speed.
  useEffect(() => {
    if (!playing || end === null) return
    const id = setInterval(() => {
      setAt((t) => {
        const next = (t ?? end - REPLAY_WINDOW_MS) + PLAY_ADVANCE_MS
        if (next >= end) {
          setTimeout(goLive, 0)
          return t
        }
        return next
      })
    }, PLAY_TICK_MS)
    return () => clearInterval(id)
  }, [playing, end, goLive])

  const events = useMemo(
    () => (history ? replayEvents(glitches, history, windowStart, windowEnd) : []),
    [history, glitches, windowStart, windowEnd],
  )

  const live = at === null
  const value = at ?? windowEnd
  const pct = (t: number) => ((t - windowStart) / REPLAY_WINDOW_MS) * 100

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-panel px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (playing) return setPlaying(false)
            if (live) engage(Date.now() - REPLAY_WINDOW_MS)
            setPlaying(true)
          }}
          aria-label={playing ? 'Pause replay' : 'Play the last 60 minutes at 10× speed'}
          title={playing ? 'Pause' : 'Play last 60 min (10×)'}
          className="flex size-9 items-center justify-center rounded-full bg-accent text-white shadow-md shadow-accent/25 transition hover:brightness-110"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
        </button>
        <button
          type="button"
          onClick={goLive}
          disabled={live}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide transition ${
            live ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-subtle text-muted hover:text-fg'
          }`}
          title="Back to live"
        >
          <Radio className="size-3.5" /> LIVE
        </button>
      </div>

      <div className="relative flex-1 py-2">
        {/* Event ticks: red = new glitch, blue = status change, green = fixed */}
        <div aria-hidden className="pointer-events-none absolute inset-x-[8px] top-0 h-2">
          {events.map((e, i) => (
            <span
              key={i}
              className={`absolute top-0 h-2 w-0.5 rounded-full ${e.kind === 'new' ? 'bg-red-500' : e.kind === 'fixed' ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ left: `${pct(e.t)}%` }}
            />
          ))}
        </div>
        <input
          type="range"
          min={windowStart}
          max={windowEnd}
          step={STEP_MS}
          value={value}
          disabled={now === null}
          onChange={(e) => {
            setPlaying(false)
            engage(Number(e.target.value))
          }}
          aria-label="Replay time (last 60 minutes)"
          aria-valuetext={live ? 'Live' : `${ago(windowEnd - value)} minutes ago`}
          className="replay-slider w-full"
        />
        <div className="flex justify-between text-[11px] text-muted">
          <span>−60 min</span>
          <span>now</span>
        </div>
      </div>

      <div className="min-w-36 text-sm sm:text-right" aria-live="polite">
        {live ? (
          <span className="inline-flex items-center gap-1.5 text-muted">
            <History className="size-4" /> Drag to replay
          </span>
        ) : (
          <span className="font-semibold text-fg tabular-nums">
            {ago(windowEnd - value)} · {clock.format(new Date(value))}
          </span>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
