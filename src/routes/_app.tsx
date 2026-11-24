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
  Repeat,
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
import { BottomTabs, HudIdentity, TopBar, type XpPopup } from '#/components/layout/TopBar.tsx'
import { LevelUpOverlay } from '#/components/game/LevelUpOverlay.tsx'
import { QuestPanel } from '#/components/game/QuestPanel.tsx'
import { useWaveDirector } from '#/components/game/WaveDirector.tsx'
import { Tutorial } from '#/components/game/Tutorial.tsx'
import { GuardianSwitcher } from '#/components/game/GuardianSwitcher.tsx'
import { ACHIEVEMENTS } from '#/lib/progress.ts'
import { useProgressEvents } from '#/lib/use-progress-events.ts'
import { AppUiContext, type AppUi, type Repair } from '#/lib/app-ui.ts'
import { getCurrentGuardian, getDemoGuardians, logout, switchGuardian } from '#/lib/auth.functions.ts'
import { DISTRICT_LABELS } from '#/lib/district.ts'
import { isLockdown, magicLevel, type GlitchStatus, type GlitchSummary } from '#/lib/glitch.ts'
import { getGlitches } from '#/lib/glitches.functions.ts'
import { getProgress } from '#/lib/progress.functions.ts'
import { useHotkeys } from '#/lib/hotkeys.ts'
import { resetSensorSimulation, tickSensors } from '#/lib/sensors.functions.ts'
import {
  installAudioUnlock,
  playAlarm,
  playClick,
  playGlitchSound,
  playHit,
  playLevelUp,
  playRepairSound,
  playSwitch,
  playXp,
  setSoundEnabled,
  soundEnabled,
} from '#/lib/sound.ts'

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
    const [glitches, players, demoGuardians] = await Promise.all([getGlitches(), getProgress(), getDemoGuardians()])
    return { glitches, players, demoGuardians }
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
  const { glitches, players, demoGuardians } = Route.useLoaderData()
  const me = players.find((p) => p.guardianId === guardian.guardianId)
  const navigate = useNavigate()
  const router = useRouter()
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
  // Browsers keep audio muted until a user gesture: unlock it on the first click / key press.
  useEffect(() => installAudioUnlock(), [])

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
    // A monster takes a hit whenever its status moves on (FIXED has its own fanfare below).
    onHit: () => playHit(),
    onFixed: (fixed) => {
      playRepairSound()
      setRepairs((list) => [...list, ...fixed.map((g) => ({ glitchId: g.glitchId, district: g.district }))])
      for (const g of fixed) notify(`✨ ${g.glitchId} repaired — magic flows back into ${DISTRICT_LABELS[g.district]}`, 'magic')
    },
  })

  const wave = useWaveDirector(glitches, notify)

  // Entering a lockdown sounds the alarm (not on first load).
  const wasLockdown = useRef<boolean | null>(null)
  useEffect(() => {
    if (wasLockdown.current === false && lockdown) {
      playAlarm()
      notify('⚔ BOSS BATTLE — Achrona is in lockdown. Defeat the boss!', 'danger')
    }
    wasLockdown.current = lockdown
  }, [lockdown, notify])

  // ---- Player progress: XP popups, level-ups, achievements ----
  const [xpPopups, setXpPopups] = useState<XpPopup[]>([])
  const [levelUp, setLevelUp] = useState<{ level: number; title: string } | null>(null)
  const [questsOpen, setQuestsOpen] = useState(false)
  const [tutorialReplay, setTutorialReplay] = useState(0)
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

  // ---- Demo mode: switch guardian without a password ----
  const [flip, setFlip] = useState(0)
  const switchTo = async (guardianId: string) => {
    try {
      const next = await switchGuardian({ data: { guardianId } })
      await router.invalidate()
      playSwitch()
      setFlip((n) => n + 1)
      notify(`Now acting as ${next.codename} (${next.role === 'commander' ? 'Commander' : 'Defender'})`, 'info')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not switch guardian.', 'danger')
    }
  }
  /** Shift+R: hop between the demo commander (nova) and defender (ember). */
  const quickSwitch = () => {
    if (!demoGuardians) return
    const target = demoGuardians.find((g) => g.codename === (guardian.codename === 'nova' ? 'ember' : 'nova'))
    if (target) void switchTo(target.guardianId)
  }

  const toggleSound = () => {
    const next = !soundEnabled()
    setSoundEnabled(next) // switching on also plays a short test sound
    setSound(next)
    notify(next ? '🔊 Sound effects on' : '🔇 Sound effects off')
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
    R: quickSwitch,
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
      { id: 'tutorial', label: 'Replay the tutorial', icon: icon(Keyboard), keywords: 'help intro explain monsters', run: () => setTutorialReplay((n) => n + 1) },
      { id: 'shortcuts', label: 'Show keyboard shortcuts', icon: icon(Keyboard), shortcut: '?', keywords: 'help keys', run: () => setShowShortcuts(true) },
    ]
    if (guardian.role === 'commander') {
      list.push(
        { id: 'attack', label: 'Start a wave (simulate attack)', icon: icon(ShieldAlert), keywords: 'commander desync crash simulate attack', run: wave.startWave },
        { id: 'reset', label: 'Reset simulation', icon: icon(RotateCcw), keywords: 'commander sensors normal', run: commanderAction(() => resetSensorSimulation(), 'Simulation reset') },
      )
    }
    if (demoGuardians) {
      list.push({ id: 'switch', label: 'Demo: switch nova ↔ ember', icon: icon(Repeat), shortcut: 'Shift+R', keywords: 'guardian role act as demo', run: quickSwitch })
      for (const g of demoGuardians) {
        if (g.guardianId === guardian.guardianId) continue
        list.push({ id: `act-${g.guardianId}`, label: `Demo: act as ${g.codename} (${g.role})`, icon: icon(UserRound), keywords: 'switch guardian role demo', run: () => void switchTo(g.guardianId) })
      }
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
  }, [guardian.role, guardian.guardianId, guardian.codename, demoGuardians, sound, navigate, router, notify, toggleTheme, wave.startWave])

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
      startWave: wave.startWave,
    }),
    [lastUpdated, paused, notify, repairs, wave.startWave],
  )

  return (
    <AppUiContext.Provider value={ui}>
      {/* Outer wrapper carries the lockdown accent; #app-root is what shakes on a new glitch. */}
      <div data-lockdown={lockdown || undefined}>
        {/* The map page is full-bleed: exactly one screen high, no padding, no page scroll. */}
        <div
          id="app-root"
          // Phones: room at the bottom for the fixed tab bar (inside the box, so the map still fits).
          className={`flex flex-col pb-16 md:pb-0 ${fullBleed ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}
        >
          <TopBar
            me={me}
            identity={
              demoGuardians ? (
                <GuardianSwitcher me={guardian} guardians={demoGuardians} onSwitch={switchTo} flip={flip} />
              ) : me ? (
                <HudIdentity me={me} />
              ) : null
            }
            xpPopups={xpPopups}
            sound={sound}
            onToggleSound={toggleSound}
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={onLogout}
            onOpenQuests={() => setQuestsOpen(true)}
          />
          {lockdown && (
            <div className="sticky top-14 z-30">
              <LockdownBanner magic={magic} leaked={leaked} glitches={glitches} />
            </div>
          )}
          <main
            className={
              fullBleed
                ? 'relative min-h-0 w-full flex-1 overflow-hidden'
                : 'w-full min-w-0 flex-1 px-4 py-6 sm:px-8 md:py-10 lg:px-12'
            }
          >
            <Outlet />
          </main>
        </div>
        {/* Outside #app-root so the new-glitch shake doesn't move this fixed bar. */}
        <BottomTabs />
        {lockdown && <div aria-hidden className="lockdown-glow pointer-events-none fixed inset-0 z-50" />}
        <ReportEchoDialog open={reporting} onClose={() => setReporting(false)} />
        <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
        <Toaster toasts={toasts} onDismiss={dismissToast} />
        <GlitchFx trigger={glitchFx} />
        <BootSequence codename={guardian.codename} />
        {wave.element}
        <Tutorial role={guardian.role} replay={tutorialReplay} />
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

/** Compares successive loader results: new glitches, status hits, and glitches that just became FIXED. */
function useGlitchEvents(
  glitches: GlitchSummary[],
  handlers: {
    onNew: (added: GlitchSummary[]) => void
    onHit: (changed: GlitchSummary[]) => void
    onFixed: (fixed: GlitchSummary[]) => void
  },
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
    const hit = glitches.filter((g) => g.status !== 'FIXED' && before.has(g.glitchId) && before.get(g.glitchId) !== g.status)
    if (added.length) latest.current.onNew(added)
    if (hit.length) latest.current.onHit(hit)
    if (fixed.length) latest.current.onFixed(fixed)
  }, [glitches])
}
