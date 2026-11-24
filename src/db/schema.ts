import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
// Relative imports: drizzle-kit loads this file and doesn't resolve the `#/` alias.
import { DISTRICTS } from '../lib/district.ts'
import { ECHO_KINDS } from '../lib/echo.ts'
import { GLITCH_STATUSES } from '../lib/glitch.ts'
import { ROLES } from '../lib/guardian.ts'
import { AUTO_TRIGGERS, GLITCH_SOURCES, METRICS } from '../lib/sensors.ts'

export const guardians = sqliteTable('guardians', {
  guardianId: text('guardian_id').primaryKey(),
  codename: text('codename').notNull().unique(),
  role: text('role', { enum: ROLES }).notNull(),
  /** scrypt `salt:hash`, see src/lib/password.ts. Never sent to the client. */
  passwordHash: text('password_hash').notNull(),
})

export const glitches = sqliteTable('glitches', {
  glitchId: text('glitch_id').primaryKey(),
  status: text('status', { enum: GLITCH_STATUSES }).notNull(),
  description: text('description').notNull(),
  /** ISO 8601, so lexical order is chronological order. */
  timestamp: text('timestamp').notNull(),
  district: text('district', { enum: DISTRICTS }).notNull().default('old-market'),
  assignedGuardianId: text('assigned_guardian_id').references(
    () => guardians.guardianId,
  ),
  /** ISO 8601. Only src/lib/workflow.ts changes status, and it keeps this in sync. */
  statusChangedAt: text('status_changed_at').notNull().default('1970-01-01T00:00:00.000Z'),
  /** `auto` = created by the Desync Engine (shown with a 🤖). */
  source: text('source', { enum: GLITCH_SOURCES }).notNull().default('manual'),
  /** Auto-glitches only: what triggered it, and for sensor triggers which metric. */
  trigger: text('trigger', { enum: AUTO_TRIGGERS }),
  metric: text('metric', { enum: METRICS }),
})

export const echoes = sqliteTable('echoes', {
  echoId: text('echo_id').primaryKey(),
  description: text('description').notNull(),
  /** ISO 8601 */
  timestamp: text('timestamp').notNull(),
  district: text('district', { enum: DISTRICTS }).notNull().default('old-market'),
  reportingGuardianId: text('reporting_guardian_id')
    .notNull()
    .references(() => guardians.guardianId),
  glitchId: text('glitch_id')
    .notNull()
    .references(() => glitches.glitchId),
  /** `report` = a sighting by a guardian; `audit` = a workflow log line written by SYSTEM. */
  kind: text('kind', { enum: ECHO_KINDS }).notNull().default('report'),
  /** Audit echoes only: the status change they record (used by the timeline replay). */
  statusBefore: text('status_before', { enum: GLITCH_STATUSES }),
  statusAfter: text('status_after', { enum: GLITCH_STATUSES }),
})

export const sensorReadings = sqliteTable(
  'sensor_readings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    district: text('district', { enum: DISTRICTS }).notNull(),
    metric: text('metric', { enum: METRICS }).notNull(),
    /** 0–100, higher is healthier. */
    value: real('value').notNull(),
    /** ISO 8601 */
    timestamp: text('timestamp').notNull(),
  },
  (t) => [index('sensor_series_idx').on(t.district, t.metric, t.id), index('sensor_time_idx').on(t.timestamp)],
)

/** Small key/value store (JSON values) for simulation switches and the tick clock. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
