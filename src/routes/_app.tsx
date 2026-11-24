import { useEffect, useMemo, useState } from 'react'
import { Outlet, createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { LockdownBanner } from '#/components/LockdownBanner.tsx'
import { ReportEchoDialog } from '#/components/ReportEchoDialog.tsx'
import { ShortcutsDialog } from '#/components/ShortcutsDialog.tsx'
import { useTheme } from '#/components/ThemeToggle.tsx'
import { Sidebar } from '#/components/layout/Sidebar.tsx'
import { AppUiContext, type AppUi } from '#/lib/app-ui.ts'
import { getCurrentGuardian } from '#/lib/auth.functions.ts'
import { isLockdown, magicLevel } from '#/lib/glitch.ts'
import { getGlitches } from '#/lib/glitches.functions.ts'
import { useHotkeys } from '#/lib/hotkeys.ts'

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

  // New loader data (poll or own mutation) = fresh data.
  useEffect(() => setLastUpdated(Date.now()), [glitches])

  const magic = magicLevel(glitches)
  const lockdown = isLockdown(glitches)
  const leaked = glitches.filter((g) => g.status === 'LEAKED').length

  useHotkeys({
    n: () => setReporting(true),
    '?': () => setShowShortcuts(true),
    g: () => navigate({ to: '/' }),
    t: toggleTheme,
  })

  const ui = useMemo<AppUi>(
    () => ({
      openReport: () => setReporting(true),
      openShortcuts: () => setShowShortcuts(true),
      lastUpdated,
      paused,
    }),
    [lastUpdated, paused],
  )

  return (
    <AppUiContext.Provider value={ui}>
      <div data-lockdown={lockdown || undefined} className="flex min-h-screen flex-col md:flex-row">
        <Sidebar
          guardian={guardian}
          theme={theme}
          onToggleTheme={toggleTheme}
          onShowShortcuts={() => setShowShortcuts(true)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {lockdown && <LockdownBanner magic={magic} leaked={leaked} />}
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 md:py-10 lg:px-16">
            <Outlet />
          </main>
        </div>
        {lockdown && <div aria-hidden className="lockdown-glow pointer-events-none fixed inset-0 z-50" />}
        {/* Inside the wrapper so dialogs pick up the lockdown accent too. */}
        <ReportEchoDialog open={reporting} onClose={() => setReporting(false)} />
        <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      </div>
    </AppUiContext.Provider>
  )
}
