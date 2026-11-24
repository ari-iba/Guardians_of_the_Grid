import { Siren } from 'lucide-react'

export function LockdownBanner({ magic, leaked }: { magic: number; leaked: number }) {
  return (
    <div
      role="alert"
      className="lockdown-banner flex flex-wrap items-center gap-x-4 gap-y-1 bg-red-600 px-4 py-2.5 text-white shadow-lg shadow-red-900/30 md:px-10"
    >
      <span className="inline-flex items-center gap-2 font-bold tracking-wide">
        <Siren className="size-5 animate-pulse" />
        LOCKDOWN — major Desync attack in progress
      </span>
      <span className="text-sm text-white/85">
        Magic at {magic}% · {leaked} glitch{leaked === 1 ? '' : 'es'} leaked
      </span>
    </div>
  )
}
