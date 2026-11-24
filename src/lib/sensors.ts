// Shared (client + server) sensor definitions. Relative imports: also loaded by plain Node.
import type { District } from './district.ts'

export const METRICS = ['magic', 'time_stability', 'portal_flux'] as const
export type Metric = (typeof METRICS)[number]

export const METRIC_LABELS: Record<Metric, string> = {
  magic: 'Magic',
  time_stability: 'Time stability',
  portal_flux: 'Portal flux',
}

/** Healthy level each metric drifts around (0–100, higher is healthier). */
export const NORMAL_LEVEL: Record<Metric, number> = {
  magic: 82,
  time_stability: 88,
  portal_flux: 76,
}

/** Below this a glitch is auto-created. */
export const SENSOR_THRESHOLD = 25
/** A drop larger than this within RAPID_DROP_WINDOW readings is a glitch too. */
export const RAPID_DROP = 30
export const RAPID_DROP_WINDOW = 5
/** Server-side minimum time between two sensor ticks, whatever the number of open tabs. */
export const TICK_INTERVAL_MS = 5000

/** How an auto-glitch came to be. */
export const GLITCH_SOURCES = ['manual', 'auto'] as const
export type GlitchSource = (typeof GLITCH_SOURCES)[number]
export const AUTO_TRIGGERS = ['threshold', 'drop', 'cluster', 'random'] as const
export type AutoTrigger = (typeof AUTO_TRIGGERS)[number]

export const TRIGGER_LABELS: Record<AutoTrigger, string> = {
  threshold: 'Sensor below threshold',
  drop: 'Rapid sensor drop',
  cluster: 'Echo cluster',
  random: 'Spontaneous Desync event',
}

export type SimulationSettings = {
  autoDesync: boolean
  autoAssign: boolean
  /** Districts under a simulated attack, with the metrics that are crashing. */
  attacks: Partial<Record<District, Metric[]>>
}

export type SensorPoint = { value: number; timestamp: string }
