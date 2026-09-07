import { readdir } from 'node:fs/promises'
import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { DEFAULT_MAX_BYTES, formatSize, truncateHead } from './truncate.ts'
import { useTool } from './use-tool.ts'

const DEFAULT_LIMIT = 500

type EntryType = 'file' | 'directory' | 'symlink' | 'unknown'

type Input = {
  cwd: string
  dir: string
  limit?: number
}

export const LsInputSchema: JSONSchemaType<Input> = {
  type: 'object',
  properties: {
    cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
    dir: { type: 'string', description: "directory path — absolute, or relative to the tool's provisioned cwd" },
    limit: {
      type: 'integer',
      nullable: true,
      minimum: 1,
      description: `maximum number of entries to return (default: ${DEFAULT_LIMIT})`,
    },
  },
  required: ['dir', 'cwd'],
  additionalProperties: false,
}

type Output = {
  entries: Array<{ name: string; type: EntryType }>
  truncated: boolean
  limit: number
  notice?: string
  message?: string
  isError?: boolean
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
        additionalProperties: false,
      },
    },
    truncated: { type: 'boolean', description: 'true when any truncation occurred (entry limit or byte cap)' },
    limit: { type: 'integer', description: 'the entry limit that was applied' },
    notice: {
      type: 'string',
      nullable: true,
      description: 'continuation hints when truncation occurred — joined with ". "',
    },
    message: { type: 'string', nullable: true, description: 'error detail when isError — states what failed' },
    isError: { type: 'boolean', nullable: true, description: 'true when the operation failed' },
  },
  required: ['entries', 'truncated', 'limit'],
  additionalProperties: false,
}

/**
 * List directory entries with their types.
 *
 * Entries are sorted case-insensitively (stable output across calls). Output
 * is capped at `limit` entries (default 500) or 50KB (whichever is hit first).
 *
 * `cwd` is a required input field — provided by the provisioner. Returns an
 * error result when the directory cannot be read.
 */
export const ls = useTool(
  {
    name: 'ls',
    description:
      `List entries in a directory with their types. Entries are sorted ` +
      `case-insensitively. Output is capped at ${DEFAULT_LIMIT} entries or ` +
      `${formatSize(DEFAULT_MAX_BYTES)}.`,
    inputSchema: LsInputSchema,
    outputSchema: LsOutputSchema,
  },
  async ({ dir, limit, cwd }, _validate) => {
    const resolved = path.resolve(cwd, dir)
    const effectiveLimit = Math.max(1, limit ?? DEFAULT_LIMIT)

    let rawEntries: Array<{ name: string; type: EntryType }>
    try {
      const dirEntries = await readdir(resolved, { withFileTypes: true })
      rawEntries = dirEntries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : e.isSymbolicLink() ? 'symlink' : 'file',
      }))
    } catch (err) {
      return {
        entries: [],
        truncated: false,
        limit: effectiveLimit,
        message: `[Error: failed to list directory: ${(err as Error).message}]`,
        isError: true,
      }
    }

    // Sort case-insensitively — stable output across calls.
    rawEntries.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))

    // Apply entry limit
    const entryLimitReached = rawEntries.length >= effectiveLimit
    const entries = rawEntries.slice(0, effectiveLimit)

    if (entries.length === 0) {
      return {
        entries: [],
        truncated: false,
        limit: effectiveLimit,
      }
    }

    // Serialize to name\ttype lines for byte cap
    const rawOutput = entries.map((e) => `${e.name}\t${e.type}`).join('\n')
    const truncation = truncateHead(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER })
    const byteTruncated = truncation.truncated

    let cappedEntries = entries
    if (byteTruncated) {
      const outputLineCount = truncation.content.split('\n').length
      cappedEntries = entries.slice(0, outputLineCount)
    }

    // Build notices
    const notices: string[] = []
    if (entryLimitReached) {
      notices.push(`${effectiveLimit} entries limit reached. Use limit=${effectiveLimit * 2} for more`)
    }
    if (byteTruncated) {
      notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`)
    }

    const result: Output = {
      entries: cappedEntries,
      truncated: entryLimitReached || byteTruncated,
      limit: effectiveLimit,
    }
    if (notices.length > 0) {
      result.notice = notices.join('. ')
    }
    return result
  },
)
