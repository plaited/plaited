/**
 * @internal
 * @module workshop-utils
 *
 * Purpose: Shared utility functions for workshop tooling
 * Contains reusable functions used across workshop modules
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
