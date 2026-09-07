import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { useTool } from './use-tool.ts'

type Input = {
  cwd: string
  pattern: string
  dir?: string
}

export const FindInputSchema: JSONSchemaType<Input> = {
  type: 'object',
  properties: {
    cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
    pattern: { type: 'string', minLength: 1, description: 'pattern to match files against' },
    dir: { type: 'string', nullable: true, description: "root directory to search from (defaults to the tool's cwd)" },
  },
  required: ['pattern', 'cwd'],
  additionalProperties: false,
}

type Output = {
  paths: string[]
  message?: string
  isError?: boolean
}

export const FindOutputSchema: JSONSchemaType<Output> = {
  type: 'object',
  properties: {
    paths: { type: 'array', items: { type: 'string' } },
    message: { type: 'string', nullable: true, description: 'error detail when isError — states what failed' },
    isError: { type: 'boolean', nullable: true, description: 'true when the operation failed' },
  },
  required: ['paths'],
  additionalProperties: false,
}

/**
 * Find files matching a pattern via `Bun.Glob`.
 *
 * Returns relative paths (sorted) matching pi's find semantics. `cwd` is a
 * required input field — provided by the provisioner. Returns an info message
 * when no files match, and an error result on failure.
 */

export const FIND_TOOL_NAME = 'find'
export const find = useTool(
  {
    name: FIND_TOOL_NAME,
    description: 'Find files matching a pattern. Returns relative paths, sorted.',
    inputSchema: FindInputSchema,
    outputSchema: FindOutputSchema,
  },
  async ({ pattern, dir, cwd }, validate) => {
    try {
      const results: string[] = []
      const glob = new Bun.Glob(pattern)
      const scanCwd = path.resolve(cwd, dir ?? '.')

      for await (const file of glob.scan({ cwd: scanCwd })) {
        results.push(file)
      }

      results.sort()
      const output: Output = { paths: results }
      if (results.length === 0) {
        output.message = `[Info: no files matched pattern "${pattern}" in ${scanCwd}]`
      }
      return output
    } catch (err) {
      return {
        paths: [],
        message: `[Error: failed to search: ${(err as Error).message}]`,
        isError: true,
      }
    }
  },
)
