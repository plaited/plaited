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
