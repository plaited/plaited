import { readdir } from 'node:fs/promises'
import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { useTool } from './use-tool.ts'

type Input = {
  cwd: string
  dir: string
}

export const LsInputSchema: JSONSchemaType<Input> = {
  type: 'object',
  properties: {
    cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
    dir: { type: 'string', description: "directory path — absolute, or relative to the tool's provisioned cwd" },
  },
  required: ['dir', 'cwd'],
  additionalProperties: false,
}

type Output =
  | {
      entries: Array<{ name: string; type: 'file' | 'directory' | 'symlink' | 'unknown' }>
    }
  | {
      entries: never[]
      message: string
      isError: boolean
    }

export const LsOutputSchema: JSONSchemaType<Output> = {
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

export const ls = useTool(
  {
    name: 'ls',
    description: 'List entries in a directory with their types.',
    inputSchema: LsInputSchema,
    outputSchema: LsOutputSchema,
  },
  async ({ dir, cwd }, validate) => {
    const resolved = path.resolve(cwd, dir)
    let entries: Output['entries']
    try {
      const dirEntries = await readdir(resolved, { withFileTypes: true })
      entries = dirEntries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : e.isSymbolicLink() ? 'symlink' : 'file',
      }))
    } catch (err) {
      return {
        entries: [],
        message: `[Error: failed to list directory: ${(err as Error).message}]`,
        isError: true,
      }
    }

    return { entries }
  },
)
