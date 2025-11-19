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
 * @property only - true if story should run exclusively (filters all other stories)
 * @property skip - true if story should be skipped
 */
export type StoryMetadata = {
  exportName: string
  filePath: string
  type: 'interaction' | 'snapshot'
  hasPlay: boolean
  hasArgs: boolean
  hasTemplate: boolean
  hasParameters: boolean
  only?: boolean
  skip?: boolean
}
