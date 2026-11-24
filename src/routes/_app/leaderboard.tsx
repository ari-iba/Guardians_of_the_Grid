import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Avatar } from '#/components/game/MonsterCard.tsx'
import { Card } from '#/components/ui/Card.tsx'
import { RoleBadge } from '#/components/ui/RoleBadge.tsx'
import { useNow } from '#/lib/app-ui.ts'
import { BADGES, getLeaderboard, type BadgeId } from '#/lib/leaderboard.functions.ts'
import { ACHIEVEMENTS, type PlayerProgress } from '#/lib/progress.ts'

export const Route = createFileRoute('/_app/leaderboard')({
  loader: () => getLeaderboard(),
  head: () => ({ meta: [{ title: 'Highscores · Control Center' }] }),
  component: HighscorePage,
})

const appRoute = getRouteApi('/_app')

/** Earned XP within this window counts as a fresh highscore. */
const NEW_WINDOW_MS = 15 * 60_000

const ordinal = (n: number) => `${n}${n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH'}`
const podiumColor = ['text-neon-gold', 'text-slate-300', 'text-orange-400']
const podiumHeight = ['h-28 sm:h-36', 'h-20 sm:h-24', 'h-14 sm:h-16']

type Row = PlayerProgress & { rank: number; badges: BadgeId[]; fresh: boolean }

function HighscorePage() {
  const entries = Route.useLoaderData()
  const { players } = appRoute.useLoaderData()
  const { guardian } = Route.useRouteContext()
  const now = useNow(15_000)

  const rows: Row[] = [...players]
    .sort((a, b) => b.xp - a.xp || b.stats.fixed - a.stats.fixed || a.codename.localeCompare(b.codename))
    .map((p, i) => ({
      ...p,
      rank: i + 1,
      badges: entries.find((e) => e.guardianId === p.guardianId)?.badges ?? [],
      fresh: now !== null && !!p.lastXpAt && now - Date.parse(p.lastXpAt) < NEW_WINDOW_MS,
    }))
  const podium = rows.slice(0, 3)
  // Visual order: 2nd, 1st, 3rd.
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <p className="arcade-blink font-pixel text-[10px] text-neon-magenta">★ HALL OF GUARDIANS ★</p>
        <h1 className="title-pixel text-2xl text-neon-gold sm:text-4xl">HIGHSCORES</h1>
        <p className="max-w-md text-sm text-muted">
          Score = XP. Earn it by reporting echoes and defeating monsters (fixing glitches). Badges are earned automatically.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line px-6 py-12 text-center text-sm text-muted">No players yet.</p>
      ) : (
        <>
          <ol className="mx-auto grid w-full max-w-2xl grid-cols-3 items-end gap-2 sm:gap-4" aria-label="Top 3">
            {podiumOrder.map((p) => {
              const i = p.rank - 1
              return (
                <li key={p.guardianId} className="relative flex flex-col items-center gap-2 text-center">
                  {p.rank === 1 && p.fresh && (
                    <span className="arcade-blink absolute -top-7 font-pixel text-[8px] whitespace-nowrap text-neon-magenta sm:text-[10px]">
                      NEW HIGHSCORE!
                    </span>
                  )}
                  <Link to="/guardians/$guardianId" params={{ guardianId: p.guardianId }} className="flex flex-col items-center gap-2">
                    <span className="text-3xl" aria-hidden>
                      {['🥇', '🥈', '🥉'][i]}
                    </span>
                    <Avatar codename={p.codename} className={`size-12 text-sm sm:size-14 ${p.guardianId === guardian.guardianId ? 'ring-accent' : ''}`} />
                    <span className="max-w-full truncate text-sm font-semibold text-fg">
                      {p.codename}
                      {p.guardianId === guardian.guardianId && <span className="ml-1 text-xs text-accent">(you)</span>}
                    </span>
                    <span className={`font-pixel text-xs tabular-nums sm:text-base ${podiumColor[i]}`} title="Score = total XP">
                      {String(p.xp).padStart(5, '0')}
                    </span>
                  </Link>
                  <div
                    className={`podium-step flex w-full items-start justify-center rounded-t-xl pt-2 font-pixel text-lg sm:text-2xl ${podiumHeight[i]} ${podiumColor[i]}`}
                  >
                    {p.rank}
                  </div>
                </li>
              )
            })}
          </ol>

          <Card className="overflow-x-auto p-2 md:p-4">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line font-pixel text-[9px] text-muted">
                  <th className="px-3 py-3 font-normal">RANK</th>
                  <th className="px-3 py-3 font-normal">NAME</th>
                  <th className="px-3 py-3 font-normal" title="Level, from XP">LV</th>
                  <th className="px-3 py-3 font-normal" title="Score = total XP">SCORE</th>
                  <th className="px-3 py-3 font-normal" title="Glitches fixed">FIXED</th>
                  <th className="px-3 py-3 font-normal" title="Echoes reported">ECHOES</th>
                  <th className="px-3 py-3 font-normal">BADGES</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.guardianId} className={`border-b border-line ${r.guardianId === guardian.guardianId ? 'bg-accent/10' : ''}`}>
                    <td className={`px-3 py-3 font-pixel text-[10px] ${podiumColor[r.rank - 1] ?? 'text-muted'}`}>{ordinal(r.rank)}</td>
                    <td className="px-3 py-3">
                      <Link to="/guardians/$guardianId" params={{ guardianId: r.guardianId }} className="inline-flex items-center gap-2 font-semibold text-fg hover:text-accent">
                        <Avatar codename={r.codename} className="size-7 text-[8px]" />
                        {r.codename}
                        <RoleBadge role={r.role} compact />
                        {r.fresh && <span className="arcade-blink font-pixel text-[8px] text-neon-magenta">NEW</span>}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-pixel text-[10px] text-fg" title={r.title}>
                      {r.level}
                    </td>
                    <td className="px-3 py-3 font-pixel text-[10px] text-neon-gold tabular-nums">{String(r.xp).padStart(5, '0')}</td>
                    <td className="px-3 py-3 text-fg tabular-nums">{r.stats.fixed}</td>
                    <td className="px-3 py-3 text-fg tabular-nums">{r.stats.echoes}</td>
                    <td className="px-3 py-3">
                      <span className="flex flex-wrap gap-1">
                        {r.achievements.map((a) => (
                          <span key={a.id} title={`${ACHIEVEMENTS[a.id].label}: ${ACHIEVEMENTS[a.id].description}`} className="cursor-help">
                            {ACHIEVEMENTS[a.id].icon}
                          </span>
                        ))}
                        {r.badges.map((id) => (
                          <span key={id} title={`${BADGES[id].label}: ${BADGES[id].description}`} className="cursor-help">
                            {BADGES[id].emoji}
                          </span>
                        ))}
                        {r.achievements.length + r.badges.length === 0 && <span className="text-xs text-muted">–</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <section className="flex flex-col gap-3">
            <h2 className="title-pixel text-xs text-muted">All badges</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ...Object.values(ACHIEVEMENTS).map((a) => ({ icon: a.icon, label: a.label, description: a.description })),
                ...Object.values(BADGES).map((b) => ({ icon: b.emoji, label: b.label, description: b.description })),
              ].map((b) => (
                <li key={b.label} className="glass flex items-center gap-3 rounded-2xl px-3 py-2.5">
                  <span className="text-2xl" aria-hidden>
                    {b.icon}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-fg">{b.label}</span>
                    <span className="text-xs text-muted">{b.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
