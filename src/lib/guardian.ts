/** What a guardian may do. A commander can do everything a defender can, plus admin. */
export const ROLES = ['defender', 'commander'] as const

export type Role = (typeof ROLES)[number]

export type Guardian = {
  guardianId: string
  codename: string
  role: Role
}
