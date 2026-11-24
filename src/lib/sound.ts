// Generated sound effects (Web Audio API, no audio files). Off by default; toggle stored per browser.
const STORAGE_KEY = 'gotg-sound'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    /* storage unavailable */
  }
  // Called from a click, so this is a good moment to unlock audio.
  if (on) audio()
}

function blip(ac: AudioContext, type: OscillatorType, from: number, to: number, start: number, length: number, volume: number) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(to, start + length)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  osc.connect(gain).connect(ac.destination)
  osc.start(start)
  osc.stop(start + length + 0.02)
}

/** Harsh descending digital stutter + a burst of noise. */
export function playGlitchSound(): void {
  if (!soundEnabled()) return
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  blip(ac, 'square', 880, 120, t, 0.22, 0.05)
  blip(ac, 'sawtooth', 1320, 300, t + 0.08, 0.12, 0.03)
  const noise = ac.createBuffer(1, ac.sampleRate * 0.12, ac.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.2)
  const source = ac.createBufferSource()
  const gain = ac.createGain()
  gain.gain.value = 0.04
  source.buffer = noise
  source.connect(gain).connect(ac.destination)
  source.start(t + 0.02)
}

/** Soft rising chime for a repaired glitch. */
export function playRepairSound(): void {
  if (!soundEnabled()) return
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(ac, 'sine', f, f * 1.01, t + i * 0.08, 0.35, 0.05))
}

/** Tiny 8-bit "tick" for game buttons. */
export function playClick(): void {
  if (!soundEnabled()) return
  const ac = audio()
  if (!ac) return
  blip(ac, 'square', 660, 990, ac.currentTime, 0.05, 0.025)
}
