import { createContext, useContext, useEffect, useState } from 'react'
import type { ToastTone } from '#/components/Toaster.tsx'

export type Repair = { glitchId: string; district: string }

/** Layout-level actions and live-update state, shared with pages. */
export type AppUi = {
  openReport: () => void
  openShortcuts: () => void
  /** Epoch ms of the last successful data refresh. */
  lastUpdated: number
  /** True while the tab is hidden and polling is paused. */
  paused: boolean
  /** Show a toast. */
  notify: (message: string, tone?: ToastTone) => void
  /** Glitches that just became FIXED and still await their repair animation. */
  repairs: Repair[]
  clearRepairs: (ids: string[]) => void
  /** Commander: start a Desync wave (countdown → simulated attack → wave report). */
  startWave: () => void
}

export const AppUiContext = createContext<AppUi | null>(null)

export function useAppUi(): AppUi {
  const value = useContext(AppUiContext)
  if (!value) throw new Error('useAppUi must be used inside the app layout')
  return value
}

/** Current time, re-rendering every `intervalMs`. Null until mounted (avoids SSR mismatch). */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
