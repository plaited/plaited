#!/usr/bin/env bun
/**
 * Ingest AGENTS.md rules into JSON-LD RuleSet vertices for hypergraph memory.
 *
 * @remarks
 * Offline CLI tool — no agent pipeline. Parses markdown sections from
 * AGENTS.md, derives scope from the file path, and emits RuleSet vertices.
 * Each top-level `#` section becomes a separate RuleSet with its subsections
 * as individual rules.
 *
 * @public
 */

import { basename, dirname, join, resolve } from 'node:path'
import * as z from 'zod'
import { parseCli } from './cli.utils.ts'

// ============================================================================
// Schemas
// ============================================================================

const IngestRulesInputSchema = z.object({
  path: z.string().describe('Path to the AGENTS.md file'),
  memoryDir: z.string().optional().describe('Memory directory for output (default: .memory/ relative to AGENTS.md)'),
})

const IngestRulesOutputSchema = z.object({
  vertices: z.array(
    z.object({
      vertexPath: z.string().describe('Absolute path to the written .jsonld file'),
      vertex: z.record(z.string(), z.unknown()).describe('The JSON-LD vertex'),
    }),
  ),
})

export { IngestRulesInputSchema, IngestRulesOutputSchema }

// ============================================================================
// Section Parser
// ============================================================================

/**
 * A parsed section from the markdown rules file.
 *
 * @internal
 */
type RuleSection = {
  title: string
  content: string
  subsections: { title: string; content: string }[]
}

/**
 * Parse markdown into top-level sections with their subsections.
 *
 * @remarks
 * Splits on `# ` headers. Subsections are `## ` or deeper within each
 * top-level section. Ignores the file-level title (first `# AGENTS.md`).
 *
 * @internal
 */
export const parseRuleSections = (markdown: string): RuleSection[] => {
  const lines = markdown.split('\n')
  const sections: RuleSection[] = []
  let current: RuleSection | null = null
  let currentSub: { title: string; lines: string[] } | null = null
  const contentLines: string[] = []

  const flushSub = () => {
    if (currentSub && current) {
      current.subsections.push({
        title: currentSub.title,
        content: currentSub.lines.join('\n').trim(),
      })
      currentSub = null
    }
  }

  const flushSection = () => {
    flushSub()
    if (current) {
      current.content = contentLines.join('\n').trim()
      contentLines.length = 0
      sections.push(current)
      current = null
    }
  }

  for (const line of lines) {
    // Top-level heading
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      flushSection()
      const title = line.slice(2).trim()
      // Skip the file-level title
      if (title === 'AGENTS.md') continue
      current = { title, content: '', subsections: [] }
      continue
    }

    // Subsection heading (## or deeper)
    if (current && /^#{2,}\s/.test(line)) {
      flushSub()
      const title = line.replace(/^#+\s*/, '').trim()
      currentSub = { title, lines: [] }
      continue
    }

    // Content lines
    if (currentSub) {
      currentSub.lines.push(line)
    } else if (current) {
      contentLines.push(line)
    }
  }
  flushSection()

  return sections
}

// ============================================================================
// Vertex Builder
// ============================================================================

/**
 * Slugify a section title for use as an `@id`.
 *
 * @internal
 */
const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Build a JSON-LD RuleSet vertex from a parsed section.
 *
 * @internal
 */
const buildRuleSetVertex = (section: RuleSection, scope: string, sourcePath: string): Record<string, unknown> => ({
  '@context': { bp: 'urn:bp:' },
  '@id': `rules://${slugify(section.title)}`,
  '@type': 'RuleSet',
  'schema:name': section.title,
  scope,
  source: sourcePath,
  rules: section.subsections.map((sub) => ({
    '@id': `rule://${slugify(section.title)}/${slugify(sub.title)}`,
    '@type': 'GovernanceRule',
    'schema:name': sub.title,
    content: sub.content,
  })),
  timestamp: new Date().toISOString(),
})

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Ingest AGENTS.md and write JSON-LD RuleSet vertices.
 *
 * @param path - Absolute path to the AGENTS.md file
 * @param memoryDir - Absolute path to the memory directory
 * @returns Array of vertex paths and vertex content
 *
 * @public
 */
export const ingestRules = async (
  path: string,
  memoryDir: string,
): Promise<{ vertices: { vertexPath: string; vertex: Record<string, unknown> }[] }> => {
  if (!(await Bun.file(path).exists())) {
    throw new Error(`Rules file does not exist: ${path}`)
  }

  const content = await Bun.file(path).text()
  const sections = parseRuleSections(content)

  // Derive scope from file path (e.g., "project" for root AGENTS.md)
  const scope = basename(dirname(path)) === '.' ? 'project' : basename(dirname(path))

  const rulesDir = join(memoryDir, 'rules')
  const vertices: { vertexPath: string; vertex: Record<string, unknown> }[] = []

  for (const section of sections) {
    const vertex = buildRuleSetVertex(section, scope, path)
    const vertexPath = join(rulesDir, `${slugify(section.title)}.jsonld`)
    await Bun.write(vertexPath, `${JSON.stringify(vertex, null, 2)}\n`)
    vertices.push({ vertexPath, vertex })
  }

  return { vertices }
}

// ============================================================================
// CLI Handler
// ============================================================================

/**
 * CLI entry point for ingest-rules.
 *
 * @remarks
 * Exit 0 = success, 1 = domain error, 2 = bad input.
 *
 * @param args - CLI arguments (after command name)
 *
 * @public
 */
export const ingestRulesCli = async (args: string[]) => {
  if (args.includes('--help') || args.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(`plaited ingest-rules
Ingest AGENTS.md rules into JSON-LD RuleSet vertices

Usage: plaited ingest-rules '<json>' [options]
       echo '<json>' | plaited ingest-rules

Input (JSON):
  path        string   Path to AGENTS.md file (required)
  memoryDir   string   Memory directory (default: .memory/)

Options:
  --schema <input|output>  Print JSON Schema and exit
  -h, --help               Show this help

Exit codes:
  0  Vertices written successfully
  1  Domain error (missing file, parse failure)
  2  Bad input or tool error`)
    return
  }

  const input = await parseCli(args, IngestRulesInputSchema, {
    name: 'ingest-rules',
    outputSchema: IngestRulesOutputSchema,
  })

  const cwd = process.cwd()
  const rulesPath = input.path.startsWith('/') ? input.path : resolve(cwd, input.path)
  const memoryDir = input.memoryDir
    ? input.memoryDir.startsWith('/')
      ? input.memoryDir
      : resolve(cwd, input.memoryDir)
    : join(dirname(rulesPath), '.memory')

  try {
    const result = await ingestRules(rulesPath, memoryDir)
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    process.exit(1)
  }
}

if (import.meta.main) {
  await ingestRulesCli(Bun.argv.slice(2))
}
