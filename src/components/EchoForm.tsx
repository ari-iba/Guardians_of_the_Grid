import { useRef, useState, type FormEvent, type Ref } from 'react'
import { LoaderCircle, MapPin, Mic, MicOff, Radio } from 'lucide-react'
import { useSpeechToText } from '#/lib/speech.ts'
import { DISTRICTS, DISTRICT_LABELS, type District } from '#/lib/district.ts'
import { ECHO_DESCRIPTION_MAX } from '#/lib/echo.ts'
import { createEcho } from '#/lib/glitches.functions.ts'

type EchoFormProps = {
  /** Add to this glitch; omit to open a new LEAKED glitch. */
  glitchId?: string
  onCreated: (result: Awaited<ReturnType<typeof createEcho>>) => void
  onCancel?: () => void
  textareaRef?: Ref<HTMLTextAreaElement>
  autoFocus?: boolean
}

export function EchoForm({ glitchId, onCreated, onCancel, textareaRef, autoFocus }: EchoFormProps) {
  const [description, setDescription] = useState('')
  const [district, setDistrict] = useState<District | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const length = description.trim().length
  const tooLong = length > ECHO_DESCRIPTION_MAX

  // Dictation appends to whatever was typed before the mic was switched on.
  const dictationBase = useRef('')
  const speech = useSpeechToText((transcript) =>
    setDescription([dictationBase.current, transcript].filter(Boolean).join(' ')),
  )
  const toggleDictation = () => {
    if (speech.listening) return speech.stop()
    dictationBase.current = description.trim()
    speech.start()
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const result = await createEcho({
        data: { description, glitchId: glitchId ?? null, district: glitchId ? null : district || null },
      })
      setDescription('')
      setDistrict('')
      onCreated(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the echo.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      {!glitchId && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-fg">Where?</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {DISTRICTS.map((d) => (
              <label
                key={d}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition has-focus-visible:ring-2 has-focus-visible:ring-accent/40 ${
                  district === d ? 'border-accent bg-accent/10 font-semibold text-fg' : 'border-line text-muted hover:bg-subtle'
                }`}
              >
                <input
                  type="radio"
                  name="district"
                  value={d}
                  checked={district === d}
                  onChange={() => setDistrict(d)}
                  className="sr-only"
                />
                <MapPin className="size-3.5 shrink-0" />
                {DISTRICT_LABELS[d]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
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
          {speech.supported && (
            <button
              type="button"
              onClick={toggleDictation}
              aria-pressed={speech.listening}
              aria-label={speech.listening ? 'Stop dictation' : 'Dictate with your microphone'}
              title={speech.listening ? 'Stop dictation' : 'Speak your echo'}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                speech.listening ? 'animate-pulse border-red-500 bg-red-500/10 text-red-600' : 'border-line text-muted hover:bg-subtle hover:text-fg'
              }`}
            >
              {speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              <span className="hidden sm:inline">{speech.listening ? 'Listening…' : 'Speak'}</span>
            </button>
          )}
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
            disabled={pending || length === 0 || tooLong || (!glitchId && !district)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-md shadow-accent/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Radio className="size-4" />}
            {glitchId ? 'Send update' : 'Report echo'}
          </button>
        </div>
      </div>

      {speech.error && <p className="text-xs text-red-600 dark:text-red-400">{speech.error}</p>}
      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </form>
  )
}
