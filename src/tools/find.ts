import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { DEFAULT_MAX_BYTES, formatSize, truncateHead } from './truncate.ts'
import { useTool } from './use-tool.ts'

const DEFAULT_LIMIT = 1000

type Input = {
  cwd: string
  pattern: string
  dir?: string
  limit?: number
}

export const FindInputSchema: JSONSchemaType<Input> = {
  type: 'object',
  properties: {
    cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
    pattern: {
      type: 'string',
      minLength: 1,
      description: 'glob pattern to match files, e.g. "*.ts", "**/*.json", or "src/**/*.spec.ts"',
    },
    dir: {
      type: 'string',
      nullable: true,
      description: "root directory to search from (defaults to the tool's cwd)",
    },
    limit: {
      type: 'integer',
      nullable: true,
      minimum: 1,
      description: `maximum number of results (default: ${DEFAULT_LIMIT})`,
    },
  },
  required: ['pattern', 'cwd'],
  additionalProperties: false,
}

type Output = {
  paths: string[]
  truncated: boolean
  limit: number
  notice?: string
  message?: string
  isError?: boolean
}

export const FindOutputSchema: JSONSchemaType<Output> = {
  type: 'object',
  properties: {
    paths: { type: 'array', items: { type: 'string' } },
    truncated: { type: 'boolean', description: 'true when any truncation occurred (result limit or byte cap)' },
    limit: { type: 'integer', description: 'the result limit that was applied' },
    notice: {
      type: 'string',
      nullable: true,
      description: 'continuation hints when truncation occurred — joined with ". "',
    },
    message: { type: 'string', nullable: true, description: 'error detail when isError — states what failed' },
    isError: { type: 'boolean', nullable: true, description: 'true when the operation failed' },
  },
  required: ['paths', 'truncated', 'limit'],
  additionalProperties: false,
}

const relativizePath = (filePath: string, searchPath: string): string => {
  const relative = path.relative(searchPath, filePath)
  if (relative && !relative.startsWith('..')) return relative.replace(/\\/g, '/')
  return path.basename(filePath)
}

/**
 * Find files matching a glob pattern.
 *
 * When `rg` is on PATH, uses `rg --files --glob <pattern>` (respects
 * .gitignore and includes dotfiles). Falls back to `Bun.Glob` when neither rg
 * nor fd is available.
 *
 * MINIMAL: Bun.Glob fallback does not respect .gitignore nor match dotfiles.
 * Upgrade path: install rg or fd, or add walk + gitignore filter.
 *
 * `cwd` is a required input field — provided by the provisioner. Returns an
 * info message when no files match, and an error result on failure.
 */
export const FIND_TOOL_NAME = 'find'
export const find = useTool(
  {
    name: FIND_TOOL_NAME,
    description:
      `Find files matching a glob pattern. Returns relative paths, sorted. ` +
      `When rg is available, respects .gitignore and includes dotfiles. ` +
      `Output is capped at ${DEFAULT_LIMIT} results or ${formatSize(DEFAULT_MAX_BYTES)}.`,
    inputSchema: FindInputSchema,
    outputSchema: FindOutputSchema,
  },
  async ({ pattern, dir, limit, cwd }, _validate) => {
    try {
      const scanCwd = path.resolve(cwd, dir ?? '.')
      const effectiveLimit = Math.max(1, limit ?? DEFAULT_LIMIT)

      const rgPath = Bun.which('rg')

      let results: string[]

      if (rgPath) {
        // rg --files respects .gitignore and includes dotfiles.
        const args = ['--files', '--glob', pattern, '--color', 'never']
        const proc = Bun.spawn([rgPath, ...args, scanCwd], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        const stdout = await new Response(proc.stdout).text()
        await new Response(proc.stderr).text()
        results = stdout
          .split('\n')
          .map((line) => line.replace(/\r$/, '').trim())
          .filter((line) => line.length > 0)
          .map((line) => relativizePath(line, scanCwd))
      } else {
        // MINIMAL: Bun.Glob fallback — does not respect .gitignore nor
        // match dotfiles. Upgrade path: install rg or fd.
        const glob = new Bun.Glob(pattern)
        results = []
        for await (const file of glob.scan({ cwd: scanCwd })) {
          results.push(file)
        }
      }

      results.sort()

      // Apply result limit
      const resultLimitReached = results.length >= effectiveLimit
      if (results.length > effectiveLimit) {
        results = results.slice(0, effectiveLimit)
      }

      if (results.length === 0) {
        return {
          paths: [],
          truncated: false,
          limit: effectiveLimit,
          message: `[Info: no files matched pattern "${pattern}" in ${scanCwd}]`,
        }
      }

      // Apply byte cap via truncateHead (no line limit — result limit caps rows)
      const rawOutput = results.join('\n')
      const truncation = truncateHead(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER })
      const byteTruncated = truncation.truncated

      let cappedPaths = results
      if (byteTruncated) {
        const outputLineCount = truncation.content.split('\n').length
        cappedPaths = results.slice(0, outputLineCount)
      }

      // Build notices
      const notices: string[] = []
      if (resultLimitReached) {
        notices.push(
          `${effectiveLimit} results limit reached. Use limit=${effectiveLimit * 2} for more, or refine pattern`,
        )
      }
      if (byteTruncated) {
        notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`)
      }

      const result: Output = {
        paths: cappedPaths,
        truncated: resultLimitReached || byteTruncated,
        limit: effectiveLimit,
      }
      if (notices.length > 0) {
        result.notice = notices.join('. ')
      }
      return result
    } catch (err) {
      return {
        paths: [],
        truncated: false,
        limit: limit ?? DEFAULT_LIMIT,
        message: `[Error: failed to search: ${(err as Error).message}]`,
        isError: true,
      }
    }
  },
)
