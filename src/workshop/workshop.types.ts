/**
 * Story type classification based on available properties.
 */
export type StoryType = 'interaction' | 'snapshot' | 'unknown'

/**
 * Metadata for a story set export.
 * Contains information about story properties and capabilities.
 */
export type StoryMetadata = {
  /** Name of the exported story */
  exportName: string
  /** File path to the story file */
  filePath: string
  /** Story type classification */
  type: StoryType
  /** Whether the story has a play function */
  hasPlay: boolean
  /** Whether the story has args defined */
  hasArgs: boolean
  /** Whether the story has a template */
  hasTemplate: boolean
  /** Whether the story has parameters */
  hasParameters: boolean
}
