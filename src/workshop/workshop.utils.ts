/**
 * @internal
 * @module workshop-utils
 *
 * Shared utility functions for workshop tooling.
 * Pure utilities used by test runner, server, and CLI.
 */

import { Glob } from 'bun'

/**
 * @internal
 * Discovers files matching a glob pattern within a directory.
 * Uses Bun's Glob API for efficient file discovery.
 *
 * @param cwd - The directory to search in
 * @param pattern - Glob pattern to match files against
 * @returns Array of absolute file paths matching the pattern
 *
 * @remarks
 * - Uses Bun.Glob for fast file discovery
 * - Returns absolute paths resolved via Bun.resolveSync
 * - Scans recursively based on pattern wildcards
 *
 * @see {@link discoverStoryMetadata} for story discovery usage
 * @see {@link discoverBehavioralTemplateMetadata} for template discovery usage
 */
export const globFiles = async (cwd: string, pattern: string): Promise<string[]> => {
  const glob = new Glob(pattern)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

/**
 * @internal
 * Creates a Response for serving content, optionally with gzip compression.
 * Used for bundled JavaScript files and static content.
 *
 * @param content - The content to serve
 * @param contentType - MIME type of the content
 * @param compress - Whether to gzip compress the content (default: false for faster test performance)
 * @returns Response with content (compressed if enabled)
 *
 * @remarks
 * - Compression is disabled by default for faster test performance
 * - Uses Bun.gzipSync for gzip compression
 * - Adds appropriate content-encoding header when compressed
 */
export const zip = ({
  content,
  contentType,
  compress = false,
}: {
  content: string
  contentType: string
  compress?: boolean
}) => {
  if (!compress) {
    return new Response(content, {
      headers: new Headers({
        'content-type': contentType,
      }),
    })
  }

  const compressed = Bun.gzipSync(content)
  return new Response(compressed as BodyInit, {
    headers: new Headers({
      'content-type': contentType,
      'content-encoding': 'gzip',
    }),
  })
}

/**
 * @internal
 * Splits an array of items into batches with a specified number of items per batch.
 *
 * @template T - Type of items in the array
 * @param items - Array of items to split into batches
 * @param itemsPerBatch - Number of items to include in each batch
 * @returns Array of batches, where each batch contains up to itemsPerBatch items
 *
 * @remarks
 * - Creates n batches based on total items / itemsPerBatch
 * - Last batch may contain fewer items if total doesn't divide evenly
 * - Returns empty array if items array is empty
 * - Complexity: O(n) where n is the number of items
 */
export const splitIntoBatches = <T>(items: T[], itemsPerBatch: number): T[][] => {
  const batches: T[][] = []
  const length = items.length
  for (let i = 0; i < length; i += itemsPerBatch) {
    batches.push(items.slice(i, i + itemsPerBatch))
  }

  return batches
}

/**
 * @internal
 * Formats error type constant to readable string.
 * Converts ERROR_TYPES constants (e.g., 'timeout_error') to human-readable format.
 *
 * @param errorType - Error type constant from ERROR_TYPES (e.g., 'timeout_error', 'unknown_error')
 * @returns Formatted error string with emoji prefix (e.g., '🚩 Timeout Error')
 *
 * @remarks
 * - Splits on underscore, capitalizes each word
 * - Adds 🚩 emoji prefix for visual distinction
 * - Used in test failure reporting
 */
export const formatErrorType = (errorType: string): string =>
  `🚩 ${errorType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')}`
