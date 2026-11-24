import { useEffect, useRef } from 'react'

type Handlers = Partial<Record<string, (event: KeyboardEvent) => void>>

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * Single-key shortcuts (keyed by `event.key`, e.g. "j", "/", "?", "Enter").
 * Ignored while typing, while a modal dialog is open, and with Ctrl/Cmd/Alt held.
 */
export function useHotkeys(handlers: Handlers): void {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      if (document.querySelector('dialog[open]')) return
      // Let Enter keep activating focused links and buttons.
      if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('a,button')) return
      const handler = ref.current[event.key]
      if (handler) {
        event.preventDefault()
        handler(event)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

export const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ['j'], description: 'Next glitch' },
  { keys: ['k'], description: 'Previous glitch' },
  { keys: ['Enter'], description: 'Open selected glitch' },
  { keys: ['n'], description: 'Report a new echo' },
  { keys: ['/'], description: 'Search glitches' },
  { keys: ['g'], description: 'Go to overview' },
  { keys: ['m'], description: 'Go to map' },
  { keys: ['s'], description: 'Go to sensors' },
  { keys: ['l'], description: 'Go to highscores' },
  { keys: ['q'], description: 'Daily quests & achievements' },
  { keys: ['Ctrl', 'K'], description: 'Command palette' },
  { keys: ['t'], description: 'Toggle dark / light mode' },
  { keys: ['?'], description: 'Show this list' },
  { keys: ['Esc'], description: 'Close dialog / leave search' },
]
