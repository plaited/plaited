/**
 * Agent-facing skill client — progressive disclosure over local skills.
 *
 * @remarks
 * Implements the agentskills.io three-tier progressive-disclosure pattern for
 * local skills, but with **search-on-demand** replacing the spec's recommended
 * static catalog-in-system-prompt (the deliberate 2026-09-07 decision). This
 * tool is the dumb primitive: it discovers, reads, and lists resources. The
 * catalog/search loop lives in a kernel behavioral thread, not here.
 *
 * Three modes (discriminated union on `mode`):
 * - `discover` — tier 1 metadata: scan `.agents/skills/` at project + user
 *   level, parse YAML frontmatter → `{ name, description, location, ... }`
 *   records (lenient validation per spec).
 * - `read-skill` — tier 2 full instructions: load the SKILL.md body with
 *   frontmatter stripped.
 * - `list-resources` — tier 3 bundled-resource preview: enumerate bundled
 *   files in the skill directory without reading them.
 *
 * Returns data only; never writes. Own frontmatter parsing (does not import
 * from `src/cli/markdown.ts`). `cwd` is provisioner-supplied (same
 * trust-boundary treatment as `read`/`ls`/`write`).
 *
 * MINIMAL: no static skill catalog is emitted into any system prompt — the
 * search-mediated loop is the deliberate deviation from agentskills.io Step 3.
 * Upgrade path: none intended; search-on-demand is the chosen architecture.
 *
 * @packageDocumentation
 */

import { readdir, stat } from 'node:fs/promises'
import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { YAML } from 'bun'
import { useTool } from './use-tool.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SkillRecord = {
  name: string
  description: string
  location: string
  [key: string]: unknown
}

type ResourceEntry = {
  /** Path relative to the skill directory, using forward slashes. */
  name: string
  type: 'file' | 'directory'
}

export type SkillClientInput =
  | { mode: 'discover'; cwd: string }
  | { mode: 'read-skill'; cwd: string; location: string }
  | { mode: 'list-resources'; cwd: string; location: string }

export type SkillClientOutput =
  | { mode: 'discover'; skills: SkillRecord[]; warnings: string[] }
  | { mode: 'read-skill'; name: string; body: string; isError?: false }
  | { mode: 'read-skill'; isError: true; message: string }
  | { mode: 'list-resources'; resources: ResourceEntry[] }

// ---------------------------------------------------------------------------
// Tool JSON schemas — hand-written oneOf on `mode`, cast through `unknown`
// as JSONSchemaType (discriminated unions exceed its static power; read.ts /
// frontier.ts / mcp-client.ts precedent). AJV validates at runtime.
// ---------------------------------------------------------------------------

export const SkillClientInputSchema = {
  type: 'object',
  oneOf: [
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'discover' },
        cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
      },
      required: ['mode', 'cwd'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'read-skill' },
        cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
        location: {
          type: 'string',
          minLength: 1,
          description: 'path to the SKILL.md file — absolute, or relative to the provisioned cwd',
        },
      },
      required: ['mode', 'cwd', 'location'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'list-resources' },
        cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
        location: {
          type: 'string',
          minLength: 1,
          description: 'path to the SKILL.md file whose directory to enumerate',
        },
      },
      required: ['mode', 'cwd', 'location'],
      additionalProperties: false,
    },
  ],
  description:
    'Progressive disclosure over local skills: discover (tier 1 metadata), read-skill (tier 2 full instructions), list-resources (tier 3 bundled-resource preview).',
} as unknown as JSONSchemaType<SkillClientInput>

export const SkillClientOutputSchema = {
  type: 'object',
  oneOf: [
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'discover' },
        skills: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              location: { type: 'string' },
            },
            required: ['name', 'description', 'location'],
            additionalProperties: true,
          },
        },
        warnings: { type: 'array', items: { type: 'string' } },
      },
      required: ['mode', 'skills', 'warnings'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'read-skill' },
        name: { type: 'string', nullable: true },
        body: { type: 'string', nullable: true },
        isError: { type: 'boolean', nullable: true },
        message: { type: 'string', nullable: true },
      },
      required: ['mode'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'list-resources' },
        resources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['file', 'directory'] },
            },
            required: ['name', 'type'],
            additionalProperties: false,
          },
        },
      },
      required: ['mode', 'resources'],
      additionalProperties: false,
    },
  ],
  description: 'Skill client operation result, discriminated by mode.',
} as unknown as JSONSchemaType<SkillClientOutput>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SKILL_CLIENT_TOOL_NAME = 'skill-client'
const SKILL_DIR_NAME = '.agents/skills'
const SKILL_FILE = 'SKILL.md'
const SKIP_DIRS = new Set(['.git', 'node_modules', '.DS_Store'])
const NAME_MAX_LENGTH = 64

// ---------------------------------------------------------------------------
// Frontmatter parsing (own — does not import src/cli/markdown.ts)
// ---------------------------------------------------------------------------

type ParsedFrontmatter = {
  frontmatter: Record<string, unknown>
  body: string
}

/**
 * Parse a SKILL.md into frontmatter + body. Lenient: returns `null` when the
 * YAML block is absent or unparseable (e.g. an unquoted value containing a
 * colon — the common cross-client breakage the agentskills.io spec calls out).
 */
const parseSkillFrontmatter = (markdown: string): ParsedFrontmatter | null => {
  if (!markdown.startsWith('---')) return null

  // Find the opening delimiter end (skip trailing whitespace on the first line).
  let openEnd = 3
  while (openEnd < markdown.length && markdown[openEnd] !== '\n' && markdown[openEnd] !== '\r') {
    // Only whitespace allowed between the dashes and the line break.
    if (markdown[openEnd] !== ' ' && markdown[openEnd] !== '\t') return null
    openEnd++
  }
  if (openEnd >= markdown.length) return null
  // Skip the line break.
  const frontmatterStart = openEnd + (markdown[openEnd] === '\r' && markdown[openEnd + 1] === '\n' ? 2 : 1)

  // Find the closing `---` on its own line.
  let closeIndex = -1
  for (let i = frontmatterStart; i < markdown.length - 3; i++) {
    if (markdown[i] !== '\n' && markdown[i] !== '\r') continue
    // Must be at a line start: the char at i is a line break, so i+1 begins a line.
    const lineStart = i + 1
    if (markdown.startsWith('---', lineStart)) {
      // The delimiter must be followed by a line break or end-of-file, and only
      // whitespace may trail it on that line.
      const after = lineStart + 3
      if (after === markdown.length) {
        closeIndex = i
        break
      }
      const trailing = markdown[after]
      if (trailing === '\n' || trailing === '\r') {
        closeIndex = i
        break
      }
    }
  }
  if (closeIndex === -1) return null

  const frontmatterText = markdown.slice(frontmatterStart, closeIndex)
  let frontmatter: Record<string, unknown>
  try {
    const parsed = YAML.parse(frontmatterText)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    frontmatter = parsed as Record<string, unknown>
  } catch {
    return null
  }

  // Body = everything after the closing delimiter, trimmed.
  let bodyStart = closeIndex + 1 + 3 // past the line break + `---`
  while (bodyStart < markdown.length && (markdown[bodyStart] === ' ' || markdown[bodyStart] === '\t')) bodyStart++
  if (markdown[bodyStart] === '\r') bodyStart++
  if (markdown[bodyStart] === '\n') bodyStart++
  const body = markdown.slice(bodyStart).trim()

  return { frontmatter, body }
}

// ---------------------------------------------------------------------------
// discover (tier 1)
// ---------------------------------------------------------------------------

type DiscoveredSkill = {
  record: SkillRecord
  scope: 'project' | 'user'
}

const scanSkillsDir = async (
  skillsRoot: string,
  scope: 'project' | 'user',
  warnings: string[],
): Promise<DiscoveredSkill[]> => {
  const found: DiscoveredSkill[] = []
  let topEntries: import('node:fs').Dirent[]
  try {
    topEntries = await readdir(skillsRoot, { withFileTypes: true })
  } catch {
    // No skills dir at this scope — not an error, just nothing to discover.
    return found
  }

  for (const entry of topEntries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue
    const skillDir = path.join(skillsRoot, entry.name)
    const skillFile = path.join(skillDir, SKILL_FILE)
    const file = Bun.file(skillFile)
    if (!(await file.exists())) {
      // Not a skill directory (no SKILL.md) — skip silently.
      continue
    }
    const markdown = await file.text()
    const parsed = parseSkillFrontmatter(markdown)
    if (!parsed) {
      warnings.push(`Skipped skill "${entry.name}" at ${skillFile}: unparseable YAML frontmatter`)
      continue
    }
    const name = parsed.frontmatter.name
    const description = parsed.frontmatter.description
    if (typeof name !== 'string' || name.length === 0) {
      warnings.push(`Skipped skill at ${skillFile}: missing or empty name`)
      continue
    }
    if (typeof description !== 'string' || description.trim().length === 0) {
      warnings.push(`Skipped skill "${name}" at ${skillFile}: missing or empty description`)
      continue
    }
    // Lenient validation (warn, load anyway): name vs parent dir, name length.
    if (name !== entry.name) {
      warnings.push(`Skill "${name}" at ${skillFile}: name does not match parent directory "${entry.name}"`)
    }
    if (name.length > NAME_MAX_LENGTH) {
      warnings.push(`Skill "${name}" at ${skillFile}: name exceeds ${NAME_MAX_LENGTH} characters`)
    }

    const { name: _n, description: _d, ...rest } = parsed.frontmatter
    const record: SkillRecord = {
      name,
      description,
      location: skillFile,
      ...rest,
    }
    found.push({ record, scope })
  }
  return found
}

const discoverSkills = async (cwd: string): Promise<{ skills: SkillRecord[]; warnings: string[] }> => {
  const warnings: string[] = []
  const projectRoot = path.join(cwd, SKILL_DIR_NAME)
  const userRoot = path.join(Bun.env.HOME ?? Bun.env.USERPROFILE ?? '.', SKILL_DIR_NAME)

  // User-level first, then project-level, so project wins on collision.
  const user = await scanSkillsDir(userRoot, 'user', warnings)
  const project = await scanSkillsDir(projectRoot, 'project', warnings)

  // Deterministic precedence: project-level overrides user-level (same name).
  // Within a scope, first-found wins (directories read in fs order).
  const byName = new Map<string, DiscoveredSkill>()
  for (const s of user) byName.set(s.record.name, s)
  for (const s of project) {
    const existing = byName.get(s.record.name)
    if (existing && existing.scope === 'user') {
      warnings.push(`Skill "${s.record.name}": project-level overrides user-level`)
    }
    byName.set(s.record.name, s)
  }

  const skills = [...byName.values()].map((s) => s.record)
  // Stable order by name.
  skills.sort((a, b) => a.name.localeCompare(b.name))
  return { skills, warnings }
}

// ---------------------------------------------------------------------------
// read-skill (tier 2)
// ---------------------------------------------------------------------------

const readSkillBody = async (cwd: string, location: string): Promise<SkillClientOutput> => {
  const resolved = path.resolve(cwd, location)
  const file = Bun.file(resolved)
  if (!(await file.exists())) {
    return { mode: 'read-skill', isError: true, message: `Skill file not found: ${resolved}` }
  }
  const markdown = await file.text()
  const parsed = parseSkillFrontmatter(markdown)
  // No frontmatter is allowed for read-skill (the whole file is the body); only
  // unparseable frontmatter (a malformed block that begins with ---) is an error.
  if (parsed === null && markdown.startsWith('---')) {
    return { mode: 'read-skill', isError: true, message: `Unparseable YAML frontmatter: ${resolved}` }
  }
  if (parsed === null) {
    return { mode: 'read-skill', name: '', body: markdown.trim() }
  }
  return { mode: 'read-skill', name: String(parsed.frontmatter.name ?? ''), body: parsed.body }
}

// ---------------------------------------------------------------------------
// list-resources (tier 3)
// ---------------------------------------------------------------------------

const walkSkillDir = async (dir: string, prefix: string, out: ResourceEntry[]): Promise<void> => {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    // SKILL.md is the instruction file (tier 2), not a bundled resource.
    if (!prefix && entry.name === SKILL_FILE) continue
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      out.push({ name: rel, type: 'directory' })
      await walkSkillDir(path.join(dir, entry.name), rel, out)
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      out.push({ name: rel, type: 'file' })
    }
  }
}

const listResources = async (cwd: string, location: string): Promise<ResourceEntry[]> => {
  const resolved = path.resolve(cwd, location)
  const skillDir = path.dirname(resolved)
  const stats = await stat(skillDir).catch(() => undefined)
  if (!stats?.isDirectory()) return []
  const out: ResourceEntry[] = []
  await walkSkillDir(skillDir, '', out)
  // Sort for stable output.
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

// ---------------------------------------------------------------------------
// Tool run
// ---------------------------------------------------------------------------

const run = async (input: SkillClientInput): Promise<SkillClientOutput> => {
  switch (input.mode) {
    case 'discover': {
      const { skills, warnings } = await discoverSkills(input.cwd)
      return { mode: 'discover', skills, warnings }
    }
    case 'read-skill': {
      return readSkillBody(input.cwd, input.location)
    }
    case 'list-resources': {
      const resources = await listResources(input.cwd, input.location)
      return { mode: 'list-resources', resources }
    }
  }
}

// ---------------------------------------------------------------------------
// useTool registration
// ---------------------------------------------------------------------------

/**
 * Progressive disclosure over local skills: discover (tier 1 metadata),
 * read-skill (tier 2 full instructions), list-resources (tier 3
 * bundled-resource preview). Returns data only — never writes. Own
 * frontmatter parsing; does not import from the markdown CLI.
 */
export const skillClient = useTool(
  {
    name: SKILL_CLIENT_TOOL_NAME,
    description:
      'Progressive disclosure over local skills. discover scans ' +
      '.agents/skills/ at project + user level and parses frontmatter into ' +
      'metadata records (tier 1). read-skill loads the SKILL.md body with ' +
      'frontmatter stripped (tier 2). list-resources enumerates bundled ' +
      'files in the skill directory without reading them (tier 3). Returns ' +
      'data only — never writes.',
    inputSchema: SkillClientInputSchema,
    outputSchema: SkillClientOutputSchema,
  },
  run,
)
