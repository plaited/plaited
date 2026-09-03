import * as path from 'node:path'
import type { CwdProvision, JsonObject, ToolArgs } from './tool.types.ts'

/**
 * Approximate ceiling for read output — mirrors pi's DEFAULT_MAX_LINES (2000)
 * and DEFAULT_MAX_BYTES (50 KB).
 */
const MAX_LINES = 2000
const MAX_BYTES = 50 * 1024

export const inputSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: "file path — absolute, or relative to the tool's provisioned cwd" },
    offset: { type: 'integer', description: '1-indexed line to start reading from' },
    limit: { type: 'integer', description: 'maximum number of lines to read' },
  },
  required: ['path'],
  additionalProperties: false,
}

export const outputSchema = {
  type: 'object',
  properties: {
    content: { type: 'string' },
    truncated: { type: 'boolean' },
    isError: { type: 'boolean', description: 'true when the result is an error message rather than file content' },
  },
  required: ['content', 'truncated'],
  additionalProperties: false,
}

type ReadInput = { path: string; offset?: number; limit?: number }
type ReadOutput = { content: string; truncated: boolean; isError?: boolean }

/**
 * Read a file with optional offset/limit line windowing.
 *
 * Reads via `Bun.file.text()`. Paths resolve against the provisioned cwd
 * (absolute paths win). When the file is missing or unreadable, returns a
 * structured error result rather than throwing — the StreamFn contract applies
 * to tools too.
 */
export const run = async (input: JsonObject & CwdProvision): Promise<{ output: ReadOutput }> => {
  const { path: filePath, offset, limit, cwd } = input as ReadInput & CwdProvision
  const resolved = path.resolve(cwd ?? process.cwd(), filePath)

  const bunFile = Bun.file(resolved)
  const exists = await bunFile.exists()
  if (!exists) {
    return { output: { content: `[Error: file not found: ${resolved}]`, truncated: false, isError: true } }
  }

  let text: string
  try {
    text = await bunFile.text()
  } catch {
    return { output: { content: `[Error: could not read file: ${resolved}]`, truncated: false, isError: true } }
  }

  const allLines = text.split('\n')
  const totalLines = allLines.length

  // Apply offset (1-indexed)
  const startLine = offset ? Math.max(0, offset - 1) : 0
  if (startLine >= totalLines) {
    return {
      output: {
        content: `[Error: offset ${offset} is beyond end of file (${totalLines} lines total)]`,
        truncated: false,
        isError: true,
      },
    }
  }

  const endLine = limit ? Math.min(startLine + limit, totalLines) : totalLines
  const windowed = allLines.slice(startLine, endLine).join('\n')

  // Check truncation ceiling
  const bytes = new TextEncoder().encode(windowed).byteLength
  const windowLines = endLine - startLine

  if (bytes > MAX_BYTES) {
    return { output: { content: windowed.slice(0, MAX_BYTES), truncated: true } }
  }
  if (windowLines > MAX_LINES) {
    return { output: { content: allLines.slice(startLine, startLine + MAX_LINES).join('\n'), truncated: true } }
  }

  return { output: { content: windowed, truncated: false } }
}

const readTool: ToolArgs = Object.freeze({
  name: 'read',
  description:
    'Read the contents of a file. Output is truncated to 2000 lines or 50KB (whichever is hit first). Use offset/limit for large files.',
  inputSchema,
  outputSchema,
  run,
})

export default readTool
