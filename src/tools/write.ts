import * as path from 'node:path'
import * as z from 'zod'
import { useMCPServer } from './use-mcp-server.ts'

export const inputSchema = {
  type: 'object',
  properties: {
    cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
    path: { type: 'string', description: "file path — absolute, or relative to the tool's provisioned cwd" },
    content: { type: 'string' },
  },
  required: ['path', 'content', 'cwd'],
  additionalProperties: false,
}

export const outputSchema = {
  type: 'object',
  properties: {
    bytesWritten: { type: 'integer', description: 'number of bytes written to disk' },
  },
  required: ['bytesWritten'],
  additionalProperties: false,
}

/**
 * Write content to a file via `Bun.write`. Creates parent directories
 * automatically. Registered via `useMCPServer` as the `write` MCP tool.
 * `cwd` is a required input field — provided by the provisioner. Paths
 * resolve against the provisioned cwd.
 */

export const WRITE_TOOL_NAME = 'write'
export const write = useMCPServer((server) => {
  server.registerTool(
    WRITE_TOOL_NAME,
    {
      description:
        'Write content to a file. Creates the file if it does not exist, overwrites if it does. Automatically creates parent directories.',
      inputSchema: z.object({
        cwd: z.string().describe("the tool's provisioned cwd"),
        path: z.string().describe("file path — absolute, or relative to the tool's provisioned cwd"),
        content: z.string(),
      }),
      outputSchema: z.object({
        bytesWritten: z.number().int().describe('number of bytes written to disk'),
      }),
    },
    async ({ path: filePath, content, cwd }) => {
      const resolved = path.resolve(cwd, filePath)

      // Ensure parent directory exists
      const parentDir = path.dirname(resolved)
      await Bun.$`mkdir -p ${parentDir}`.quiet().nothrow()

      await Bun.write(resolved, content)

      const output = { bytesWritten: content.length }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(output) }],
        structuredContent: output,
      }
    },
  )
})
