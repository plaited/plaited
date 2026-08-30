import * as path from 'node:path'
import * as z from 'zod'
import type { CwdProvision, ToolArgs } from './pack.types.ts'

export const inputSchema = z.object({
  path: z.string().min(1).describe("file path — absolute, or relative to the tool's provisioned cwd"),
  content: z.string(),
})

export const outputSchema = z.object({
  bytesWritten: z.number().int().nonnegative(),
})

export type WriteInput = z.output<typeof inputSchema>
export type WriteOutput = z.output<typeof outputSchema>

/**
 * Write content to a file via `Bun.write`. Creates parent directories
 * automatically. Paths resolve against the provisioned cwd.
 */
export const run = async (input: WriteInput & CwdProvision): Promise<WriteOutput> => {
  const { path: filePath, content, cwd } = input
  const resolved = path.resolve(cwd ?? process.cwd(), filePath)

  // Ensure parent directory exists
  const parentDir = path.dirname(resolved)
  await Bun.$`mkdir -p ${parentDir}`.quiet().nothrow()

  await Bun.write(resolved, content)

  return { bytesWritten: content.length }
}

const writeTool: ToolArgs<typeof inputSchema, typeof outputSchema, CwdProvision> = Object.freeze({
  name: 'write',
  description:
    'Write content to a file. Creates the file if it does not exist, overwrites if it does. Automatically creates parent directories.',
  inputSchema,
  outputSchema,
  run,
})

export default writeTool
