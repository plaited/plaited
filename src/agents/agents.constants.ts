export const AGENTS_COMMAND = 'agents'

export const AGENTS_DISCOVERY_GLOB = '**/AGENTS.md'

export const AGENTS_DEFAULT_IGNORE_GLOBS = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/tmp/**',
  '**/temp/**',
] as const
