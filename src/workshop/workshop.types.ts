/**
 * Template type classification for Plaited templates and functions.
 * - FunctionTemplate: Functions that return TemplateObject/JSX
 * - BehavioralTemplate: Templates created with bElement
 */
export type TemplateType = 'FunctionTemplate' | 'BehavioralTemplate'

/**
 * Metadata for a template export.
 * Contains information about exported templates in a TypeScript file.
 */
export type TemplateExport = {
  /** Name of the exported template */
  exportName: string
  /** File path to the template file */
  filePath: string
  /** Template type classification */
  type: TemplateType
}

/**
 * Metadata extracted from story files during discovery.
 * Used for generating test routes and entry points.
 *
 * @property exportName - Named export identifier from the story file
 * @property filePath - Absolute path to the .stories.tsx file
 * @property type - Story type based on presence of play function
 * @property hasPlay - true if story has a play function
 * @property hasArgs - true if story has an args property
 * @property hasTemplate - true if story has a template property
 * @property hasParameters - true if story has a parameters property
 * @property flag - Test filtering flag: 'only' to run exclusively, 'skip' to skip, undefined for normal execution
 */
export type StoryMetadata = {
  exportName: string
  filePath: string
  type: 'interaction' | 'snapshot'
  hasPlay: boolean
  hasArgs: boolean
  hasTemplate: boolean
  hasParameters: boolean
  flag?: 'only' | 'skip'
  timeout: number
  route: string
  entryPath: string
}

/**
 * Detail object for run_tests event.
 * Allows specifying which stories to run and the color scheme for testing.
 *
 * @property metadata - Optional array of story metadata to run. If undefined, all stories will be discovered and run.
 * @property colorScheme - Color scheme preference for browser context. Defaults to 'light' if not specified.
 */
export type RunTestsDetail = {
  metadata?: Map<string, StoryMetadata>
  colorScheme?: 'light' | 'dark'
}
