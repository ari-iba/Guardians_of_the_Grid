import { useEffect, useRef } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { EchoForm } from '#/components/EchoForm.tsx'
import { IconButton } from '#/components/ui/IconButton.tsx'
import { useAppUi } from '#/lib/app-ui.ts'

/** Modal for reporting a brand-new echo (which opens a new LEAKED glitch). */
export function ReportEchoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const navigate = useNavigate()
  const { notify } = useAppUi()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      textareaRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="report-echo-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-line bg-card p-0 text-fg shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="report-echo-title" className="text-xl font-semibold">
              Report an echo
            </h2>
            <p className="mt-1 text-sm text-muted">
              Every echo opens a new <strong className="text-red-600 dark:text-red-400">LEAKED</strong> glitch.
              To add to an existing glitch, post an update on its page.
            </p>
          </div>
          <IconButton aria-label="Close" onClick={onClose} className="rounded-lg p-1 hover:bg-subtle">
            <X className="size-5" />
          </IconButton>
        </div>
        {open && (
          <EchoForm
            textareaRef={textareaRef}
            onCancel={onClose}
            onCreated={async ({ glitchId, clustered, summary }) => {
              onClose()
              await router.invalidate()
              if (clustered && summary) notify(summary, 'warning')
              await navigate({ to: '/glitches/$glitchId', params: { glitchId } })
            }}
          />
        )}
      </div>
    </dialog>
  )
}
