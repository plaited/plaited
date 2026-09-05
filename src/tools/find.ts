import * as path from 'node:path'
import { fromJsonSchema } from './schema-adapter.ts'
import { useMCPServer } from './use-mcp-server.ts'

export const inputSchema = {
  type: 'object',
  properties: {
    cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
    pattern: { type: 'string', minLength: 1, description: 'glob pattern to match files against' },
    dir: { type: 'string', description: "root directory to search from (defaults to the tool's cwd)" },
  },
  required: ['glob', 'cwd'],
  additionalProperties: false,
}

export const outputSchema = {
  type: 'object',
  properties: {
    paths: { type: 'array', items: { type: 'string' } },
  },
  required: ['paths'],
  additionalProperties: false,
}

/**
 * Find files matching a glob pattern via `Bun.Glob`.
 *
 * Returns relative paths (sorted) matching pi's find semantics.
 * Registered via `useMCPServer` as the `find` MCP tool. `cwd` is a required
 * input field — provided by the provisioner. Returns an info message when no
 * files match, and an error result on failure.
 */

export const FIND_TOOL_NAME = 'find'

export const find = useMCPServer((server) => {
  server.registerTool(
    FIND_TOOL_NAME,
    {
      description: 'Find files matching a glob pattern. Returns relative paths, sorted.',
      inputSchema: fromJsonSchema({
        type: 'object',
        properties: {
          pattern: { type: 'string', minLength: 1, description: 'glob pattern to match files against' },
          cwd: { type: 'string', description: "the tool's provisioned cwd" },
          dir: { type: 'string', description: "root directory to search from (defaults to the tool's cwd)" },
        },
        required: ['pattern', 'cwd'],
        additionalProperties: false,
      }),
      outputSchema: fromJsonSchema({
        type: 'object',
        properties: {
          paths: { type: 'array', items: { type: 'string' } },
          message: { type: 'string', description: 'error detail when isError — states what failed' },
          isError: { type: 'boolean', description: 'true when the operation failed' },
        },
        required: ['paths'],
        additionalProperties: false,
      }),
    },
    // biome-ignore lint/suspicious/noExplicitAny: schema is data, type safety via JSON Schema validation
    async ({ pattern, dir, cwd }: any) => {
      try {
        const results: string[] = []
        const glob = new Bun.Glob(pattern)
        const scanCwd = path.resolve(cwd, dir ?? '.')

        for await (const file of glob.scan({ cwd: scanCwd })) {
          results.push(file)
        }

        results.sort()
        const output: Record<string, unknown> = { paths: results }
        if (results.length === 0) {
          output.message = `[Info: no files matched pattern "${pattern}" in ${scanCwd}]`
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (err) {
        const output = {
          paths: [],
          message: `[Error: failed to search: ${(err as Error).message}]`,
          isError: true,
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }
    },
  )
})
