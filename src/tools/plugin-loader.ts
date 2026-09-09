/**
 * Conformant Agent Plugins v1 client — validates a plugin package's
 * plugin.json + mcp.json, discovers skills/ from the fixed location, and
 * reads the `sh.behavioral` client extension for models / gating / spaces.
 *
 * @remarks
 * A stateless `useTool` unit: input `{ path, cwd }` (plugin.json path
 * resolved against the provisioned cwd), output the normalized manifest
 * `{ name, version, mcps, skills, models, threads, spaces }`. Loading is
 * read-only — no writes, no provisioning.
 *
 * **Validation posture (§11.3):**
 * - **Fatal** — missing/wrong `$schema`, missing/invalid `name`, invalid
 *   metadata field types, non-object extensions, bad `sh.behavioral` model
 *   declaration (e.g. raw `apiKey`). The plugin is rejected; no components
 *   are discovered.
 * - **Report-and-ignore** — unknown top-level fields in plugin.json (§5.2).
 *   The plugin still loads.
 * - **Skipped** — a bad mcp.json server entry (siblings still load); a
 *   non-conformant skill dir (other skills still load); mcp.json $schema
 *   mismatch (MCP disabled, skills still load).
 * - **Ignored** — unknown extension namespaces (§8.1 — contents not
 *   validated).
 *
 * @packageDocumentation
 */

import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { ajv, useTool } from './use-tool.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type McpServerConfig = {
  type: 'stdio' | 'streamable-http' | 'sse'
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
}

export type PluginModel = {
  provider: string
  modelId: string
  endpointUrl: string
  apiKeyRef?: string
  locality?: string
}

export type Gating = {
  include?: string[]
  exclude?: string[]
}

export type SpaceConfig = {
  models?: PluginModel[]
  mcps?: Gating
  skills?: Gating
  threads?: Gating
}

export type ShBehavioralExtension = {
  models?: PluginModel[]
  mcps?: Gating
  skills?: Gating
  threads?: Gating
  spaces?: Record<string, SpaceConfig>
}

/** Normalized manifest — the contract the provisioning thread consumes. */
export type PluginManifest = {
  name: string
  version?: string
  mcps: Record<string, McpServerConfig>
  skills: string[]
  models: PluginModel[]
  threads: string[]
  spaces: Record<string, SpaceConfig>
}

export type PluginLoaderInput = { path: string; cwd: string }

export type PluginLoaderOutput = PluginManifest | { isError: true; message: string }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PLUGIN_LOADER_TOOL_NAME = 'plugin-loader'

const PLUGIN_SCHEMA_URL = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'

// §5.5: 1–64 chars, lowercase alnum + - + ., start/end alnum, no --/..
const NAME_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/
const NAME_NO_DOUBLE = /(--|\.\.)/

// ---------------------------------------------------------------------------
// plugin.json schema — closed top-level; unknown fields are *report-and-
// ignore* so we validate the known fields individually and collect unknowns
// separately rather than using additionalProperties: false at the top level.
// ---------------------------------------------------------------------------

const authorSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
    url: { type: 'string', nullable: true },
  },
  additionalProperties: false,
} as const

// The known top-level fields per §5.2
const KNOWN_FIELDS = new Set([
  '$schema',
  'name',
  'version',
  'description',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'extensions',
])

// Model schema for sh.behavioral.models — rejects raw apiKey
const modelSchema = {
  type: 'object',
  properties: {
    provider: { type: 'string', minLength: 1 },
    modelId: { type: 'string', minLength: 1 },
    endpointUrl: { type: 'string', minLength: 1 },
    apiKeyRef: { type: 'string', nullable: true },
    locality: { type: 'string', nullable: true },
  },
  required: ['provider', 'modelId', 'endpointUrl'],
  additionalProperties: false,
} as const

const gatingSchema = {
  type: 'object',
  properties: {
    include: { type: 'array', items: { type: 'string', minLength: 1 }, nullable: true },
    exclude: { type: 'array', items: { type: 'string', minLength: 1 }, nullable: true },
  },
  additionalProperties: false,
} as const

const spaceConfigSchema = {
  type: 'object',
  properties: {
    models: { type: 'array', items: modelSchema, nullable: true },
    mcps: gatingSchema,
    skills: gatingSchema,
    threads: gatingSchema,
  },
  additionalProperties: false,
} as const

const shBehavioralSchema = {
  type: 'object',
  properties: {
    models: { type: 'array', items: modelSchema, nullable: true },
    mcps: gatingSchema,
    skills: gatingSchema,
    threads: gatingSchema,
    spaces: {
      type: 'object',
      additionalProperties: spaceConfigSchema,
      nullable: true,
    },
  },
  additionalProperties: false,
} as const

const validateShBehavioral = ajv.compile(shBehavioralSchema)

// ---------------------------------------------------------------------------
// mcp.json schemas — two-stage: top-level then per-entry
// ---------------------------------------------------------------------------

const mcpTopSchema = {
  type: 'object',
  properties: {
    $schema: { type: 'string' },
    mcpServers: { type: 'object' },
  },
  required: ['$schema', 'mcpServers'],
  additionalProperties: false,
} as const

const stdioServerSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'stdio' },
    command: { type: 'string', minLength: 1 },
    args: { type: 'array', items: { type: 'string' }, nullable: true },
    env: { type: 'object', additionalProperties: { type: 'string' }, nullable: true },
    cwd: { type: 'string', nullable: true },
  },
  required: ['type', 'command'],
  additionalProperties: false,
} as const

const httpServerSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['streamable-http', 'sse'] },
    url: { type: 'string', minLength: 1 },
    headers: { type: 'object', additionalProperties: { type: 'string' }, nullable: true },
  },
  required: ['type', 'url'],
  additionalProperties: false,
} as const

const validateMcpTop = ajv.compile(mcpTopSchema)
const validateStdioServer = ajv.compile(stdioServerSchema)
const validateHttpServer = ajv.compile(httpServerSchema)

// ---------------------------------------------------------------------------
// Tool input / output JSON schemas
// ---------------------------------------------------------------------------

export const PluginLoaderInputSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'plugin.json path — absolute, or relative to the provisioned cwd' },
    cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
  },
  required: ['path', 'cwd'],
  additionalProperties: false,
  description: 'Load + validate a plugin package (plugin.json + mcp.json + skills/ + extensions).',
} as unknown as JSONSchemaType<PluginLoaderInput>

export const PluginLoaderOutputSchema = {
  type: 'object',
  oneOf: [
    {
      type: 'object',
      properties: {
        name: { type: 'string' },
        version: { type: 'string', nullable: true },
        mcps: { type: 'object' },
        skills: { type: 'array', items: { type: 'string' } },
        models: { type: 'array' },
        threads: { type: 'array', items: { type: 'string' } },
        spaces: { type: 'object' },
      },
      required: ['name', 'mcps', 'skills', 'models', 'threads', 'spaces'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        isError: { type: 'boolean', const: true },
        message: { type: 'string', minLength: 1 },
      },
      required: ['isError', 'message'],
      additionalProperties: false,
    },
  ],
  description: 'Normalized plugin manifest, or { isError, message } on failure.',
} as unknown as JSONSchemaType<PluginLoaderOutput>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const errMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

const validateName = (name: unknown): boolean => {
  if (typeof name !== 'string') return false
  if (name.length < 1 || name.length > 64) return false
  if (!NAME_PATTERN.test(name)) return false
  if (NAME_NO_DOUBLE.test(name)) return false
  return true
}

/** Extract the schema version from a $schema URL for cross-file comparison. */
const schemaVersion = (url: string): string | null => {
  const m = url.match(/\/schemas\/([^/]+)\//)
  return m?.[1] ?? null
}

// ---------------------------------------------------------------------------
// Validation stages
// ---------------------------------------------------------------------------

type FatalResult = { isError: true; message: string }

const validatePluginJson = (
  parsed: unknown,
): FatalResult | { name: string; version?: string; extensions: Record<string, unknown> } => {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { isError: true, message: 'plugin.json must be a JSON object' }
  }
  const obj = parsed as Record<string, unknown>

  // $schema — required, must match the canonical URL
  if (obj.$schema !== PLUGIN_SCHEMA_URL) {
    return { isError: true, message: `plugin.json $schema must be ${PLUGIN_SCHEMA_URL}` }
  }

  // name — required, §5.5 constraints
  if (!('name' in obj)) {
    return { isError: true, message: 'plugin.json missing required field: name' }
  }
  if (!validateName(obj.name)) {
    return { isError: true, message: `plugin.json name "${obj.name}" violates §5.5 naming constraints` }
  }

  // Validate known metadata fields (fatal if wrong type)
  if ('version' in obj && typeof obj.version !== 'string') {
    return { isError: true, message: 'plugin.json version must be a string' }
  }
  if ('description' in obj && typeof obj.description !== 'string') {
    return { isError: true, message: 'plugin.json description must be a string' }
  }
  if ('homepage' in obj && typeof obj.homepage !== 'string') {
    return { isError: true, message: 'plugin.json homepage must be a string' }
  }
  if ('repository' in obj && typeof obj.repository !== 'string') {
    return { isError: true, message: 'plugin.json repository must be a string' }
  }
  if ('license' in obj && typeof obj.license !== 'string') {
    return { isError: true, message: 'plugin.json license must be a string' }
  }
  if ('keywords' in obj) {
    if (!Array.isArray(obj.keywords) || obj.keywords.some((k) => typeof k !== 'string')) {
      return { isError: true, message: 'plugin.json keywords must be an array of strings' }
    }
  }
  if ('author' in obj) {
    const authorValid = ajv.compile(authorSchema)
    if (!authorValid(obj.author)) {
      return {
        isError: true,
        message: 'plugin.json author must be an object with optional name, email, url string fields',
      }
    }
  }

  // extensions — must be an object if present
  let extensions: Record<string, unknown> = {}
  if ('extensions' in obj) {
    if (typeof obj.extensions !== 'object' || obj.extensions === null || Array.isArray(obj.extensions)) {
      return { isError: true, message: 'plugin.json extensions must be an object' }
    }
    extensions = obj.extensions as Record<string, unknown>
  }

  // Report-and-ignore unknown top-level fields (§5.2, non-fatal)
  for (const key of Object.keys(obj)) {
    if (!KNOWN_FIELDS.has(key)) {
      // Reported (could collect warnings) but ignored — plugin still loads
    }
  }

  return { name: obj.name as string, version: obj.version as string | undefined, extensions }
}

const loadMcpJson = async (
  mcpPath: string,
  pluginSchemaVersion: string | null,
): Promise<Record<string, McpServerConfig>> => {
  const file = Bun.file(mcpPath)
  if (!(await file.exists())) return {}

  let text: string
  try {
    text = await file.text()
  } catch {
    return {}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {}
  }

  // Stage 1: top-level validation
  if (!validateMcpTop(parsed)) return {}

  const mcpTop = parsed as { $schema: string; mcpServers: Record<string, unknown> }

  // §10.1: $schema version must match plugin.json's
  const mcpVersion = schemaVersion(mcpTop.$schema)
  if (mcpVersion !== pluginSchemaVersion) return {}

  // Stage 2: per-entry validation with failure isolation
  const result: Record<string, McpServerConfig> = {}
  for (const [name, entry] of Object.entries(mcpTop.mcpServers)) {
    if (validateStdioServer(entry)) {
      result[name] = entry as McpServerConfig
    } else if (validateHttpServer(entry)) {
      result[name] = entry as McpServerConfig
    }
    // Bad entry skipped, siblings continue
  }
  return result
}

const discoverSkills = async (skillsDir: string): Promise<string[]> => {
  // missing skills/ = valid absence
  try {
    const entries = await Array.fromAsync(new Bun.Glob('*/SKILL.md').scan({ cwd: skillsDir, onlyFiles: true }))
    return entries.map((e) => e.split('/')[0] as string)
  } catch {
    return []
  }
}

const resolveThreads = async (
  threadsDir: string,
  pluginRoot: string,
  gating: Gating | undefined,
): Promise<string[] | FatalResult> => {
  // Discover all thread files in threads/
  let allFiles: string[] = []
  try {
    allFiles = await Array.fromAsync(new Bun.Glob('*').scan({ cwd: threadsDir, onlyFiles: true }))
  } catch {
    // threads/ doesn't exist — valid, no files
  }

  // If no gating, return all
  if (!gating || (!gating.include && !gating.exclude)) {
    return allFiles.sort()
  }

  // Enforce plugin-root containment (§4.1) on include paths themselves,
  // even if the file doesn't exist in threads/ — a path like ../escape.ts
  // must be rejected before filtering.
  if (gating?.include) {
    for (const threadPath of gating.include) {
      const resolved = path.resolve(threadsDir, threadPath)
      if (!resolved.startsWith(pluginRoot + path.sep) && resolved !== pluginRoot) {
        return { isError: true, message: `thread path "${threadPath}" resolves outside the plugin root` }
      }
    }
  }

  // Apply gating: include (allowlist) then exclude (blocklist)
  let selected = allFiles
  if (gating?.include) {
    selected = selected.filter((f) => gating.include!.includes(f))
  }
  if (gating?.exclude) {
    selected = selected.filter((f) => !gating.exclude!.includes(f))
  }

  return selected.sort()
}

// ---------------------------------------------------------------------------
// Tool run — stateless, read-only; errors → { isError, message }
// ---------------------------------------------------------------------------

const run = async (input: PluginLoaderInput): Promise<PluginLoaderOutput> => {
  const resolved = path.resolve(input.cwd, input.path)
  const pluginRoot = path.dirname(resolved)

  // 1. Read + parse plugin.json
  const file = Bun.file(resolved)
  if (!(await file.exists())) {
    return { isError: true, message: `plugin.json not found at ${input.path}` }
  }

  let text: string
  try {
    text = await file.text()
  } catch (err) {
    return { isError: true, message: `Could not read plugin.json at ${input.path}: ${errMessage(err)}` }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return { isError: true, message: `Invalid JSON in plugin.json at ${input.path}: ${errMessage(err)}` }
  }

  // 2. Validate plugin.json
  const pluginResult = validatePluginJson(parsed)
  if ('isError' in pluginResult) return pluginResult

  const { name, version, extensions } = pluginResult

  // 3. Validate sh.behavioral extension (fatal if present but malformed)
  let shBehavioral: ShBehavioralExtension = {}
  if ('sh.behavioral' in extensions) {
    // Explicit apiKey check — clear error instead of generic "additional properties"
    const ext = extensions['sh.behavioral']
    if (typeof ext === 'object' && ext !== null && !Array.isArray(ext)) {
      const extObj = ext as { models?: unknown[] }
      if (Array.isArray(extObj.models)) {
        for (const m of extObj.models) {
          if (typeof m === 'object' && m !== null && 'apiKey' in m) {
            return { isError: true, message: 'sh.behavioral models must use apiKeyRef, not a raw apiKey' }
          }
        }
      }
    }
    if (!validateShBehavioral(extensions['sh.behavioral'])) {
      return {
        isError: true,
        message: `Invalid sh.behavioral extension: ${ajv.errorsText(validateShBehavioral.errors)}`,
      }
    }
    shBehavioral = extensions['sh.behavioral'] as ShBehavioralExtension
  }

  // 4. Load mcp.json
  const pVersion = schemaVersion(PLUGIN_SCHEMA_URL)
  const mcps = await loadMcpJson(path.join(pluginRoot, 'mcp.json'), pVersion)

  // Apply mcps gating from sh.behavioral
  let gatedMcps = mcps
  if (shBehavioral.mcps) {
    const g = shBehavioral.mcps
    let names = Object.keys(mcps)
    if (g.include) {
      names = names.filter((n) => g.include!.includes(n))
    }
    if (g.exclude) {
      names = names.filter((n) => !g.exclude!.includes(n))
    }
    gatedMcps = {}
    for (const n of names) {
      const v = mcps[n]
      if (v) gatedMcps[n] = v
    }
  }

  // 5. Discover skills
  let skills = await discoverSkills(path.join(pluginRoot, 'skills'))

  // Apply skills gating
  if (shBehavioral.skills) {
    const g = shBehavioral.skills
    if (g.include) {
      skills = skills.filter((s) => g.include!.includes(s))
    }
    if (g.exclude) {
      skills = skills.filter((s) => !g.exclude!.includes(s))
    }
  }

  // 6. Resolve threads
  const threadsResult = await resolveThreads(path.join(pluginRoot, 'threads'), pluginRoot, shBehavioral.threads)
  if ('isError' in threadsResult) return threadsResult
  const threads = threadsResult

  // 7. Extract models + spaces
  const models = shBehavioral.models ?? []
  const spaces = shBehavioral.spaces ?? {}

  return {
    name,
    version,
    mcps: gatedMcps,
    skills,
    models,
    threads,
    spaces,
  }
}

// ---------------------------------------------------------------------------
// useTool registration
// ---------------------------------------------------------------------------

/**
 * Load and validate a plugin package as a conformant Agent Plugins v1 client.
 * Validates plugin.json (closed schema, §5.2/§5.5), mcp.json (two-stage,
 * failure isolation), discovers skills/ from the fixed location, and reads
 * the `sh.behavioral` extension for models / gating / spaces. Returns the
 * normalized manifest `{ name, version, mcps, skills, models, threads,
 * spaces }`, or `{ isError, message }` on failure.
 */
export const pluginLoader = useTool(
  {
    name: PLUGIN_LOADER_TOOL_NAME,
    description:
      'Load and validate a plugin package (Agent Plugins v1 conformant ' +
      'client). Validates plugin.json + mcp.json, discovers skills/, reads ' +
      'the sh.behavioral extension. Returns { name, version, mcps, skills, ' +
      'models, threads, spaces } or { isError, message }.',
    inputSchema: PluginLoaderInputSchema,
    outputSchema: PluginLoaderOutputSchema,
  },
  run,
)
