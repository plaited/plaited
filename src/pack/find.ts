import * as path from 'node:path'
import * as z from 'zod'
import type { CwdProvision, ToolArgs } from './pack.types.ts'

export const inputSchema = z.object({
  glob: z.string().min(1, 'glob pattern must be non-empty'),
  path: z.string().optional().describe("root directory to search from (defaults to the tool's provisioned cwd)"),
})

export const outputSchema = z.object({
  paths: z.array(z.string()),
})

export type FindInput = z.output<typeof inputSchema>
export type FindOutput = z.output<typeof outputSchema>

/**
 * Find files matching a glob pattern via `Bun.Glob`.
 *
 * Returns relative paths (sorted) matching pi's find semantics.
 */
export const run = async (input: FindInput & CwdProvision): Promise<FindOutput> => {
  const { glob: globPattern, path: cwd, cwd: provisionedCwd } = input

  const results: string[] = []
  const glob = new Bun.Glob(globPattern)

  for await (const file of glob.scan({ cwd: path.resolve(provisionedCwd ?? process.cwd(), cwd ?? '.') })) {
    results.push(file)
  }

  // Sort for deterministic output
  results.sort()

  return { paths: results }
}

const findTool: ToolArgs<typeof inputSchema, typeof outputSchema, CwdProvision> = Object.freeze({
  name: 'find',
  description: 'Find files matching a glob pattern. Returns relative paths, sorted.',
  inputSchema,
  outputSchema,
  run,
})

export default findTool
