import { useState, type FormEvent } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { Activity, KeyRound, LoaderCircle, ShieldAlert, UserRound } from 'lucide-react'
import { getCurrentGuardian, login } from '#/lib/auth.functions.ts'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async () => {
    if (await getCurrentGuardian()) throw redirect({ to: '/' })
  },
  head: () => ({ meta: [{ title: 'Log in · Control Center' }] }),
  component: LoginPage,
})

/** Only same-site paths, so `?redirect=` can't send people elsewhere. */
function safeRedirect(target: string | undefined): string {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/'
}

const inputClass =
  'w-full rounded-xl border border-white/15 bg-white/5 py-3 pr-4 pl-11 text-white placeholder:text-white/35 outline-none transition focus:border-accent-from focus:bg-white/10 focus:ring-2 focus:ring-accent/40'

function LoginPage() {
  const router = useRouter()
  const { redirect: redirectTo } = Route.useSearch()
  const [codename, setCodename] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const result = await login({ data: { codename, password } })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.history.push(safeRedirect(redirectTo))
      await router.invalidate()
    } catch {
      setError('Could not reach mission control. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="login-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-sidebar px-4 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-accent/30 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-accent-from to-accent-to text-white shadow-lg shadow-accent/40">
            <Activity className="size-9" strokeWidth={2} />
          </div>
          <p className="text-xs font-semibold tracking-[0.3em] text-accent-from uppercase">
            Guardians of the Grid
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Mission Control</h1>
          <p className="mt-2 text-sm text-white/60">
            Identify yourself, guardian. Achrona is counting on you.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur"
          noValidate
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-white/80">Codename</span>
            <span className="relative">
              <UserRound className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-white/40" />
              <input
                className={inputClass}
                value={codename}
                onChange={(e) => setCodename(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                required
                placeholder="e.g. nova"
              />
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-white/80">Password</span>
            <span className="relative">
              <KeyRound className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-white/40" />
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-2.5 text-sm text-red-200"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-linear-to-br from-accent-from to-accent-to py-3 font-semibold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 disabled:opacity-60"
          >
            {pending && <LoaderCircle className="size-5 animate-spin" />}
            {pending ? 'Verifying…' : 'Enter mission control'}
          </button>
        </form>

        {import.meta.env.DEV && (
          <p className="mt-6 text-center text-xs text-white/40">
            Demo: <code className="text-white/70">nova / commander123</code> (commander) ·{' '}
            <code className="text-white/70">ember / defender123</code> (defender)
          </p>
        )}
      </div>
    </div>
  )
}
