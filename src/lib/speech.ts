import { useEffect, useRef, useState } from 'react'

// Minimal typing for the (still prefixed in Chrome/Safari) Web Speech API.
type RecognitionResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: { results: RecognitionResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Dictation for a text field. `onTranscript` receives the full transcript so far (interim included).
 * `supported` is false on the server and in browsers without the API, so callers can hide the button.
 */
export function useSpeechToText(onTranscript: (text: string) => void) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognition = useRef<Recognition | null>(null)
  const callback = useRef(onTranscript)
  callback.current = onTranscript

  useEffect(() => {
    setSupported(recognitionCtor() !== null)
    return () => recognition.current?.abort()
  }, [])

  function start() {
    const Ctor = recognitionCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (event) => {
      const text = Array.from(event.results, (r) => r[0].transcript).join(' ')
      callback.current(text.trim())
    }
    rec.onerror = (event) => {
      setError(event.error === 'not-allowed' ? 'Microphone access was blocked.' : 'Could not understand that, try again.')
    }
    rec.onend = () => setListening(false)
    recognition.current = rec
    setError(null)
    setListening(true)
    rec.start()
  }

  function stop() {
    recognition.current?.stop()
  }

  return { supported, listening, error, start, stop }
}
