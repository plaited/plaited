#!/usr/bin/env bun
/**
 * Generate a JSON-LD vertex from a goal bThread factory.
 *
 * @remarks
 * Offline CLI tool — no agent pipeline. Reads a TypeScript factory file,
 * extracts brand/name/thread metadata via Bun.Transpiler and dynamic import,
 * then writes a JSON-LD vertex to the memory directory.
 *
 * @public
 */

import { basename, dirname, join, resolve } from 'node:path'
import * as z from 'zod'
import { parseCli } from './cli.utils.ts'

// ============================================================================
// Schemas
// ============================================================================

const IngestGoalInputSchema = z.object({
  path: z.string().describe('Path to the goal factory .ts file'),
  memoryDir: z.string().optional().describe('Memory directory (default: .memory/ relative to factory)'),
})

const IngestGoalOutputSchema = z.object({
  vertexPath: z.string().describe('Absolute path to the written .jsonld file'),
  vertex: z.record(z.string(), z.unknown()).describe('The JSON-LD vertex that was written'),
})

export { IngestGoalInputSchema, IngestGoalOutputSchema }

// ============================================================================
// Factory Metadata Extraction
// ============================================================================

/**
 * Extracted metadata from a goal factory file.
 *
 * @internal
 */
type FactoryMeta = {
  brand: string
  name: string
  threadNames: string[]
}

/**
 * Extract brand and thread names from factory source via regex.
 *
 * @remarks
 * Uses static analysis rather than dynamic import for safety.
 * Falls back gracefully if patterns don't match.
 *
 * @internal
 */
const extractFactoryMeta = (source: string, filePath: string): FactoryMeta => {
  const name = basename(filePath, '.ts')

  // Extract brand
  const brandMatch = source.match(/\$\s*:\s*['"`]([^'"`]+)['"`]/)
  const brand = brandMatch?.[1] ?? 'unknown'

  // Extract thread names from bThreads.set({ name: bThread(...) }) or similar patterns
  const threadNames: string[] = []
  const threadSetRegex = /(\w+)\s*:\s*bThread\s*\(/g
  for (const match of source.matchAll(threadSetRegex)) {
    threadNames.push(match[1]!)
  }

  return { brand, name, threadNames }
}

// ============================================================================
// Vertex Builder
// ============================================================================

/**
 * Build a JSON-LD Goal vertex from factory metadata.
 *
 * @internal
 */
const buildGoalVertex = (meta: FactoryMeta, sourcePath: string): Record<string, unknown> => ({
  '@context': {
    bp: 'urn:bp:',
    schema: 'https://schema.org/',
  },
  '@id': `bp:thread/goal_${meta.name}`,
  '@type': 'Goal',
  'schema:name': meta.name,
  brand: meta.brand,
  source: sourcePath,
  threads: meta.threadNames.map((t) => `bp:thread/${t}`),
  timestamp: new Date().toISOString(),
})

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Ingest a goal factory and write a JSON-LD vertex.
 *
 * @param path - Absolute path to the goal factory `.ts` file
 * @param memoryDir - Absolute path to the memory directory
 * @returns The vertex path and vertex content
 *
 * @public
 */
export const ingestGoal = async (
  path: string,
  memoryDir: string,
): Promise<{ vertexPath: string; vertex: Record<string, unknown> }> => {
  if (!(await Bun.file(path).exists())) {
    throw new Error(`Factory file does not exist: ${path}`)
  }

  const source = await Bun.file(path).text()

  // Validate it parses as TypeScript
  try {
    const transpiler = new Bun.Transpiler({ loader: 'ts' })
    transpiler.transformSync(source)
  } catch (e) {
    throw new Error(`Failed to parse factory: ${e instanceof Error ? e.message : String(e)}`)
  }

  const meta = extractFactoryMeta(source, path)
  const vertex = buildGoalVertex(meta, path)

  // Write to threads/ subdirectory
  const threadsDir = join(memoryDir, 'threads')
  const vertexPath = join(threadsDir, `goal_${meta.name}.jsonld`)
  await Bun.write(vertexPath, `${JSON.stringify(vertex, null, 2)}\n`)

  return { vertexPath, vertex }
}

// ============================================================================
// CLI Handler
// ============================================================================

/**
 * CLI entry point for ingest-goal.
 *
 * @remarks
 * Exit 0 = success, 1 = domain error, 2 = bad input.
 *
 * @param args - CLI arguments (after command name)
 *
 * @public
 */
export const ingestGoalCli = async (args: string[]) => {
  if (args.includes('--help') || args.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(`plaited ingest-goal
Generate a JSON-LD vertex from a goal bThread factory

Usage: plaited ingest-goal '<json>' [options]
       echo '<json>' | plaited ingest-goal

Input (JSON):
  path        string   Path to the goal factory .ts file (required)
  memoryDir   string   Memory directory (default: .memory/ relative to factory)

Options:
  --schema <input|output>  Print JSON Schema and exit
  -h, --help               Show this help

Exit codes:
  0  Vertex written successfully
  1  Domain error (parse failure, missing file)
  2  Bad input or tool error`)
    return
  }

  const input = await parseCli(args, IngestGoalInputSchema, {
    name: 'ingest-goal',
    outputSchema: IngestGoalOutputSchema,
  })

  const cwd = process.cwd()
  const factoryPath = input.path.startsWith('/') ? input.path : resolve(cwd, input.path)
  const memoryDir = input.memoryDir
    ? input.memoryDir.startsWith('/')
      ? input.memoryDir
      : resolve(cwd, input.memoryDir)
    : join(dirname(factoryPath), '..', '.memory')

  try {
    const result = await ingestGoal(factoryPath, memoryDir)
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    process.exit(1)
  }
}

if (import.meta.main) {
  await ingestGoalCli(Bun.argv.slice(2))
}
