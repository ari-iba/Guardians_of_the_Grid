import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MonsterSprite } from '#/components/game/MonsterSprite.tsx'
import { HpBar } from '#/components/game/HpBar.tsx'
import type { Role } from '#/lib/guardian.ts'

const KEY = 'gotg-tutorial'
/** Wait for the boot sequence after login before explaining things. */
const DELAY_MS = 2600

export function resetTutorial(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

const sample = { glitchId: 'GL-0142', district: 'clocktower' as const, metric: null, status: 'LEAKED' as const }

type Step = { title: string; body: ReactNode; visual: ReactNode }

function steps(role: Role): Step[] {
  return [
    {
      title: 'This is a monster = a glitch',
      body: (
        <>
          Every problem reported in Achrona (a <strong>glitch</strong>) shows up as a monster. Monsters with a gold
          <strong> WILD SPAWN</strong> tag were detected automatically by the sensors (🤖).
        </>
      ),
      visual: <MonsterSprite glitch={sample} className="monster-idle mx-auto size-28" title="Example monster" />,
    },
    {
      title: 'HP = how far the fix is',
      body: (
        <>
          The HP bar is the glitch status. <strong>LEAKED</strong> 100 → <strong>ASSESSING</strong> 70 →{' '}
          <strong>CONTAINING</strong> 35 → <strong>FIXED</strong> 0: the monster is defeated.
        </>
      ),
      visual: (
        <div className="mx-auto flex w-full max-w-xs flex-col gap-2 text-left">
          {(['LEAKED', 'ASSESSING', 'CONTAINING', 'FIXED'] as const).map((s) => (
            <div key={s} className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
              <span className="font-pixel text-[8px] text-muted">{s}</span>
              <HpBar status={s} />
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'You are a player',
      body: (
        <>
          Report echoes and fix glitches to earn <strong>XP</strong> and level up (top bar). The scroll icon (
          <kbd className="font-mono">q</kbd>) holds three <strong>daily quests</strong> and your achievements.
        </>
      ),
      visual: (
        <div className="mx-auto flex items-center gap-3">
          <span className="rounded-md bg-neon-gold px-2 py-1.5 font-pixel text-xs text-black">LV 3</span>
          <span className="h-3 w-40 overflow-hidden rounded-full bg-black/30">
            <span className="block h-full w-2/3 rounded-full bg-linear-to-r from-neon-cyan via-neon-magenta to-neon-gold" />
          </span>
          <span className="font-pixel text-xs text-neon-gold">+50 XP</span>
        </div>
      ),
    },
    role === 'commander'
      ? {
          title: 'Commander: deploy & defend',
          body: (
            <>
              On the <strong>Map</strong>, <strong>drag a defender from your Squad onto a glitch</strong> (or tap one, then the glitch) to assign it. Start a
              <strong> wave</strong> (simulated attack) from Sensors or <kbd className="font-mono">Ctrl K</kbd>. Hover any game
              word to see what it really means.
            </>
          ),
          visual: <p className="text-center text-5xl">🛡️ → 👾</p>,
        }
      : {
          title: 'Defender: contain & fix',
          body: (
            <>
              When a monster is assigned to you, post an <strong>update echo</strong> on it to start containment, then press
              <strong> Mark as fixed</strong>. Hover any game word to see what it really means.
            </>
          ),
          visual: <p className="text-center text-5xl">📣 → ⚔️ → ✨</p>,
        },
  ]
}

/** Four-step intro on the first visit. Skippable; shown once per browser. */
export function Tutorial({ role, replay }: { role: Role; replay: number }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const ref = useRef<HTMLDialogElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let seen = true
    try {
      seen = localStorage.getItem(KEY) === 'done'
    } catch {
      /* storage unavailable: don't nag */
    }
    if (seen && replay === 0) return
    const id = setTimeout(() => {
      setIndex(0)
      setOpen(true)
    }, replay ? 0 : DELAY_MS)
    return () => clearTimeout(id)
  }, [replay])

  useEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal()
    // showModal focuses the first button (Skip); Enter should go to the next step instead.
    if (open) nextRef.current?.focus()
  }, [open, index])

  const finish = () => {
    try {
      localStorage.setItem(KEY, 'done')
    } catch {
      /* storage unavailable */
    }
    ref.current?.close()
    setOpen(false)
  }

  if (!open) return null
  const all = steps(role)
  const step = all[index]
  const last = index === all.length - 1

  return (
    <dialog
      ref={ref}
      onClose={finish}
      aria-labelledby="tutorial-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-[var(--panel-border)] bg-card-strong p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[9px] text-neon-cyan">
            TUTORIAL {index + 1}/{all.length}
          </span>
          <button type="button" onClick={finish} className="text-sm font-medium text-muted hover:text-fg">
            Skip
          </button>
        </div>
        <div key={index} className="toast-in flex min-h-32 items-center justify-center">
          {step.visual}
        </div>
        <div className="flex flex-col gap-2">
          <h2 id="tutorial-title" className="title-pixel text-sm text-fg">
            {step.title}
          </h2>
          <p className="text-sm text-muted">{step.body}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {all.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-accent' : 'w-1.5 bg-line'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" onClick={() => setIndex(index - 1)} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-subtle">
                Back
              </button>
            )}
            <button
              type="button"
              ref={nextRef}
              onClick={() => (last ? finish() : setIndex(index + 1))}
              className="btn-game rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              {last ? "Let's play" : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
