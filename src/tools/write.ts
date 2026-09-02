import * as path from 'node:path'
import type { CwdProvision, JsonObject, ToolArgs } from './pack.types.ts'

export const inputSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: "file path — absolute, or relative to the tool's provisioned cwd" },
    content: { type: 'string' },
  },
  required: ['path', 'content'],
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

type WriteInput = { path: string; content: string }
type WriteOutput = { bytesWritten: number }

/**
 * Write content to a file via `Bun.write`. Creates parent directories
 * automatically. Paths resolve against the provisioned cwd.
 */
export const run = async (input: JsonObject & CwdProvision): Promise<{ output: WriteOutput }> => {
  // Args are Ajv-validated at dispatch and guard-blocked at selection — the
  // cast is the documented trust boundary.
  const { path: filePath, content, cwd } = input as WriteInput & CwdProvision
  const resolved = path.resolve(cwd ?? process.cwd(), filePath)

  // Ensure parent directory exists
  const parentDir = path.dirname(resolved)
  await Bun.$`mkdir -p ${parentDir}`.quiet().nothrow()

  await Bun.write(resolved, content)

  return { output: { bytesWritten: content.length } }
}

const writeTool: ToolArgs = Object.freeze({
  name: 'write',
  description:
    'Write content to a file. Creates the file if it does not exist, overwrites if it does. Automatically creates parent directories.',
  inputSchema,
  outputSchema,
  run,
})

export default writeTool
