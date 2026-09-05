import Ajv2020 from 'ajv/dist/2020'

/**
 * Shared Ajv instance for tool schema validation.
 *
 * `validateSchema` rejects structurally-broken schemas at compile time so
 * tool registration fails fast. Draft 2020-12 — the current JSON Schema
 * standard, matching what model-generated tools produce.
 */
export const ajv = new Ajv2020({ strict: false, validateSchema: true })

/**
 * Wraps a raw JSON Schema document into a Standard Schema v1 object with
 * `~standard.jsonSchema`, making it acceptable as `inputSchema`/`outputSchema`
 * for MCP `registerTool`. The underlying validator is an Ajv compiled function.
 *
 * @param schema - A JSON Schema document (the tool's raw `inputSchema`/`outputSchema` export).
 * @returns An object structurally satisfying the MCP SDK's `StandardSchemaWithJSON`.
 *
 * @remarks
 * Bridges raw JSON Schema and the MCP SDK's Standard Schema requirement. Zod v4
 * implements `~standard` natively; Ajv does not. This adapter provides the glue
 * so tools declare schemas as plain JSON data — the same format model-generated
 * tools produce — without maintaining parallel zod definitions.
 */
// biome-ignore lint/suspicious/noExplicitAny: StandardSchemaWithJSON is not exported by the SDK; structural typing from outside is not feasible
export const fromJsonSchema = (schema: Record<string, unknown>): any => {
  const compiled = ajv.compile(schema)
  return {
    '~standard': {
      version: 1 as const,
      vendor: 'plaited-ajv',
      validate: (value: unknown) => {
        if (compiled(value)) return { value }
        return {
          issues: (compiled.errors ?? []).map((e) => ({
            message: `${e.instancePath || '/'} ${e.message ?? ''}`.trim(),
            path: e.instancePath?.split('/').filter(Boolean) ?? [],
          })),
        }
      },
      jsonSchema: {
        input: () => schema,
        output: () => schema,
      },
      types: undefined,
    },
  }
}
