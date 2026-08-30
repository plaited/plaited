import { readdir } from 'node:fs/promises'
import * as path from 'node:path'
import * as z from 'zod'
import type { CwdProvision, ToolArgs } from './pack.types.ts'

export const inputSchema = z.object({
  path: z.string().min(1).describe("directory path — absolute, or relative to the tool's provisioned cwd"),
})

export const outputSchema = z.object({
  entries: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['file', 'directory', 'symlink', 'unknown']),
    }),
  ),
})

export type LsInput = z.output<typeof inputSchema>
export type LsOutput = z.output<typeof outputSchema>

/**
 * List directory entries with their types via `readdir`.
 *
 * MINIMAL: no symlink resolution, no sorting beyond filesystem order.
 * Upgrade path: add `sort` option, symlink target info.
 */
export const run = async (input: LsInput & CwdProvision): Promise<LsOutput> => {
  const { path: dirPath, cwd } = input
  const resolved = path.resolve(cwd ?? process.cwd(), dirPath)

  let entries: { name: string; type: LsOutput['entries'][number]['type'] }[]
  try {
    const dirEntries = await readdir(resolved, { withFileTypes: true })
    entries = dirEntries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : e.isSymbolicLink() ? 'symlink' : 'file',
    }))
  } catch (_err) {
    return {
      entries: [],
    }
  }

  return { entries }
}

const lsTool: ToolArgs<typeof inputSchema, typeof outputSchema, CwdProvision> = Object.freeze({
  name: 'ls',
  description: 'List entries in a directory with their types.',
  inputSchema,
  outputSchema,
  run,
})

export default lsTool
