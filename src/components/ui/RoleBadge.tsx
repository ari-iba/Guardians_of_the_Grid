import { Shield, Star } from 'lucide-react'
import type { Role } from '#/lib/guardian.ts'

const styles: Record<Role, string> = {
  commander: 'bg-amber-400/20 text-amber-300 ring-amber-300/30',
  defender: 'bg-sky-400/20 text-sky-300 ring-sky-300/30',
  system: 'bg-white/10 text-white/70 ring-white/20',
}

/** Role pill. `compact` shows a short label for the narrow sidebar. */
export function RoleBadge({ role, compact = false }: { role: Role; compact?: boolean }) {
  const Icon = role === 'commander' ? Star : Shield
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1 ${styles[role]}`}
    >
      <Icon className="size-3" strokeWidth={2.5} />
      {compact ? (role === 'commander' ? 'Cmd' : 'Def') : role}
    </span>
  )
}
