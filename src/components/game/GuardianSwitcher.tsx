import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '@tanstack/react-router'
import { Check, ChevronDown, LoaderCircle, Repeat } from 'lucide-react'
import { Avatar } from '#/components/game/MonsterCard.tsx'
import { RoleBadge } from '#/components/ui/RoleBadge.tsx'
import type { Guardian } from '#/lib/guardian.ts'

/**
 * Demo mode: the player's identity in the top bar doubles as a guardian switcher.
 * Dropdown on wider screens, bottom sheet on phones. `flip` re-plays the card-flip animation.
 */
export function GuardianSwitcher({
  me,
  guardians,
  onSwitch,
  flip,
}: {
  me: Guardian
  guardians: Guardian[]
  onSwitch: (guardianId: string) => Promise<void>
  flip: number
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  // The HUD uses backdrop-filter, which traps position:fixed children; phones get the sheet via a portal.
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setPhone(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!root.current?.contains(target) && !sheet.current?.contains(target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    ;(sheet.current ?? root.current)?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  async function choose(guardianId: string) {
    if (guardianId === me.guardianId) return setOpen(false)
    setPending(guardianId)
    try {
      await onSwitch(guardianId)
      setOpen(false)
    } finally {
      setPending(null)
    }
  }

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Acting as ${me.codename} (${me.role}). Switch guardian`}
        title="Demo: switch guardian (Shift+R = nova ↔ ember)"
        className="flex items-center gap-2 rounded-lg p-1 hover:bg-subtle"
      >
        <span key={flip} className={`flex items-center gap-2 ${flip ? 'badge-flip' : ''}`}>
          <Avatar codename={me.codename} className="size-8 text-[9px]" />
          <span className="hidden max-w-24 truncate text-sm font-semibold text-fg sm:inline">{me.codename}</span>
          <span className="hidden sm:contents">
            <RoleBadge role={me.role} compact />
          </span>
        </span>
        <ChevronDown className={`hidden size-4 text-muted transition-transform sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && renderMenu()}
    </div>
  )

  function renderMenu() {
    const menu = (
        <>
          {/* Phones: dimmed backdrop behind the bottom sheet */}
          <div aria-hidden className="fixed inset-0 z-[80] bg-black/50 sm:hidden" />
          <div
            ref={sheet}
            role="menu"
            aria-label="Switch guardian"
            className="toast-in fixed inset-x-0 bottom-0 z-[81] flex flex-col gap-1 rounded-t-3xl border border-[var(--panel-border)] bg-card-strong p-3 pb-6 shadow-2xl sm:absolute sm:inset-x-auto sm:top-full sm:bottom-auto sm:left-0 sm:mt-2 sm:w-72 sm:rounded-2xl sm:pb-3"
          >
            <span className="mx-auto mb-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
            <p className="flex items-center gap-1.5 px-2 pb-1 font-pixel text-[9px] text-neon-cyan">
              <Repeat className="size-3.5" /> DEMO · ACT AS
            </p>
            {guardians.map((g) => {
              const current = g.guardianId === me.guardianId
              return (
                <button
                  key={g.guardianId}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  disabled={pending !== null}
                  onClick={() => choose(g.guardianId)}
                  className={`flex items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-subtle disabled:opacity-60 ${current ? 'bg-subtle' : ''}`}
                >
                  <Avatar codename={g.codename} className="size-8 text-[9px]" />
                  <span className="flex-1 text-sm font-semibold text-fg">{g.codename}</span>
                  <RoleBadge role={g.role} compact />
                  <span className="w-4">
                    {pending === g.guardianId ? (
                      <LoaderCircle className="size-4 animate-spin text-muted" />
                    ) : current ? (
                      <Check className="size-4 text-emerald-500" />
                    ) : null}
                  </span>
                </button>
              )
            })}
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-line px-2 pt-2 text-xs text-muted">
              <Link to="/guardians/$guardianId" params={{ guardianId: me.guardianId }} onClick={() => setOpen(false)} className="font-semibold text-accent hover:underline">
                My character card
              </Link>
              <span>
                <kbd className="font-mono">Shift</kbd>+<kbd className="font-mono">R</kbd> nova ↔ ember
              </span>
            </div>
          </div>
        </>
    )
    return phone ? createPortal(menu, document.body) : menu
  }
}
