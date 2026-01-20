/**
 * Markdown link extraction utility for progressive loading.
 *
 * @remarks
 * Extracts `[text](path)` patterns from markdown content.
 * Used by skill-discovery and rules-discovery for progressive
 * loading of referenced files based on semantic search.
 *
 * Path resolution is the caller's responsibility - this module
 * returns raw relative paths as written in the markdown.
 *
 * @module
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A markdown link extracted from content.
 *
 * @remarks
 * The `displayText` serves as the semantic key for search indexing.
 * The `relativePath` is returned as-is; caller resolves relative to source file.
 */
export type MarkdownLink = {
  /** The display text portion `[text]` - used as semantic key */
  displayText: string
  /** The path portion `(path)` - relative, caller resolves */
  relativePath: string
  /** 1-indexed line number where the link appears */
  lineNumber: number
}

/**
 * Options for extracting markdown links.
 */
export type ExtractLinksOptions = {
  /** Filter to only include links matching this path pattern */
  pathPattern?: RegExp
  /** Filter to only include links to these extensions (e.g., ['.md', '.ts']) */
  extensions?: string[]
  /** Include external links (http://, https://). Default: false */
  includeExternal?: boolean
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Regex pattern for markdown links.
 *
 * @remarks
 * Captures:
 * - Group 1: Display text (content between `[` and `]`)
 * - Group 2: Path (content between `(` and `)`)
 *
 * Does NOT match:
 * - Image links `![alt](src)` (negative lookbehind)
 * - Reference-style links `[text][ref]`
 *
 * @internal
 */
const MARKDOWN_LINK_REGEX = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g

// ============================================================================
// Implementation
// ============================================================================

/**
 * Extracts markdown links from content.
 *
 * @param content - Markdown content to parse
 * @param options - Optional filtering options
 * @returns Array of extracted markdown links with position information
 *
 * @remarks
 * Links are returned in order of appearance.
 * External links (http://, https://) are excluded by default.
 * Path resolution is the caller's responsibility.
 */
export const extractMarkdownLinks = (content: string, options: ExtractLinksOptions = {}): MarkdownLink[] => {
  const { pathPattern, extensions, includeExternal = false } = options

  const links: MarkdownLink[] = []
  const lines = content.split('\n')

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!
    const matches = line.matchAll(MARKDOWN_LINK_REGEX)

    for (const match of matches) {
      const displayText = match[1]!
      const relativePath = match[2]!

      // Skip external links unless explicitly included
      if (!includeExternal && isExternalLink(relativePath)) {
        continue
      }

      // Apply path pattern filter
      if (pathPattern && !pathPattern.test(relativePath)) {
        continue
      }

      // Apply extension filter
      if (extensions && extensions.length > 0) {
        const ext = getExtension(relativePath)
        if (!extensions.includes(ext)) {
          continue
        }
      }

      links.push({
        displayText,
        relativePath,
        lineNumber: lineIndex + 1, // 1-indexed
      })
    }
  }

  return links
}

/**
 * Checks if a path is an external URL.
 *
 * @param path - Path to check
 * @returns True if path starts with http:// or https://
 */
export const isExternalLink = (path: string): boolean => path.startsWith('http://') || path.startsWith('https://')

/**
 * Extracts the file extension from a path.
 *
 * @param path - File path
 * @returns Extension including the dot, or empty string if none
 */
export const getExtension = (path: string): string => {
  const lastDot = path.lastIndexOf('.')
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))

  // No dot, or dot is before last slash (directory with dot)
  if (lastDot === -1 || lastDot < lastSlash) {
    return ''
  }

  return path.slice(lastDot)
}
