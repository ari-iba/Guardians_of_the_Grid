// Glitches as monsters: everything here is derived from the glitch itself, so the same
// glitch always looks and is named the same — on every screen, for every guardian.
import type { District } from './district.ts'
import type { GlitchStatus, GlitchSummary } from './glitch.ts'
import type { Metric } from './sensors.ts'

/** HP follows the workflow: the further along, the weaker the monster. */
export const HP_BY_STATUS: Record<GlitchStatus, number> = {
  LEAKED: 100,
  ASSESSING: 70,
  CONTAINING: 35,
  FIXED: 0,
}

/** What the game term means in workflow terms (hover text). */
export const STATUS_MEANING: Record<GlitchStatus, string> = {
  LEAKED: 'nobody is on it yet — a commander must assign a defender',
  ASSESSING: 'a defender is assigned and investigating',
  CONTAINING: 'containment in progress — the defender can mark it fixed',
  FIXED: 'fixed — the monster is defeated',
}

export function hpTooltip(status: GlitchStatus): string {
  return `HP ${HP_BY_STATUS[status]}% = Status: ${status} (${STATUS_MEANING[status]})`
}

export const WILD_SPAWN_TOOLTIP = 'Wild spawn = auto-detected by the Desync Engine (🤖), not reported by a guardian'

/** FNV-1a: a small, stable string hash. */
export function hashString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Deterministic pseudo-random numbers in [0, 1) from a seed (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DISTRICT_PREFIX: Record<District, string> = {
  clocktower: 'Clockwork',
  archives: 'Inkbound',
  'old-market': 'Gilded',
  harbor: 'Tidal',
  'ember-fields': 'Cinder',
  skyforge: 'Storm',
}

/** Base hue per district, so monsters from one district look related. */
const DISTRICT_HUE: Record<District, number> = {
  clocktower: 42,
  archives: 275,
  'old-market': 24,
  harbor: 188,
  'ember-fields': 2,
  skyforge: 215,
}

const METRIC_NOUN: Record<Metric, string> = {
  magic: 'Wraith',
  time_stability: 'Chronophage',
  portal_flux: 'Riftling',
}

const MANUAL_NOUNS = ['Gremlin', 'Imp', 'Shade', 'Golem', 'Specter', 'Wisp', 'Goblin', 'Mimic']

type MonsterSource = Pick<GlitchSummary, 'glitchId' | 'district' | 'metric'>

/** E.g. "Clockwork Wraith": district + metric (or a stable pick for manual reports). */
export function monsterName({ glitchId, district, metric }: MonsterSource): string {
  const noun = metric ? METRIC_NOUN[metric] : MANUAL_NOUNS[hashString(glitchId) % MANUAL_NOUNS.length]
  return `${DISTRICT_PREFIX[district]} ${noun}`
}

export type MonsterTraits = {
  hue: number
  /** Body outline: points around the centre, as radius factors. */
  body: number[]
  eyes: 1 | 2 | 3
  eyeSize: number
  mouth: 'fangs' | 'grin' | 'o'
  topper: 'horns' | 'antennae' | 'spikes' | 'none'
  feet: number
  /** Rotation of the whole body blob, for variety. */
  tilt: number
}

export function monsterTraits({ glitchId, district }: MonsterSource): MonsterTraits {
  const rand = seededRandom(hashString(glitchId))
  const body = Array.from({ length: 9 }, () => 0.82 + rand() * 0.3)
  return {
    hue: (DISTRICT_HUE[district] + Math.round((rand() - 0.5) * 40) + 360) % 360,
    body,
    eyes: (1 + Math.floor(rand() * 3)) as 1 | 2 | 3,
    eyeSize: 0.8 + rand() * 0.5,
    mouth: (['fangs', 'grin', 'o'] as const)[Math.floor(rand() * 3)],
    topper: (['horns', 'antennae', 'spikes', 'none'] as const)[Math.floor(rand() * 4)],
    feet: 2 + Math.floor(rand() * 3),
    tilt: Math.round((rand() - 0.5) * 16),
  }
}

/**
 * The boss during a lockdown: the "biggest" open glitch — most HP left, then most echoes,
 * then the oldest. Null when nothing is open.
 */
export function bossOf<T extends Pick<GlitchSummary, 'status' | 'echoCount' | 'timestamp'>>(glitches: T[]): T | null {
  const open = glitches.filter((g) => g.status !== 'FIXED')
  if (open.length === 0) return null
  return [...open].sort(
    (a, b) =>
      HP_BY_STATUS[b.status] - HP_BY_STATUS[a.status] ||
      b.echoCount - a.echoCount ||
      a.timestamp.localeCompare(b.timestamp),
  )[0]
}
