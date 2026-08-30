import * as path from 'node:path'
import * as z from 'zod'
import type { CwdProvision, ToolArgs } from './pack.types.ts'

/**
 * Approximate ceiling for read output — mirrors pi's DEFAULT_MAX_LINES (2000)
 * and DEFAULT_MAX_BYTES (50 KB).
 *
 * MINIMAL: exact limits match pi's constants. Upgrade path: export configurable
 * limits from a shared constants file.
 */
const MAX_LINES = 2000
const MAX_BYTES = 50 * 1024

export const inputSchema = z.object({
  path: z
    .string()
    .min(1, 'path must be non-empty')
    .describe("file path — absolute, or relative to the tool's provisioned cwd"),
  offset: z.number().int().positive().optional().describe('1-indexed line to start reading from'),
  limit: z.number().int().positive().optional().describe('maximum number of lines to read'),
})

export const outputSchema = z.object({
  content: z.string(),
  truncated: z.boolean(),
  isError: z.boolean().optional().describe('true when the result is an error message rather than file content'),
})

export type ReadInput = z.output<typeof inputSchema>
export type ReadOutput = z.output<typeof outputSchema>

/**
 * Read a file with optional offset/limit line windowing.
 *
 * Paths resolve against the provisioned cwd (absolute paths win). When the
 * file is missing or unreadable, returns a structured error result rather
 * than throwing — the StreamFn contract applies to tools too.
 */
export const run = async (input: ReadInput & CwdProvision): Promise<ReadOutput> => {
  const { path: filePath, offset, limit, cwd } = input
  const resolved = path.resolve(cwd ?? process.cwd(), filePath)

  const bunFile = Bun.file(resolved)
  const exists = await bunFile.exists()
  if (!exists) {
    return { content: `[Error: file not found: ${resolved}]`, truncated: false, isError: true }
  }

  let text: string
  try {
    text = await bunFile.text()
  } catch {
    return { content: `[Error: could not read file: ${resolved}]`, truncated: false, isError: true }
  }

  const allLines = text.split('\n')
  const totalLines = allLines.length

  // Apply offset (1-indexed, exclusive on the upper bound if limit is given)
  const startLine = offset ? Math.max(0, offset - 1) : 0
  if (startLine >= totalLines) {
    return {
      content: `[Error: offset ${offset} is beyond end of file (${totalLines} lines total)]`,
      truncated: false,
      isError: true,
    }
  }

  const endLine = limit ? Math.min(startLine + limit, totalLines) : totalLines
  const windowed = allLines.slice(startLine, endLine).join('\n')

  // Check truncation ceiling
  const bytes = new TextEncoder().encode(windowed).byteLength
  const windowLines = endLine - startLine

  if (bytes > MAX_BYTES) {
    const truncated = windowed.slice(0, MAX_BYTES)
    return { content: truncated, truncated: true }
  }
  if (windowLines > MAX_LINES) {
    const truncated = allLines.slice(startLine, startLine + MAX_LINES).join('\n')
    return { content: truncated, truncated: true }
  }

  return { content: windowed, truncated: false }
}

const readTool: ToolArgs<typeof inputSchema, typeof outputSchema, CwdProvision> = Object.freeze({
  name: 'read',
  description:
    'Read the contents of a file. Output is truncated to 2000 lines or 50KB (whichever is hit first). Use offset/limit for large files.',
  inputSchema,
  outputSchema,
  run,
})

export default readTool
