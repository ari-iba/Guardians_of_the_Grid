import { useCallback, useEffect, useState } from 'react'

/**
 * A choice remembered in localStorage. Renders `fallback` on the server and first paint,
 * then switches to the stored value after mount (no hydration mismatch).
 */
export function useStoredChoice<T extends string>(key: string, options: readonly T[], fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(fallback)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored && (options as readonly string[]).includes(stored)) setValue(stored as T)
    } catch {
      /* storage unavailable */
    }
    // options is a constant list per call site
  }, [key])
  const set = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(key, next)
      } catch {
        /* storage unavailable */
      }
    },
    [key],
  )
  return [value, set]
}
