/**
 * @module built-in-tools
 *
 * Formatting utilities for MCP tool unstructured text output.
 *
 * @remarks
 * Provides functions to format structured data from workshop discovery tools
 * into unstructured text suitable for MCP tool responses.
 *
 * @public
 */

import type { StoryMetadata, TemplateExport } from './workshop.types.ts'

/**
 * Formats story metadata for MCP tool unstructured text output.
 *
 * @param stories - Map of story metadata from `collectStories`
 * @returns JSON string with story data suitable for MCP tool response
 *
 * @public
 */
export const formatStoriesOutput = (stories: Map<string, StoryMetadata>): string => {
  const data = {
    stories: Array.from(stories.values()).map((story) => ({
      route: story.route,
      exportName: story.exportName,
      filePath: story.filePath,
      hasPlay: story.hasPlay,
      flag: story.flag,
    })),
  }
  return JSON.stringify(data, null, 2)
}

/**
 * Formats behavioral element metadata for MCP tool unstructured text output.
 *
 * @param elements - Array of template exports from `discoverBehavioralTemplateMetadata`
 * @returns JSON string with element data suitable for MCP tool response
 *
 * @public
 */
export const formatBehavioralElementsOutput = (elements: TemplateExport[]): string => {
  return JSON.stringify({ elements }, null, 2)
}

/**
 * Formats story URL for MCP tool unstructured text output.
 *
 * @param result - URL result from `getStoryUrl`
 * @returns JSON string with URL data suitable for MCP tool response
 *
 * @public
 */
export const formatStoryUrlOutput = (result: { url: string; templateUrl: string }): string => {
  return JSON.stringify(result, null, 2)
}
