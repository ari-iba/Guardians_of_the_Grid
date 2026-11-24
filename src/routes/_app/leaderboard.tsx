import { createFileRoute } from '@tanstack/react-router'
import { Trophy } from 'lucide-react'
import { Card } from '#/components/ui/Card.tsx'
import { BADGES, getLeaderboard, type LeaderboardEntry } from '#/lib/leaderboard.functions.ts'

export const Route = createFileRoute('/_app/leaderboard')({
  loader: () => getLeaderboard(),
  head: () => ({ meta: [{ title: 'Leaderboard · Control Center' }] }),
  component: LeaderboardPage,
})

const podiumStyle = [
  'from-amber-300/30 to-amber-500/10 ring-amber-400/50 md:-translate-y-3',
  'from-slate-300/30 to-slate-400/10 ring-slate-400/40',
  'from-orange-400/25 to-orange-700/10 ring-orange-500/40',
]
const medal = ['🥇', '🥈', '🥉']

function LeaderboardPage() {
  const entries = Route.useLoaderData()
  const { guardian } = Route.useRouteContext()
  const podium = entries.slice(0, 3)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">Hall of Guardians</p>
        <h1 className="inline-flex items-center gap-2 text-3xl font-semibold text-fg">
          <Trophy className="size-7 text-amber-500" /> Leaderboard
        </h1>
        <p className="text-sm text-muted">Defenders ranked by the glitches they fixed. Badges are earned automatically.</p>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line px-6 py-12 text-center text-sm text-muted">No defenders yet.</p>
      ) : (
        <>
          <ol
            className={`grid items-end gap-4 ${
              podium.length >= 3 ? 'md:grid-cols-3' : podium.length === 2 ? 'w-full md:mx-auto md:max-w-2xl md:grid-cols-2' : 'mx-auto w-full max-w-sm'
            }`}
          >
            {/* Visual order on desktop: 2nd, 1st, 3rd */}
            {podium.map((entry, i) => (
              <li key={entry.guardianId} className={i === 0 ? 'md:order-2' : i === 1 ? 'md:order-1' : 'md:order-3'}>
                <div
                  className={`flex flex-col items-center gap-2 rounded-3xl bg-linear-to-b p-6 text-center ring-1 ${podiumStyle[i]} ${
                    entry.guardianId === guardian.guardianId ? 'outline-2 outline-offset-2 outline-accent' : ''
                  }`}
                >
                  <span className="text-4xl" aria-hidden>
                    {medal[i]}
                  </span>
                  <span className="flex size-14 items-center justify-center rounded-full bg-card text-lg font-bold text-fg uppercase ring-2 ring-line">
                    {entry.codename.slice(0, 2)}
                  </span>
                  <span className="text-lg font-semibold text-fg">
                    {entry.codename}
                    {entry.guardianId === guardian.guardianId && <span className="ml-1 text-xs text-accent">(you)</span>}
                  </span>
                  <span className="text-3xl font-bold text-fg tabular-nums">{entry.fixed}</span>
                  <span className="-mt-2 text-xs tracking-wide text-muted uppercase">fixed</span>
                  <Badges entry={entry} />
                </div>
              </li>
            ))}
          </ol>

          <Card className="overflow-x-auto p-2 md:p-4">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="px-3 py-2 font-normal">#</th>
                  <th className="px-3 py-2 font-normal">Defender</th>
                  <th className="px-3 py-2 font-normal">Fixed</th>
                  <th className="px-3 py-2 font-normal">Open</th>
                  <th className="px-3 py-2 font-normal">Echoes</th>
                  <th className="px-3 py-2 font-normal">Fastest fix</th>
                  <th className="px-3 py-2 font-normal">Badges</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.guardianId} className={`border-b border-line ${e.guardianId === guardian.guardianId ? 'bg-accent/8' : ''}`}>
                    <td className="px-3 py-3 font-semibold text-muted tabular-nums">{e.rank}</td>
                    <td className="px-3 py-3 font-semibold text-fg">{e.codename}</td>
                    <td className="px-3 py-3 text-fg tabular-nums">{e.fixed}</td>
                    <td className="px-3 py-3 text-fg tabular-nums">{e.open}</td>
                    <td className="px-3 py-3 text-fg tabular-nums">{e.echoes}</td>
                    <td className="px-3 py-3 text-muted tabular-nums">{e.fastestMinutes === null ? '–' : `${e.fastestMinutes} min`}</td>
                    <td className="px-3 py-3">
                      <Badges entry={e} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">All badges</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(BADGES).map(([id, b]) => (
                <li key={id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5">
                  <span className="text-2xl" aria-hidden>
                    {b.emoji}
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

function Badges({ entry, compact = false }: { entry: LeaderboardEntry; compact?: boolean }) {
  if (entry.badges.length === 0) return <span className="text-xs text-muted">No badges yet</span>
  return (
    <ul className={`flex flex-wrap gap-1 ${compact ? '' : 'justify-center'}`}>
      {entry.badges.map((id) => (
        <li
          key={id}
          title={`${BADGES[id].label}: ${BADGES[id].description}`}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-card px-2 py-0.5 text-xs text-fg"
        >
          <span aria-hidden>{BADGES[id].emoji}</span>
          {!compact && BADGES[id].label}
          {compact && <span className="sr-only">{BADGES[id].label}</span>}
        </li>
      ))}
    </ul>
  )
}
