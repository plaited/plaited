/**
 * Agent-facing plugin manifest loader — parses a plugin.json into validated
 * declarations.
 *
 * @remarks
 * A stateless `useTool` unit ({@link useTool}): input `{ path, cwd }` (a
 * plugin.json path resolved against the provisioned cwd like the other file
 * tools), output the parsed + structurally-validated declarations
 * `{ mcps, skills, models, threads }`. Loading is read-only — no writes, no
 * provisioning. A kernel thread reacts to `plugin.loaded` and provisions
 * discovery rows / registers threads / routes; that thread is deferred
 * (threads.ts).
 *
 * The manifest schema ({@link PluginManifestSchema}) is the contract threads
 * consume. `models[].apiKeyRef` is a keychain key *name*, never a raw key —
 * the schema rejects a `apiKey` field so secrets stay in the keychain.
 *
 * @packageDocumentation
 */

import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { ajv, useTool } from './use-tool.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PluginMcp = { url: string; name?: string; description?: string }
type PluginModel = {
  provider: string
  modelId: string
  endpointUrl: string
  /** Keychain key name — never a raw key. */
  apiKeyRef?: string
  /** Where the endpoint lives; free-form (e.g. 'remote' | 'local'). */
  locality?: string
}

/** Parsed plugin.json declarations — the contract threads consume. */
export type PluginManifest = {
  mcps: PluginMcp[]
  /** SKILL.md paths bundled by the plugin. */
  skills: string[]
  models: PluginModel[]
  /** Behavior-file paths bundled by the plugin. */
  threads: string[]
}

export type PluginLoaderInput = { path: string; cwd: string }

export type PluginLoaderOutput = PluginManifest | { isError: true; message: string }

// ---------------------------------------------------------------------------
// Manifest JSON schema — single source for structural validation, compiled
// once with AJV. Strict object composition (additionalProperties: false) at
// every level so unknown fields — including a raw `apiKey` on a model — are
// rejected. `apiKeyRef` is a key name, never the key itself.
// ---------------------------------------------------------------------------

const pluginMcpJsonSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', minLength: 1, description: 'remote MCP server URL' },
    name: { type: 'string', nullable: true, description: 'optional catalog name' },
    description: { type: 'string', nullable: true, description: 'optional catalog description' },
  },
  required: ['url'],
  additionalProperties: false,
} as const

const pluginModelJsonSchema = {
  type: 'object',
  properties: {
    provider: { type: 'string', minLength: 1, description: 'model provider id' },
    modelId: { type: 'string', minLength: 1, description: 'model identifier' },
    endpointUrl: { type: 'string', minLength: 1, description: 'open-responses endpoint URL' },
    apiKeyRef: {
      type: 'string',
      nullable: true,
      description: 'keychain key name for the API key — never a raw key',
    },
    locality: { type: 'string', nullable: true, description: 'endpoint locality (e.g. remote | local)' },
  },
  required: ['provider', 'modelId', 'endpointUrl'],
  // Rejects a raw `apiKey` field and any unknown field — secrets stay in the
  // keychain; only `apiKeyRef` (a key name) is allowed.
  additionalProperties: false,
} as const

export const PluginManifestSchema = {
  type: 'object',
  properties: {
    mcps: {
      type: 'array',
      items: pluginMcpJsonSchema,
      description: 'remote MCP server declarations',
    },
    skills: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      description: 'bundled SKILL.md paths',
    },
    models: {
      type: 'array',
      items: pluginModelJsonSchema,
      description: 'model endpoint declarations',
    },
    threads: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      description: 'bundled behavior-file paths',
    },
  },
  required: ['mcps', 'skills', 'models', 'threads'],
  additionalProperties: false,
  description:
    'Parsed plugin.json declarations: mcps, skills, models, threads. ' +
    'models[].apiKeyRef is a keychain key name, never a raw key (apiKey is rejected).',
} as unknown as JSONSchemaType<PluginManifest>

const validateManifest = ajv.compile(PluginManifestSchema)

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
  description: 'Load + validate a plugin.json manifest at the given path.',
} as unknown as JSONSchemaType<PluginLoaderInput>

export const PluginLoaderOutputSchema = {
  type: 'object',
  oneOf: [
    {
      // Success: the parsed manifest. Reuses PluginManifestSchema's shape so the
      // output contract stays aligned with the validation contract (no parallel
      // schema source).
      type: 'object',
      properties: {
        mcps: { type: 'array', items: pluginMcpJsonSchema },
        skills: { type: 'array', items: { type: 'string', minLength: 1 } },
        models: { type: 'array', items: pluginModelJsonSchema },
        threads: { type: 'array', items: { type: 'string', minLength: 1 } },
      },
      required: ['mcps', 'skills', 'models', 'threads'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        isError: { type: 'boolean', const: true },
        message: { type: 'string', minLength: 1, description: 'human-readable failure reason' },
      },
      required: ['isError', 'message'],
      additionalProperties: false,
    },
  ],
  description: 'Parsed plugin declarations, or { isError, message } on failure.',
} as unknown as JSONSchemaType<PluginLoaderOutput>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PLUGIN_LOADER_TOOL_NAME = 'plugin-loader'

// ---------------------------------------------------------------------------
// Tool run — stateless, read-only; errors → { isError, message }
// ---------------------------------------------------------------------------

const run = async (input: PluginLoaderInput): Promise<PluginLoaderOutput> => {
  const resolved = path.resolve(input.cwd, input.path)
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

  if (!validateManifest(parsed)) {
    return {
      isError: true,
      message: `Invalid plugin manifest at ${input.path}: ${ajv.errorsText(validateManifest.errors)}`,
    }
  }
  return parsed as PluginManifest
}

const errMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

// ---------------------------------------------------------------------------
// useTool registration
// ---------------------------------------------------------------------------

/**
 * Load and structurally validate a plugin.json manifest. Resolves `path`
 * against the provisioned `cwd` (absolute paths win). Returns the parsed
 * declarations `{ mcps, skills, models, threads }`, or `{ isError, message }`
 * on a missing file, invalid JSON, or schema violation. Stateless — no writes,
 * no provisioning.
 */
export const pluginLoader = useTool(
  {
    name: PLUGIN_LOADER_TOOL_NAME,
    description:
      'Load and structurally validate a plugin.json manifest at a path ' +
      'resolved against the provisioned cwd. Returns parsed declarations ' +
      '{ mcps, skills, models, threads }, or { isError, message } on ' +
      'failure. Stateful provisioning (discovery rows, thread registration, ' +
      'routing) is a kernel thread, not this tool.',
    inputSchema: PluginLoaderInputSchema,
    outputSchema: PluginLoaderOutputSchema,
  },
  run,
)
