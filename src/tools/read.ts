import * as path from 'node:path'
import { fromJsonSchema } from './schema-adapter.ts'
import { useMCPServer } from './use-mcp-server.ts'

/**
 * Approximate ceiling for read output — mirrors pi's DEFAULT_MAX_LINES (2000)
 * and DEFAULT_MAX_BYTES (50 KB).
 */
const MAX_LINES = 2000
const MAX_BYTES = 50 * 1024

export const inputSchema = {
  type: 'object',
  properties: {
    cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
    path: { type: 'string', description: "file path — absolute, or relative to the tool's provisioned cwd" },
    offset: { type: 'integer', description: '1-indexed line to start reading from' },
    limit: { type: 'integer', description: 'maximum number of lines to read' },
  },
  required: ['path', 'cwd'],
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

/**
 * Read a file with optional offset/limit line windowing.
 *
 * Reads via `Bun.file.text()`. Registered via `useMCPServer` as the `read`
 * MCP tool. `cwd` is a required input field — provided by the provisioner.
 * When the file is missing or unreadable, returns a structured error result
 * rather than throwing — the StreamFn contract applies to tools too.
 */

export const READ_TOOL_NAME = 'read'
export const read = useMCPServer((server) => {
  server.registerTool(
    READ_TOOL_NAME,
    {
      description:
        'Read the contents of a file. Output is truncated to 2000 lines or 50KB (whichever is hit first). Use offset/limit for large files.',
      inputSchema: fromJsonSchema(inputSchema),
      outputSchema: fromJsonSchema(outputSchema),
    },
    // biome-ignore lint/suspicious/noExplicitAny: schema is data, type safety via JSON Schema validation
    async ({ path: filePath, offset, limit, cwd }: any) => {
      const resolved = path.resolve(cwd, filePath)

      const bunFile = Bun.file(resolved)
      const exists = await bunFile.exists()
      if (!exists) {
        const output = { content: `[Error: file not found: ${resolved}]`, truncated: false, isError: true }
        return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output }
      }

      let text: string
      try {
        text = await bunFile.text()
      } catch {
        const output = { content: `[Error: could not read file: ${resolved}]`, truncated: false, isError: true }
        return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output }
      }

      const allLines = text.split('\n')
      const totalLines = allLines.length

      // Apply offset (1-indexed)
      const startLine = offset ? Math.max(0, offset - 1) : 0
      if (startLine >= totalLines) {
        const output = {
          content: `[Error: offset ${offset} is beyond end of file (${totalLines} lines total)]`,
          truncated: false,
          isError: true,
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output }
      }

      const endLine = limit ? Math.min(startLine + limit, totalLines) : totalLines
      const windowed = allLines.slice(startLine, endLine).join('\n')

      // Check truncation ceiling
      const bytes = new TextEncoder().encode(windowed).byteLength
      const windowLines = endLine - startLine

      if (bytes > MAX_BYTES) {
        const output = { content: windowed.slice(0, MAX_BYTES), truncated: true }
        return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output }
      }
      if (windowLines > MAX_LINES) {
        const output = { content: allLines.slice(startLine, startLine + MAX_LINES).join('\n'), truncated: true }
        return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output }
      }

      const output = { content: windowed, truncated: false }
      return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output }
    },
  )
})
