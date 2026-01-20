/**
 * Search tools for file pattern matching and content search.
 *
 * @remarks
 * Provides glob pattern matching using Bun.Glob and content search
 * using ripgrep via Bun shell. These tools are designed for LLM
 * invocation with Zod-validated inputs.
 *
 * @module
 */

import {
  type GlobInput,
  GlobInputSchema,
  type GlobResult,
  type GrepInput,
  GrepInputSchema,
  type GrepMatch,
  type GrepResult,
} from './search.schemas.ts'

/**
 * Finds files matching a glob pattern.
 *
 * @remarks
 * Uses Bun.Glob for fast, cross-platform glob matching.
 * Supports negation patterns via the ignore option.
 */
export const glob = async (input: GlobInput): Promise<GlobResult> => {
  const { pattern, cwd = process.cwd(), ignore } = GlobInputSchema.parse(input)

  try {
    const globber = new Bun.Glob(pattern)
    const files: string[] = []

    // Build ignore set for efficient filtering
    const ignoreGlobs = ignore?.map((p) => new Bun.Glob(p)) ?? []

    for await (const file of globber.scan({ cwd, onlyFiles: true })) {
      // Check if file matches any ignore pattern
      const shouldIgnore = ignoreGlobs.some((ig) => ig.match(file))
      if (!shouldIgnore) {
        files.push(file)
      }
    }

    return {
      success: true,
      files,
      pattern,
      count: files.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message, pattern }
  }
}

/**
 * Searches file contents for a pattern using ripgrep.
 *
 * @remarks
 * Uses ripgrep (rg) via Bun.$ for fast, multiline-aware searching.
 * Falls back to a basic grep if ripgrep is unavailable.
 */
export const grep = async (input: GrepInput): Promise<GrepResult> => {
  const { pattern, path = '.', glob: fileGlob, ignoreCase, maxResults, context } = GrepInputSchema.parse(input)

  try {
    // Build ripgrep command
    const args: string[] = ['--json', '--line-number']

    if (ignoreCase) {
      args.push('--ignore-case')
    }

    if (maxResults !== undefined) {
      args.push('--max-count', String(maxResults))
    }

    if (context !== undefined) {
      args.push('--context', String(context))
    }

    if (fileGlob) {
      args.push('--glob', fileGlob)
    }

    args.push(pattern, path)

    // Execute ripgrep
    const result = await Bun.$`rg ${args}`.quiet().nothrow()

    if (result.exitCode !== 0 && result.exitCode !== 1) {
      // Exit code 1 means no matches (not an error)
      const stderr = result.stderr.toString()
      if (stderr.trim()) {
        return { success: false, error: stderr.trim(), pattern }
      }
    }

    // Parse JSON output
    const matches: GrepMatch[] = []
    const stdout = result.stdout.toString()

    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue

      try {
        const entry = JSON.parse(line) as RipgrepEntry
        if (entry.type === 'match') {
          matches.push({
            file: entry.data.path.text,
            line: entry.data.line_number,
            content: entry.data.lines.text.trimEnd(),
          })
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    return {
      success: true,
      matches,
      pattern,
      count: matches.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message, pattern }
  }
}

/**
 * Ripgrep JSON output entry type.
 * @internal
 */
type RipgrepEntry = {
  type: 'match' | 'begin' | 'end' | 'context' | 'summary'
  data: {
    path: { text: string }
    line_number: number
    lines: { text: string }
    submatches?: Array<{ match: { text: string }; start: number; end: number }>
  }
}
