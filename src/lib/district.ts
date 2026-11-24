/** Districts of Achrona. Ids are stored in the database; labels are shown in the UI. */
export const DISTRICTS = [
  'clocktower',
  'archives',
  'old-market',
  'harbor',
  'ember-fields',
  'skyforge',
] as const

export type District = (typeof DISTRICTS)[number]

export const DISTRICT_LABELS: Record<District, string> = {
  clocktower: 'Clocktower Quarter',
  archives: 'Archive Vaults',
  'old-market': 'Old Market',
  harbor: 'Crystal Harbor',
  'ember-fields': 'Ember Fields',
  skyforge: 'Skyforge',
}

export function isDistrict(value: unknown): value is District {
  return typeof value === 'string' && (DISTRICTS as readonly string[]).includes(value)
}

export function districtLabel(district: string): string {
  return isDistrict(district) ? DISTRICT_LABELS[district] : district
}
