/**
 * CLI command name for AGENTS.md discovery.
 *
 * @public
 */
export const AGENTS_MD_COMMAND = 'agents-md'

/**
 * Repository search pattern for scoped AGENTS.md instruction files.
 *
 * @public
 */
export const AGENTS_MD_DISCOVERY_GLOB = '**/AGENTS.md'

const nestedGlob = (directory: string): string => ['**', directory, '**'].join('/')

/**
 * Built-in discovery exclusions for generated, dependency, and temporary trees.
 *
 * @public
 */
export const AGENTS_MD_DEFAULT_IGNORE_GLOBS = [
  nestedGlob('.git'),
  nestedGlob('node_modules'),
  nestedGlob('dist'),
  nestedGlob('build'),
  nestedGlob('coverage'),
  nestedGlob('tmp'),
  nestedGlob('temp'),
] as const
