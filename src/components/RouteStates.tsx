import { Link, useRouter, useRouterState, type ErrorComponentProps } from '@tanstack/react-router'
import { RotateCw, SatelliteDish, TriangleAlert } from 'lucide-react'

/** Thin accent bar at the top while a navigation (not a background poll) is loading. */
export function NavigationProgress() {
  const navigating = useRouterState({
    select: (s) => s.isLoading && s.location.href !== s.resolvedLocation?.href,
  })
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-accent transition-all duration-500 ${
        navigating ? 'scale-x-75 opacity-100' : 'scale-x-100 opacity-0'
      }`}
    />
  )
}

/** Skeleton shown when a page takes a moment to load. */
export function PendingPage() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-28 rounded-full bg-subtle" />
      <div className="h-8 w-2/3 max-w-lg rounded-xl bg-subtle" />
      <div className="h-32 rounded-3xl bg-subtle" />
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-subtle" />
        ))}
      </div>
    </div>
  )
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
      <TriangleAlert className="size-10 text-red-500" strokeWidth={1.5} />
      <h1 className="text-lg font-semibold text-fg">Signal lost</h1>
      <p className="text-sm text-muted">{error instanceof Error ? error.message : 'Something went wrong.'}</p>
      <button
        type="button"
        onClick={() => {
          reset()
          void router.invalidate()
        }}
        className="btn-game mt-2 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
      >
        <RotateCw className="size-4" /> Try again
      </button>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
      <SatelliteDish className="size-10 text-muted" strokeWidth={1.5} />
      <h1 className="text-lg font-semibold text-fg">Nothing on this frequency</h1>
      <p className="text-sm text-muted">This page doesn’t exist.</p>
      <Link to="/" className="mt-2 text-sm font-semibold text-accent hover:underline">
        Back to mission control
      </Link>
    </div>
  )
}
