import { useAppUi, useNow } from '#/lib/app-ui.ts'

/** "● LIVE · updated 3s ago" — or "PAUSED" while the tab is hidden. */
export function LiveIndicator() {
  const { lastUpdated, paused } = useAppUi()
  const now = useNow(1000)
  const seconds = now === null ? 0 : Math.max(0, Math.round((now - lastUpdated) / 1000))

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs text-muted" aria-live="off">
      <span className="relative flex size-2">
        {!paused && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />}
        <span className={`relative inline-flex size-2 rounded-full ${paused ? 'bg-muted' : 'bg-emerald-500'}`} />
      </span>
      <span className="font-semibold tracking-wide text-fg">{paused ? 'PAUSED' : 'LIVE'}</span>
      <span className="tabular-nums">· updated {seconds}s ago</span>
    </span>
  )
}
