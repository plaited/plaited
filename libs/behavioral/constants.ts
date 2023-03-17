export const streamEvents = {
  select: 'select-event',
  snapshot: 'state-snapshot',
} as const

export const strategies = {
  randomized: 'randomized',
  priority: 'priority',
  chaos: 'chaos',
  custom: 'custom',
} as const
