import { useEffect, useMemo, useRef, useState } from 'react'
import { GlitchFx } from '#/components/GlitchFx.tsx'
import { DISTRICT_LABELS } from '#/lib/district.ts'
import type { GlitchStatus, GlitchSummary } from '#/lib/glitch.ts'
import { playGlitchSound, playRepairSound, setSoundEnabled, soundEnabled } from '#/lib/sound.ts'
import { Outlet, createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { LockdownBanner } from '#/components/LockdownBanner.tsx'
import { ReportEchoDialog } from '#/components/ReportEchoDialog.tsx'
import { ShortcutsDialog } from '#/components/ShortcutsDialog.tsx'
import { useTheme } from '#/components/ThemeToggle.tsx'
import { Toaster, useToasts } from '#/components/Toaster.tsx'
import { Sidebar } from '#/components/layout/Sidebar.tsx'
import { AppUiContext, type AppUi, type Repair } from '#/lib/app-ui.ts'
import { getCurrentGuardian } from '#/lib/auth.functions.ts'
import { isLockdown, magicLevel } from '#/lib/glitch.ts'
import { getGlitches } from '#/lib/glitches.functions.ts'
import { useHotkeys } from '#/lib/hotkeys.ts'
import { tickSensors } from '#/lib/sensors.functions.ts'

const POLL_INTERVAL_MS = 5000

/** Pathless layout: everything inside needs a logged-in guardian. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const guardian = await getCurrentGuardian()
    if (!guardian) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    return { guardian }
  },
  // Loaded here (not per page) so lockdown and the gauge are known on every screen.
  loader: async () => ({ glitches: await getGlitches() }),
  component: AppLayout,
})

/** Re-runs loaders every few seconds while the tab is visible. */
function useLivePolling(): boolean {
  const router = useRouter()
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let busy = false
    const refresh = async () => {
      if (busy || document.visibilityState !== 'visible') return
      busy = true
      try {
        // Advance the Desync Engine (the server rate-limits this to one tick per 5 s for all tabs).
        await tickSensors().catch(() => undefined)
        await router.invalidate()
      } catch {
        /* network hiccup: try again next tick */
      } finally {
        busy = false
      }
    }
    const onVisibility = () => {
      const hidden = document.visibilityState !== 'visible'
      setPaused(hidden)
      if (!hidden) void refresh()
    }
    const id = setInterval(refresh, POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [router])

  return paused
}

function AppLayout() {
  const { guardian } = Route.useRouteContext()
  const { glitches } = Route.useLoaderData()
  const navigate = useNavigate()
  const paused = useLivePolling()
  const [theme, toggleTheme] = useTheme()
  const [reporting, setReporting] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(() => Date.now())
  const [toasts, notify, dismissToast] = useToasts()

  // New loader data (poll or own mutation) = fresh data.
  useEffect(() => setLastUpdated(Date.now()), [glitches])

  const magic = magicLevel(glitches)
  const lockdown = isLockdown(glitches)
  const leaked = glitches.filter((g) => g.status === 'LEAKED').length

  // ---- Reactions to what the live poll brings in ----
  const [glitchFx, setGlitchFx] = useState(0)
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [sound, setSound] = useState(false)
  useEffect(() => setSound(soundEnabled()), [])

  useGlitchEvents(glitches, {
    onNew: (added) => {
      setGlitchFx((n) => n + 1)
      playGlitchSound()
      const districts = [...new Set(added.map((g) => DISTRICT_LABELS[g.district]))].join(', ')
      notify(`⚠ New glitch in ${districts}${added.length > 1 ? ` (${added.length})` : ''}`, 'danger')
    },
    onFixed: (fixed) => {
      playRepairSound()
      setRepairs((list) => [...list, ...fixed.map((g) => ({ glitchId: g.glitchId, district: g.district }))])
      for (const g of fixed) notify(`✨ ${g.glitchId} repaired — magic flows back into ${DISTRICT_LABELS[g.district]}`, 'magic')
    },
  })

  const toggleSound = () => {
    const next = !soundEnabled()
    setSoundEnabled(next)
    setSound(next)
    notify(next ? 'Sound effects on' : 'Sound effects off')
  }

  useHotkeys({
    n: () => setReporting(true),
    '?': () => setShowShortcuts(true),
    g: () => navigate({ to: '/' }),
    s: () => navigate({ to: '/sensors' }),
    t: toggleTheme,
  })

  const ui = useMemo<AppUi>(
    () => ({
      openReport: () => setReporting(true),
      openShortcuts: () => setShowShortcuts(true),
      lastUpdated,
      paused,
      notify,
      repairs,
      clearRepairs: (ids: string[]) => setRepairs((list) => list.filter((r) => !ids.includes(r.glitchId))),
    }),
    [lastUpdated, paused, notify, repairs],
  )

  return (
    <AppUiContext.Provider value={ui}>
      {/* Outer wrapper carries the lockdown accent; #app-root is what shakes on a new glitch. */}
      <div data-lockdown={lockdown || undefined}>
        <div id="app-root" className="flex min-h-screen flex-col md:flex-row">
          <Sidebar
            guardian={guardian}
            theme={theme}
            onToggleTheme={toggleTheme}
            onShowShortcuts={() => setShowShortcuts(true)}
            sound={sound}
            onToggleSound={toggleSound}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            {lockdown && <LockdownBanner magic={magic} leaked={leaked} />}
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 md:py-10 lg:px-16">
              <Outlet />
            </main>
          </div>
        </div>
        {lockdown && <div aria-hidden className="lockdown-glow pointer-events-none fixed inset-0 z-50" />}
        <ReportEchoDialog open={reporting} onClose={() => setReporting(false)} />
        <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
        <Toaster toasts={toasts} onDismiss={dismissToast} />
        <GlitchFx trigger={glitchFx} />
      </div>
    </AppUiContext.Provider>
  )
}

/** Compares successive loader results: which glitches are new, which just became FIXED. */
function useGlitchEvents(
  glitches: GlitchSummary[],
  handlers: { onNew: (added: GlitchSummary[]) => void; onFixed: (fixed: GlitchSummary[]) => void },
) {
  const previous = useRef<Map<string, GlitchStatus> | null>(null)
  const latest = useRef(handlers)
  latest.current = handlers

  useEffect(() => {
    const before = previous.current
    previous.current = new Map(glitches.map((g) => [g.glitchId, g.status]))
    if (!before) return // first load: nothing is "new"
    const added = glitches.filter((g) => !before.has(g.glitchId))
    const fixed = glitches.filter((g) => g.status === 'FIXED' && before.has(g.glitchId) && before.get(g.glitchId) !== 'FIXED')
    if (added.length) latest.current.onNew(added)
    if (fixed.length) latest.current.onFixed(fixed)
  }, [glitches])
}
