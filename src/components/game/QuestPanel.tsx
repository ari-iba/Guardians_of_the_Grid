import { useEffect, useRef } from 'react'
import { Check, ScrollText, X } from 'lucide-react'
import { IconButton } from '#/components/ui/IconButton.tsx'
import { useNow } from '#/lib/app-ui.ts'
import { ACHIEVEMENTS, XP_RULES, type AchievementId, type PlayerProgress } from '#/lib/progress.ts'

function untilMidnight(now: number): string {
  const end = new Date(now)
  end.setHours(24, 0, 0, 0)
  const minutes = Math.max(0, Math.round((end.getTime() - now) / 60_000))
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** Side panel (bottom sheet on phones): today's quests, achievements and how XP works. */
export function QuestPanel({ open, onClose, me }: { open: boolean; onClose: () => void; me: PlayerProgress }) {
  const ref = useRef<HTMLDialogElement>(null)
  const now = useNow(30_000)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  const unlocked = new Map(me.achievements.map((a) => [a.id, a.unlockedAt]))

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="quests-title"
      className="quest-sheet mt-auto mb-0 max-h-[85dvh] w-full max-w-none rounded-t-3xl border border-[var(--panel-border)] bg-card-strong p-0 text-fg shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm sm:mt-0 sm:mr-0 sm:ml-auto sm:h-dvh sm:max-h-dvh sm:w-96 sm:rounded-none sm:rounded-l-3xl"
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="quests-title" className="title-pixel inline-flex items-center gap-2 text-sm">
              <ScrollText className="size-5 text-neon-gold" /> Daily quests
            </h2>
            <p className="mt-1 text-xs text-muted" suppressHydrationWarning>
              Three new quests every day{now !== null && ` · new ones in ${untilMidnight(now)}`}
            </p>
          </div>
          <IconButton aria-label="Close" onClick={onClose} className="rounded-lg p-1 hover:bg-subtle">
            <X className="size-5" />
          </IconButton>
        </div>

        <ul className="flex flex-col gap-3">
          {me.quests.map((q) => (
            <li
              key={q.id}
              className={`rounded-2xl border p-3 ${q.done ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-line bg-panel'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-fg">
                  {q.done && <Check className="mr-1 inline size-4 text-emerald-500" />}
                  {q.title}
                </span>
                <span className="shrink-0 font-pixel text-[9px] text-neon-gold" title="XP reward when the quest is done">
                  +{q.reward} XP
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div
                  role="progressbar"
                  aria-label={q.title}
                  aria-valuemin={0}
                  aria-valuemax={q.target}
                  aria-valuenow={q.progress}
                  className="h-2 flex-1 overflow-hidden rounded-full bg-black/20"
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ${q.done ? 'bg-emerald-500' : 'bg-linear-to-r from-neon-cyan to-neon-magenta'}`}
                    style={{ width: `${(q.progress / q.target) * 100}%` }}
                  />
                </div>
                <span className="font-pixel text-[9px] text-muted tabular-nums">
                  {q.progress}/{q.target}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <section className="flex flex-col gap-2">
          <h3 className="title-pixel text-[11px] text-muted">Achievements</h3>
          <ul className="grid grid-cols-1 gap-2">
            {(Object.keys(ACHIEVEMENTS) as AchievementId[]).map((id) => {
              const a = ACHIEVEMENTS[id]
              const got = unlocked.has(id)
              return (
                <li key={id} className={`flex items-center gap-3 rounded-xl border border-line px-3 py-2 ${got ? 'bg-panel' : 'opacity-55'}`}>
                  <span className={`text-2xl ${got ? '' : 'grayscale'}`} aria-hidden>
                    {a.icon}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-fg">
                      {a.label}
                      {!got && <span className="sr-only"> (locked)</span>}
                    </span>
                    <span className="text-xs text-muted">{a.description}</span>
                  </span>
                  {got && <Check className="ml-auto size-4 shrink-0 text-emerald-500" />}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="title-pixel text-[11px] text-muted">How to earn XP</h3>
          <ul className="flex flex-col divide-y divide-line text-sm">
            {XP_RULES.map((r) => (
              <li key={r.label} className="flex justify-between gap-3 py-1.5">
                <span className="text-fg">{r.label}</span>
                <span className="font-pixel text-[9px] text-neon-gold">{r.xp ? `+${r.xp}` : 'reward'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </dialog>
  )
}
