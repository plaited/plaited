import * as path from 'node:path'
import type { CwdProvision, JsonObject, ToolArgs } from './pack.types.ts'

export const inputSchema = {
  type: 'object',
  properties: {
    glob: { type: 'string', minLength: 1, description: 'glob pattern to match files against' },
    path: { type: 'string', description: "root directory to search from (defaults to the tool's provisioned cwd)" },
  },
  required: ['glob'],
  additionalProperties: false,
}

export const outputSchema = {
  type: 'object',
  properties: {
    paths: { type: 'array', items: { type: 'string' } },
  },
  required: ['paths'],
  additionalProperties: false,
}

type FindInput = { glob: string; path?: string }

/**
 * Find files matching a glob pattern via `Bun.Glob`.
 *
 * Returns relative paths (sorted) matching pi's find semantics.
 */
export const run = async (input: JsonObject & CwdProvision): Promise<{ output: { paths: string[] } }> => {
  const { glob: globPattern, path: searchRoot, cwd: provisionedCwd } = input as FindInput & CwdProvision

  const results: string[] = []
  const glob = new Bun.Glob(globPattern)

  for await (const file of glob.scan({ cwd: path.resolve(provisionedCwd ?? process.cwd(), searchRoot ?? '.') })) {
    results.push(file)
  }

  // Sort for deterministic output
  results.sort()

  return { output: { paths: results } }
}

const findTool: ToolArgs = Object.freeze({
  name: 'find',
  description: 'Find files matching a glob pattern. Returns relative paths, sorted.',
  inputSchema,
  outputSchema,
  run,
})

export default findTool
