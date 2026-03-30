/**
 * Ingest a skill directory into a JSON-LD vertex for hypergraph memory.
 *
 * @remarks
 * Reads SKILL.md frontmatter, scans for TypeScript exports and bThread
 * references, then writes a JSON-LD Skill vertex to the memory directory.
 *
 * @public
 */

import { basename, join, resolve } from 'node:path'
import * as z from 'zod'
import { parseCli } from '../cli/cli.utils.ts'
import { findSkillMd, parseFrontmatter } from './skill.utils.ts'

// ============================================================================
// Schemas
// ============================================================================

const IngestSkillInputSchema = z.object({
  path: z.string().describe('Path to the skill directory containing SKILL.md'),
  memoryDir: z.string().optional().describe('Memory directory for output (default: .memory/ relative to skill)'),
})

const IngestSkillOutputSchema = z.object({
  vertexPath: z.string().describe('Absolute path to the written .jsonld file'),
  vertex: z.record(z.string(), z.unknown()).describe('The JSON-LD vertex that was written'),
})

export { IngestSkillInputSchema, IngestSkillOutputSchema }

// ============================================================================
// Skill Metadata Extraction
// ============================================================================

/**
 * Scan TypeScript reference files for bThread and event references.
 *
 * @internal
 */
const scanReferences = async (
  skillDir: string,
): Promise<{ threads: string[]; events: string[]; requires: string[] }> => {
  const threads: string[] = []
  const events: string[] = []
  const requires: string[] = []
  const transpiler = new Bun.Transpiler({ loader: 'tsx' })

  const glob = new Bun.Glob('**/*.ts')
  for await (const path of glob.scan({ cwd: skillDir, onlyFiles: true })) {
    if (path.endsWith('.spec.ts') || path.endsWith('.test.ts')) continue
    const content = await Bun.file(join(skillDir, path)).text()

    // Extract bThread references (string literals — scan() doesn't parse these)
    for (const match of content.matchAll(/bp:thread\/(\w+)/g)) {
      threads.push(match[1]!)
    }

    // Extract event references (string literals — scan() doesn't parse these)
    for (const match of content.matchAll(/bp:event\/(\w+)/g)) {
      events.push(match[1]!)
    }

    // Extract cross-skill dependencies from imports via Bun.Transpiler.scan()
    const { imports } = transpiler.scan(content)
    const skillName = basename(skillDir)
    for (const imp of imports) {
      if (!imp.path.startsWith('../')) continue
      const segments = imp.path.replace(/^\.\.\//, '').split('/')
      const dep = segments[0]
      if (dep && dep !== skillName) {
        requires.push(dep)
      }
    }
  }

  return {
    threads: [...new Set(threads)].sort(),
    events: [...new Set(events)].sort(),
    requires: [...new Set(requires)].sort(),
  }
}

// ============================================================================
// Vertex Builder
// ============================================================================

/**
 * Build a JSON-LD Skill vertex from frontmatter and scanned references.
 *
 * @internal
 */
const buildSkillVertex = (
  name: string,
  description: string,
  source: string,
  refs: { threads: string[]; events: string[]; requires: string[] },
): Record<string, unknown> => {
  const vertex: Record<string, unknown> = {
    '@context': {
      bp: 'urn:bp:',
      schema: 'https://schema.org/',
    },
    '@id': `skill://${name}`,
    '@type': 'Skill',
    'schema:name': name,
    'schema:description': description,
    source,
    timestamp: new Date().toISOString(),
  }

  if (refs.threads.length > 0) {
    vertex.provides = refs.threads.map((t) => ({
      '@id': `bp:thread/${t}`,
      '@type': 'Thread',
      references: refs.events.map((e) => `bp:event/${e}`),
    }))
  }

  if (refs.requires.length > 0) {
    vertex.requires = refs.requires.map((r) => ({
      '@id': `skill://${r}`,
      '@type': 'Skill',
    }))
  }

  return vertex
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Ingest a skill directory and write a JSON-LD vertex.
 *
 * @param skillDir - Absolute path to the skill directory
 * @param memoryDir - Absolute path to the memory directory
 * @returns The vertex path and vertex content
 *
 * @public
 */
export const ingestSkill = async (
  skillDir: string,
  memoryDir: string,
): Promise<{ vertexPath: string; vertex: Record<string, unknown> }> => {
  const skillMdPath = await findSkillMd(skillDir)
  if (!skillMdPath) {
    throw new Error(`No SKILL.md found in: ${skillDir}`)
  }

  const content = await Bun.file(skillMdPath).text()
  const { metadata } = parseFrontmatter(content)

  const name = metadata.name as string
  const description = metadata.description as string
  if (!name || !description) {
    throw new Error('SKILL.md must have name and description in frontmatter')
  }

  const refs = await scanReferences(skillDir)
  const vertex = buildSkillVertex(name, description, skillMdPath, refs)

  // Write to skills/ subdirectory
  const skillsDir = join(memoryDir, 'skills')
  const vertexPath = join(skillsDir, `${name}.jsonld`)
  await Bun.write(vertexPath, `${JSON.stringify(vertex, null, 2)}\n`)

  return { vertexPath, vertex }
}

// ============================================================================
// CLI Handler
// ============================================================================

/**
 * CLI entry point for ingest-skill.
 *
 * @remarks
 * Exit 0 = success, 1 = domain error, 2 = bad input.
 *
 * @param args - CLI arguments (after command name)
 *
 * @public
 */
export const ingestSkillCli = async (args: string[]) => {
  if (args.includes('--help') || args.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(`plaited ingest-skill
Ingest a skill directory into a JSON-LD vertex

Usage: plaited ingest-skill '<json>' [options]
       echo '<json>' | plaited ingest-skill

Input (JSON):
  path        string   Path to the skill directory (required)
  memoryDir   string   Memory directory (default: .memory/)

Options:
  --schema <input|output>  Print JSON Schema and exit
  -h, --help               Show this help

Exit codes:
  0  Vertex written successfully
  1  Domain error (missing SKILL.md, parse failure)
  2  Bad input or tool error`)
    return
  }

  const input = await parseCli(args, IngestSkillInputSchema, {
    name: 'ingest-skill',
    outputSchema: IngestSkillOutputSchema,
  })

  const cwd = process.cwd()
  const skillDir = input.path.startsWith('/') ? input.path : resolve(cwd, input.path)
  const memoryDir = input.memoryDir
    ? input.memoryDir.startsWith('/')
      ? input.memoryDir
      : resolve(cwd, input.memoryDir)
    : join(skillDir, '..', '.memory')

  try {
    const result = await ingestSkill(skillDir, memoryDir)
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    process.exit(1)
  }
}
