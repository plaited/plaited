import { readdir } from 'node:fs/promises'
import * as path from 'node:path'
import { fromJsonSchema } from './schema-adapter.ts'
import { useMCPServer } from './use-mcp-server.ts'

export const inputSchema = {
  type: 'object',
  properties: {
    cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
    dir: { type: 'string', description: "directory path — absolute, or relative to the tool's provisioned cwd" },
  },
  required: ['dir', 'cwd'],
  additionalProperties: false,
} as const

export const outputSchema = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['file', 'directory', 'symlink', 'unknown'] },
        },
        required: ['name', 'type'],
      },
    },
  },
  required: ['entries'],
  additionalProperties: false,
} as const

type LsOutput = { entries: Array<{ name: string; type: 'file' | 'directory' | 'symlink' | 'unknown' }> }

/**
 * List directory entries with their types via `readdir`.
 *
 * Registered via `useMCPServer` as the `ls` MCP tool. `cwd` is a required
 * input field — provided by the provisioner. Returns an error result when
 * the directory cannot be read.
 *
 * MINIMAL: no symlink resolution, no sorting beyond filesystem order.
 * Upgrade path: add `sort` option, symlink target info.
 */

export const LS_TOOL_NAME = 'ls'
export const ls = useMCPServer((server) => {
  server.registerTool(
    LS_TOOL_NAME,
    {
      description: 'List entries in a directory with their types.',
      inputSchema: fromJsonSchema(inputSchema),
      outputSchema: fromJsonSchema(outputSchema),
    },
    // biome-ignore lint/suspicious/noExplicitAny: schema is data, type safety via JSON Schema validation
    async ({ dir, cwd }: any) => {
      const resolved = path.resolve(cwd, dir)

      let entries: { name: string; type: LsOutput['entries'][number]['type'] }[]
      try {
        const dirEntries = await readdir(resolved, { withFileTypes: true })
        entries = dirEntries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : e.isSymbolicLink() ? 'symlink' : 'file',
        }))
      } catch (err) {
        const output = {
          entries: [],
          message: `[Error: failed to list directory: ${(err as Error).message}]`,
          isError: true,
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }

      const output = { entries }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(output) }],
        structuredContent: output,
      }
    },
  )
})
