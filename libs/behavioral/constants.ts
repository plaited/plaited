export const streamEvents = {
  trigger: 'trigger',
  select: 'select-event',
  snapshot: 'state-snapshot',
  end: 'end',
} as const

export const strategies = {
  randomized: 'randomized',
  priority: 'priority',
  chaos: 'chaos',
  custom: 'custom',
} as const
