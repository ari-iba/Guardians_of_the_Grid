/**
 * What a guardian may do. A commander can do everything a defender can, plus admin.
 * `system` is the built-in SYSTEM guardian that writes audit echoes and auto-detections; it cannot log in.
 */
export const ROLES = ['defender', 'commander', 'system'] as const

export type Role = (typeof ROLES)[number]

export type Guardian = {
  guardianId: string
  codename: string
  role: Role
}

/** The built-in guardian used for audit logs and automatic actions. */
export const SYSTEM_GUARDIAN: Guardian = { guardianId: 'SYSTEM', codename: 'SYSTEM', role: 'system' }
