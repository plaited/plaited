import * as path from 'node:path'
import * as z from 'zod'
import type { ToolArgs } from './pack.types.ts'

export const inputSchema = z.object({
  path: z
    .string()
    .min(1)
    .refine((p) => path.isAbsolute(p), { message: 'path must be absolute' }),
  content: z.string(),
})

export const outputSchema = z.object({
  bytesWritten: z.number().int().nonnegative(),
})

export type WriteInput = z.output<typeof inputSchema>
export type WriteOutput = z.output<typeof outputSchema>

/**
 * Write content to a file via `Bun.write`. Creates parent directories
 * automatically.
 */
export const run = async (input: WriteInput): Promise<WriteOutput> => {
  const { path: filePath, content } = input

  // Ensure parent directory exists
  const parentDir = path.dirname(filePath)
  await Bun.$`mkdir -p ${parentDir}`.quiet().nothrow()

  await Bun.write(filePath, content)

  return { bytesWritten: content.length }
}

const writeTool: ToolArgs<typeof inputSchema, typeof outputSchema> = Object.freeze({
  name: 'write',
  description:
    'Write content to a file. Creates the file if it does not exist, overwrites if it does. Automatically creates parent directories.',
  inputSchema,
  outputSchema,
  run,
})

export default writeTool
