/**
 * Skill discovery — scan directories for SKILL.md files and build a catalog.
 *
 * @remarks
 * Lightweight alternative to structural validation that extracts only the
 * activation catalog plus optional local evaluation pointers.
 *
 * Skills that fail to parse are skipped with a stderr warning.
 *
 * @public
 */

import { join } from 'node:path'
import * as z from 'zod'
import { parseCli } from '../cli/cli.utils.ts'
import { findSkillDirectories, findSkillEvaluationSurface, findSkillMd, parseFrontmatter } from './skill.utils.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * A single entry in the skill catalog.
 *
 * @remarks
 * Contains just enough to populate the system prompt catalog
 * and resolve activation requests. The model uses `name` and
 * `description` to decide relevance; `location` resolves the
 * full SKILL.md path for `read_file` activation.
 *
 * @public
 */
export type SkillCatalogEntry = {
  name: string
  description: string
  location: string
  evaluation?: {
    triggerPrompts?: string
    outputCases?: string
    rubric?: string
  }
}

/**
 * A collision diagnostic emitted when two skill sources define the same name.
 *
 * @public
 */
export type SkillCollisionDiagnostic = {
  type: 'collision'
  name: string
  message: string
}

// ============================================================================
// Schemas
// ============================================================================

/** @public */
export const SkillDiscoveryInputSchema = z.object({
  paths: z.array(z.string()).optional().describe('Directories to scan for skills (defaults to skills/)'),
})

/** @public */
export const SkillDiscoveryOutputSchema = z.array(
  z.object({
    name: z.string().describe('Skill name from frontmatter'),
    description: z.string().describe('Skill description from frontmatter'),
    location: z.string().describe('Absolute path to SKILL.md'),
    evaluation: z
      .object({
        triggerPrompts: z.string().optional().describe('Absolute path to trigger-evaluation prompts'),
        outputCases: z.string().optional().describe('Absolute path to output-quality cases'),
        rubric: z.string().optional().describe('Absolute path to evaluation guidance'),
      })
      .optional()
      .describe('Optional local behavioral-evaluation artifacts'),
  }),
)

// ============================================================================
// Discovery
// ============================================================================

/**
 * Discover skills under a root directory and return a catalog.
 *
 * @remarks
 * Scans for SKILL.md files, parses frontmatter with `Bun.YAML.parse()`,
 * extracts `name` + `description`, and surfaces optional skill-local
 * evaluation artifacts. Skills with missing or malformed frontmatter are
 * skipped (warning to stderr).
 *
 * @param rootDir - Root directory containing skill folders
 * @returns Array of catalog entries sorted by name
 *
 * @public
 */
export const discoverSkills = async (rootDir: string): Promise<SkillCatalogEntry[]> => {
  const skillDirs = await findSkillDirectories(rootDir)
  const catalog: SkillCatalogEntry[] = []

  for (const skillDir of skillDirs) {
    const skillMdPath = await findSkillMd(skillDir)
    if (!skillMdPath) continue

    try {
      const content = await Bun.file(skillMdPath).text()
      const { metadata } = parseFrontmatter(content)

      const name = metadata.name
      const description = metadata.description

      if (typeof name !== 'string' || !name) {
        console.error(`Skipping ${skillMdPath}: missing or invalid 'name' field`)
        continue
      }
      if (typeof description !== 'string' || !description) {
        console.error(`Skipping ${skillMdPath}: missing or invalid 'description' field`)
        continue
      }

      const evaluation = await findSkillEvaluationSurface(skillDir)
      catalog.push({ name, description, location: skillMdPath, evaluation })
    } catch (error) {
      console.error(`Skipping ${skillMdPath}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return catalog
}

// ============================================================================
// Collision Detection
// ============================================================================

/**
 * Detect name collisions across skill catalogs from multiple sources.
 *
 * @remarks
 * Priority: later entries win (project skills > global skills > framework built-ins).
 * Emits a diagnostic for each shadowed skill. Returns the deduplicated catalog.
 *
 * @param entries - Entries from all sources, ordered by priority (lowest first)
 * @returns Deduplicated catalog and collision diagnostics
 *
 * @public
 */
export const detectCollisions = (
  entries: SkillCatalogEntry[],
): { catalog: SkillCatalogEntry[]; diagnostics: SkillCollisionDiagnostic[] } => {
  const seen = new Map<string, string>()
  const diagnostics: SkillCollisionDiagnostic[] = []

  for (const entry of entries) {
    const existing = seen.get(entry.name)
    if (existing) {
      diagnostics.push({
        type: 'collision',
        name: entry.name,
        message: `Skill '${entry.name}' found in both ${existing} and ${entry.location}. Using ${entry.location} (later source wins).`,
      })
    }
    seen.set(entry.name, entry.location)
  }

  // Build deduplicated catalog — last entry per name wins
  const deduped = new Map<string, SkillCatalogEntry>()
  for (const entry of entries) {
    deduped.set(entry.name, entry)
  }
  return { catalog: [...deduped.values()], diagnostics }
}

// ============================================================================
// CLI Handler
// ============================================================================

/**
 * CLI entry point for `plaited discover-skills`.
 *
 * @param args - CLI arguments (after command name)
 *
 * @public
 */
export const discoverSkillsCli = async (args: string[]): Promise<void> => {
  if (args.includes('--help') || args.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(`plaited discover-skills
Scan directories for skills and output a catalog

This is discovery, not structural validation. It exposes optional skill-local
behavioral evaluation artifacts when present.

Usage: plaited discover-skills '<json>' [options]
       echo '<json>' | plaited discover-skills

Input (JSON):
  paths    string[]   Directories to scan (default: skills/)

Options:
  --schema <input|output>  Print JSON Schema and exit
  -h, --help               Show this help

Exit codes:
  0  Success (or --schema/--help)
  2  Bad input or tool error

Examples:
  plaited discover-skills '{"paths": ["skills/"]}'
  plaited discover-skills '{"paths": ["skills/", ".agents/skills/"]}'
  plaited discover-skills --schema input
  plaited discover-skills --schema output`)
    return
  }

  const input = await parseCli(args.length === 0 && process.stdin.isTTY ? ['{}'] : args, SkillDiscoveryInputSchema, {
    name: 'discover-skills',
    outputSchema: SkillDiscoveryOutputSchema,
  })

  const cwd = process.cwd()
  const searchPaths = input.paths?.length ? input.paths : [join(cwd, 'skills')]

  const allEntries: SkillCatalogEntry[] = []
  for (const searchPath of searchPaths) {
    const fullPath = searchPath.startsWith('/') ? searchPath : join(cwd, searchPath)
    const entries = await discoverSkills(fullPath)
    allEntries.push(...entries)
  }

  const { catalog, diagnostics } = detectCollisions(allEntries)
  for (const d of diagnostics) {
    console.error(d.message)
  }

  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(JSON.stringify(catalog, null, 2))
}
