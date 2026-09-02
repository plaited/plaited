import { readdir } from 'node:fs/promises'
import * as path from 'node:path'
import type { CwdProvision, JsonObject, ToolArgs } from './pack.types.ts'

export const inputSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: "directory path — absolute, or relative to the tool's provisioned cwd" },
  },
  required: ['path'],
  additionalProperties: false,
}

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
}

type LsInput = { path: string }
type LsOutput = { entries: Array<{ name: string; type: 'file' | 'directory' | 'symlink' | 'unknown' }> }

/**
 * List directory entries with their types via `readdir`.
 *
 * MINIMAL: no symlink resolution, no sorting beyond filesystem order.
 * Upgrade path: add `sort` option, symlink target info.
 */
export const run = async (input: JsonObject & CwdProvision): Promise<{ output: LsOutput }> => {
  const { path: dirPath, cwd } = input as LsInput & CwdProvision
  const resolved = path.resolve(cwd ?? process.cwd(), dirPath)

  let entries: { name: string; type: LsOutput['entries'][number]['type'] }[]
  try {
    const dirEntries = await readdir(resolved, { withFileTypes: true })
    entries = dirEntries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : e.isSymbolicLink() ? 'symlink' : 'file',
    }))
  } catch (_err) {
    return { output: { entries: [] } }
  }

  return { output: { entries } }
}

const lsTool: ToolArgs = Object.freeze({
  name: 'ls',
  description: 'List entries in a directory with their types.',
  inputSchema,
  outputSchema,
  run,
})

export default lsTool
