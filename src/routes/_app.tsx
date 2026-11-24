import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, createFileRoute, redirect, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import {
  ChartSpline,
  Keyboard,
  LayoutGrid,
  LogOut,
  Map as MapIcon,
  Moon,
  Plus,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  Trophy,
  UserRound,
  Volume2,
} from 'lucide-react'
import { BootSequence } from '#/components/BootSequence.tsx'
import { CommandPalette, type Command } from '#/components/CommandPalette.tsx'
import { GlitchFx } from '#/components/GlitchFx.tsx'
import { LockdownBanner } from '#/components/LockdownBanner.tsx'
import { ReportEchoDialog } from '#/components/ReportEchoDialog.tsx'
import { ShortcutsDialog } from '#/components/ShortcutsDialog.tsx'
import { useTheme } from '#/components/ThemeToggle.tsx'
import { Toaster, useToasts } from '#/components/Toaster.tsx'
import { Sidebar } from '#/components/layout/Sidebar.tsx'
import { LevelUpOverlay } from '#/components/game/LevelUpOverlay.tsx'
import { HudIdentity, PlayerHud, type XpPopup } from '#/components/game/PlayerHud.tsx'
import { QuestPanel } from '#/components/game/QuestPanel.tsx'
import { ACHIEVEMENTS } from '#/lib/progress.ts'
import { useProgressEvents } from '#/lib/use-progress-events.ts'
import { AppUiContext, type AppUi, type Repair } from '#/lib/app-ui.ts'
import { getCurrentGuardian, logout } from '#/lib/auth.functions.ts'
import { DISTRICT_LABELS } from '#/lib/district.ts'
import { isLockdown, magicLevel, type GlitchStatus, type GlitchSummary } from '#/lib/glitch.ts'
import { getGlitches } from '#/lib/glitches.functions.ts'
import { getProgress } from '#/lib/progress.functions.ts'
import { useHotkeys } from '#/lib/hotkeys.ts'
import { resetSensorSimulation, startSimulatedAttack, tickSensors } from '#/lib/sensors.functions.ts'
import { playClick, playGlitchSound, playLevelUp, playRepairSound, playXp, setSoundEnabled, soundEnabled } from '#/lib/sound.ts'

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
  loader: async () => {
    const [glitches, players] = await Promise.all([getGlitches(), getProgress()])
    return { glitches, players }
  },
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
  const { glitches, players } = Route.useLoaderData()
  const me = players.find((p) => p.guardianId === guardian.guardianId)
  const navigate = useNavigate()
  const paused = useLivePolling()
  const [theme, toggleTheme] = useTheme()
  const [reporting, setReporting] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(() => Date.now())
  const [toasts, notify, dismissToast] = useToasts()

  // New loader data (poll or own mutation) = fresh data.
  useEffect(() => setLastUpdated(Date.now()), [glitches])

  const fullBleed = useRouterState({ select: (s) => s.location.pathname === '/map' })
  const magic = magicLevel(glitches)
  const lockdown = isLockdown(glitches)
  const leaked = glitches.filter((g) => g.status === 'LEAKED').length

  // ---- Reactions to what the live poll brings in ----
  const [glitchFx, setGlitchFx] = useState(0)
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [sound, setSound] = useState(false)
  useEffect(() => setSound(soundEnabled()), [])

  // Every game button gives a little 8-bit tick (only when sound is on).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('.btn-game:not(:disabled)')) playClick()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

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

  // ---- Player progress: XP popups, level-ups, achievements ----
  const [xpPopups, setXpPopups] = useState<XpPopup[]>([])
  const [levelUp, setLevelUp] = useState<{ level: number; title: string } | null>(null)
  const [questsOpen, setQuestsOpen] = useState(false)
  useProgressEvents(me, {
    onXp: (xp) => {
      const id = Date.now() + Math.random()
      playXp()
      setXpPopups((list) => [...list, { id, xp }])
      setTimeout(() => setXpPopups((list) => list.filter((p) => p.id !== id)), 1700)
    },
    onLevelUp: (level, title) => {
      playLevelUp()
      setLevelUp({ level, title })
    },
    onAchievements: (ids) => {
      for (const id of ids) notify(`${ACHIEVEMENTS[id].icon} Achievement unlocked: ${ACHIEVEMENTS[id].label} — ${ACHIEVEMENTS[id].description}`, 'magic')
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
    m: () => navigate({ to: '/map' }),
    s: () => navigate({ to: '/sensors' }),
    l: () => navigate({ to: '/leaderboard' }),
    t: toggleTheme,
    q: () => setQuestsOpen(true),
  })

  // ---- Command palette (Ctrl+K / ⌘K works everywhere, also while typing) ----
  const [palette, setPalette] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const router = useRouter()
  const commands = useMemo<Command[]>(() => {
    const icon = (Icon: typeof LayoutGrid) => <Icon className="size-4" />
    const commanderAction = (action: () => Promise<unknown>, message: string) => async () => {
      try {
        await action()
        await router.invalidate()
        notify(message, 'success')
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Action failed.', 'danger')
      }
    }
    const list: Command[] = [
      { id: 'overview', label: 'Go to overview', icon: icon(LayoutGrid), shortcut: 'g', keywords: 'home dashboard map', run: () => navigate({ to: '/' }) },
      { id: 'map', label: 'Go to map', icon: icon(MapIcon), shortcut: 'm', keywords: 'achrona districts replay', run: () => navigate({ to: '/map' }) },
      { id: 'sensors', label: 'Go to sensors', icon: icon(ChartSpline), shortcut: 's', keywords: 'desync engine charts', run: () => navigate({ to: '/sensors' }) },
      { id: 'leaderboard', label: 'Go to leaderboard', icon: icon(Trophy), shortcut: 'l', keywords: 'badges ranking', run: () => navigate({ to: '/leaderboard' }) },
      { id: 'mine', label: 'Show glitches assigned to me', icon: icon(UserRound), keywords: 'filter mine', run: () => navigate({ to: '/', search: { mine: true } }) },
      { id: 'report', label: 'Report a new echo', icon: icon(Plus), shortcut: 'n', keywords: 'create glitch', run: () => setReporting(true) },
      { id: 'theme', label: 'Toggle dark / light mode', icon: icon(Moon), shortcut: 't', keywords: 'theme', run: toggleTheme },
      { id: 'sound', label: sound ? 'Turn sound effects off' : 'Turn sound effects on', icon: icon(Volume2), keywords: 'audio mute', run: toggleSound },
      { id: 'quests', label: 'Show daily quests & achievements', icon: icon(ScrollText), shortcut: 'q', keywords: 'xp level badges', run: () => setQuestsOpen(true) },
      { id: 'profile', label: 'Open my character card', icon: icon(UserRound), keywords: 'profile xp level stats', run: () => navigate({ to: '/guardians/$guardianId', params: { guardianId: guardian.guardianId } }) },
      { id: 'shortcuts', label: 'Show keyboard shortcuts', icon: icon(Keyboard), shortcut: '?', keywords: 'help keys', run: () => setShowShortcuts(true) },
    ]
    if (guardian.role === 'commander') {
      list.push(
        { id: 'attack', label: 'Simulate attack', icon: icon(ShieldAlert), keywords: 'commander desync crash', run: commanderAction(() => startSimulatedAttack(), 'Simulated attack started') },
        { id: 'reset', label: 'Reset simulation', icon: icon(RotateCcw), keywords: 'commander sensors normal', run: commanderAction(() => resetSensorSimulation(), 'Simulation reset') },
      )
    }
    list.push({
      id: 'logout',
      label: 'Log out',
      icon: icon(LogOut),
      keywords: 'sign out exit',
      run: async () => {
        await logout()
        await router.invalidate()
        await navigate({ to: '/login' })
      },
    })
    return list
    // toggleSound/toggleTheme are recreated per render but behave the same.
  }, [guardian.role, guardian.guardianId, sound, navigate, router, notify, toggleTheme])

  const onLogout = async () => {
    await logout()
    await router.invalidate()
    await navigate({ to: '/login' })
  }

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
        {/* The map page is full-bleed: exactly one screen high, no padding, no page scroll. */}
        <div
          id="app-root"
          className={`flex flex-col md:flex-row ${fullBleed ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}
        >
          <Sidebar theme={theme} onToggleTheme={toggleTheme} onShowShortcuts={() => setShowShortcuts(true)} />
          <div className={`flex min-w-0 flex-1 flex-col ${fullBleed ? 'min-h-0' : ''}`}>
            {/* HUD + lockdown banner stick together under the phone top bar / at the top on desktop. */}
            <div className="sticky top-14 z-30 md:top-0">
              {me && (
                <PlayerHud
                  me={me}
                  identity={<HudIdentity me={me} />}
                  xpPopups={xpPopups}
                  sound={sound}
                  onToggleSound={toggleSound}
                  onLogout={onLogout}
                  questsDone={me.quests.filter((q) => q.done).length}
                  questsTotal={me.quests.length}
                  onOpenQuests={() => setQuestsOpen(true)}
                />
              )}
              {lockdown && <LockdownBanner magic={magic} leaked={leaked} />}
            </div>
            <main
              className={
                fullBleed
                  ? 'relative min-h-0 min-w-0 flex-1 overflow-hidden'
                  : 'min-w-0 flex-1 px-4 py-6 sm:px-8 md:py-10 lg:px-16'
              }
            >
              <Outlet />
            </main>
          </div>
        </div>
        {lockdown && <div aria-hidden className="lockdown-glow pointer-events-none fixed inset-0 z-50" />}
        <ReportEchoDialog open={reporting} onClose={() => setReporting(false)} />
        <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
        <Toaster toasts={toasts} onDismiss={dismissToast} />
        <GlitchFx trigger={glitchFx} />
        <BootSequence codename={guardian.codename} />
        {me && <QuestPanel open={questsOpen} onClose={() => setQuestsOpen(false)} me={me} />}
        {levelUp && <LevelUpOverlay level={levelUp.level} title={levelUp.title} onClose={() => setLevelUp(null)} />}
        <CommandPalette
          open={palette}
          onClose={() => setPalette(false)}
          commands={commands}
          glitches={glitches}
          onOpenGlitch={(glitchId) => navigate({ to: '/glitches/$glitchId', params: { glitchId } })}
        />
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
