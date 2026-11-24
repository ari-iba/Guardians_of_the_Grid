import { useState, type FormEvent, type Ref } from 'react'
import { LoaderCircle, Radio } from 'lucide-react'
import { ECHO_DESCRIPTION_MAX } from '#/lib/echo.ts'
import { createEcho } from '#/lib/glitches.functions.ts'

type EchoFormProps = {
  /** Add to this glitch; omit to open a new LEAKED glitch. */
  glitchId?: string
  onCreated: (result: { glitchId: string; echoId: string; createdGlitch: boolean }) => void
  onCancel?: () => void
  textareaRef?: Ref<HTMLTextAreaElement>
  autoFocus?: boolean
}

export function EchoForm({ glitchId, onCreated, onCancel, textareaRef, autoFocus }: EchoFormProps) {
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const length = description.trim().length
  const tooLong = length > ECHO_DESCRIPTION_MAX

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const result = await createEcho({ data: { description, glitchId: glitchId ?? null } })
      setDescription('')
      onCreated(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the echo.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg">
          {glitchId ? 'Update for this glitch' : 'What did you observe?'}
        </span>
        <textarea
          ref={textareaRef}
          autoFocus={autoFocus}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
          }}
          rows={glitchId ? 3 : 4}
          maxLength={ECHO_DESCRIPTION_MAX + 100}
          placeholder={
            glitchId
              ? 'e.g. Containment runes placed, flicker is slowing down…'
              : 'e.g. Street lights in the market square blink in reverse order…'
          }
          className="w-full resize-y rounded-xl border border-line bg-panel px-4 py-3 text-fg placeholder:text-muted/70 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`text-xs ${tooLong ? 'font-semibold text-red-600' : 'text-muted'}`}>
          {length}/{ECHO_DESCRIPTION_MAX} · timestamp is set to now
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted transition hover:bg-subtle hover:text-fg"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={pending || length === 0 || tooLong}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-md shadow-accent/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Radio className="size-4" />}
            {glitchId ? 'Send update' : 'Report echo'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </form>
  )
}
