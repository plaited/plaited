import type { JsonSchemaObject } from '../main/behavioral.schemas.ts'

/**
 * The plain-data shape consumed by `useTool` as its first argument.
 *
 * Tools in `src/pack/` export a frozen `ToolArgs` object — no hooks, no
 * engine imports, testable without the behavioral program.
 *
 * `inputSchema`/`outputSchema` are JSON Schema documents (validated by
 * `JsonSchemaObjectSchema` at registration, compiled via Ajv at dispatch).
 *
 * **Artifact convention:** when a tool's result is large or non-JSON-safe
 * (logs, generated binaries), the tool writes it to a file and returns the
 * path in `output` — the model fetches with `read`/`binary`. Never return
 * unbounded inline content.
 *
 * Purity rule: schemas must never contain `call_id` — it is the loop's
 * envelope, stamped at dispatch time.
 */
export type ToolArgs = {
  readonly name: string
  readonly inputSchema: JsonSchemaObject
  readonly outputSchema: JsonSchemaObject
  /** `input` is the model-facing schema output (JSON-safe). */
  readonly run: (input: JsonObject) => Promise<{ output: unknown }>
  readonly description?: string
}

/** Local type for JSON objects — mirrors the engine's JsonObject. */
export type JsonObject = { [key: string]: unknown }

/** Provision-time extensions to a tool's model-facing input. */
export type ProvisionInput = Record<string, unknown>

/** Provision-time cwd scoping shared by every file tool. */
export type CwdProvision = { cwd?: string }
