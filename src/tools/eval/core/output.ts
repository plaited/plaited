/**
 * Shared output utilities for writing results and logging.
 *
 * @remarks
 * Provides consistent output handling across all commands:
 * - Writing to stdout or files
 * - Progress logging to stderr
 * - Path resolution
 * - Content preview (head/tail)
 *
 * @packageDocumentation
 */

import { appendFile } from 'node:fs/promises'
import { HEAD_LINES, TAIL_LINES } from '../schemas/constants.ts'

/**
 * Write output line to stdout or file.
 *
 * @remarks
 * When writing to a file, supports both overwrite and append modes.
 * When writing to stdout, uses console.log.
 *
 * @param line - Content to write (without trailing newline)
 * @param outputPath - Optional file path (stdout if undefined)
 * @param append - If true, append to file instead of overwrite
 *
 * @public
 */
export const writeOutput = async (line: string, outputPath?: string, append?: boolean): Promise<void> => {
  if (outputPath) {
    if (append) {
      await appendFile(outputPath, `${line}\n`)
    } else {
      await Bun.write(outputPath, `${line}\n`)
    }
  } else {
    console.log(line)
  }
}

/**
 * Log progress message to stderr.
 *
 * @remarks
 * Progress output goes to stderr to avoid polluting stdout
 * when piping command output.
 *
 * @param message - Progress message to display
 * @param showProgress - If false, message is suppressed
 *
 * @public
 */
export const logProgress = (message: string, showProgress: boolean): void => {
  if (showProgress) {
    console.error(message)
  }
}

/**
 * Resolve path relative to process.cwd().
 *
 * @remarks
 * Absolute paths (starting with /) are returned as-is.
 * Relative paths are joined with current working directory.
 *
 * @param path - Path to resolve
 * @returns Absolute path
 *
 * @public
 */
export const resolvePath = (path: string): string => {
  if (path.startsWith('/')) return path
  return `${process.cwd()}/${path}`
}

/**
 * Create head/tail preview of content.
 *
 * @remarks
 * Shows first N and last M lines with omission indicator in between.
 * Useful for large files/content in markdown output.
 *
 * @param content - Full content string
 * @param headLines - Number of lines from start (default from constants)
 * @param tailLines - Number of lines from end (default from constants)
 * @returns Truncated content with omission indicator
 *
 * @public
 */
export const headTailPreview = (content: string, headLines = HEAD_LINES, tailLines = TAIL_LINES): string => {
  const lines = content.split('\n')
  if (lines.length <= headLines + tailLines) {
    return content
  }
  const head = lines.slice(0, headLines).join('\n')
  const tail = lines.slice(-tailLines).join('\n')
  const omitted = lines.length - headLines - tailLines
  return `${head}\n\n// ... ${omitted} lines omitted ...\n\n${tail}`
}

/**
 * Get preview text for input (handles string or array).
 *
 * @remarks
 * For arrays (multi-turn), shows turn count and preview of first turn.
 * For strings, shows first 50 characters.
 *
 * @param input - String or array input
 * @returns Preview text suitable for progress display
 *
 * @public
 */
export const getInputPreview = (input: string | string[]): string => {
  if (Array.isArray(input)) {
    const first = input[0] ?? ''
    return `[${input.length} turns] ${first.slice(0, 40)}...`
  }
  return input.slice(0, 50)
}
