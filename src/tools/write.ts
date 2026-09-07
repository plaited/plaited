import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { useTool } from './use-tool.ts'

type Input = {
  cwd: string
  path: string
  content: string
}

export const WriteInputSchema: JSONSchemaType<Input> = {
  type: 'object',
  properties: {
    cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
    path: { type: 'string', description: "file path — absolute, or relative to the tool's provisioned cwd" },
    content: { type: 'string' },
  },
  required: ['path', 'content', 'cwd'],
  additionalProperties: false,
}

type Output = {
  bytesWritten: number
}

export const WriteOutputSchema: JSONSchemaType<Output> = {
  type: 'object',
  properties: {
    bytesWritten: { type: 'integer', description: 'number of bytes written to disk' },
  },
  required: ['bytesWritten'],
  additionalProperties: false,
}

/**
 * Write content to a file via `Bun.write`. Creates parent directories
 * automatically. `cwd` is a required input field — provided by the
 * provisioner. Paths resolve against the provisioned cwd.
 */

export const WRITE_TOOL_NAME = 'write'
export const write = useTool(
  {
    name: WRITE_TOOL_NAME,
    description:
      'Write content to a file. Creates the file if it does not exist, overwrites if it does. Automatically creates parent directories.',
    inputSchema: WriteInputSchema,
    outputSchema: WriteOutputSchema,
  },
  async ({ path: filePath, content, cwd }, _validate) => {
    const resolved = path.resolve(cwd, filePath)

    // Ensure parent directory exists
    const parentDir = path.dirname(resolved)
    await Bun.$`mkdir -p ${parentDir}`.quiet().nothrow()

    await Bun.write(resolved, content)

    return { bytesWritten: Buffer.byteLength(content, 'utf-8') }
  },
)
