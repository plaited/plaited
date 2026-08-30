import * as z from 'zod'
import { JsonSchemaObjectSchema } from '../main/behavioral.schemas.ts'
import type { AddHandler, Trigger } from '../main/behavioral.types.ts'

/**
 * Descriptor for a registered tool, returned frozen by {@link useTool}.
 *
 * The descriptor is used as a registry entry at dispatch time: the `respond`
 * handler looks up by `name`, validates arguments against `inputSchema`, and
 * dispatches only when validation passes.
 *
 * @property name - The event type matching the tool's function_call name.
 * @property inputSchema - Pure arguments schema (no `call_id`). Validates
 *   parsed JSON arguments at dispatch time and handler time.
 * @property outputSchema - Pure result schema (no `call_id`). Validates the
 *   tool's return value before it is serialized into the result events.
 * @property jsonSchema - JSON Schema derived from `inputSchema` via
 *   `z.toJSONSchema()`. Shape-validated against `JsonSchemaObjectSchema` at
 *   registration time.
 * @property description - Optional human-readable description for model
 *   tool definitions.
 */
export type ToolDescriptor = {
  readonly name: string
  readonly inputSchema: z.ZodType
  readonly outputSchema: z.ZodType
  readonly jsonSchema: Record<string, unknown>
  readonly description?: string
}

/**
 * Create and register a tool in the behavioral program.
 *
 * The factory:
 * 1. Validates the tool name (non-empty, no `_result` suffix, no `tool.result`
 *    collision).
 * 2. Derives JSON Schema from `inputSchema` via `z.toJSONSchema()`.
 * 3. Shape-validates both derived schemas with {@link JsonSchemaObjectSchema}.
 * 4. **Purity check**: rejects registration when either derived schema has a
 *    top-level `properties.call_id` or `call_id` in `required`. `call_id` is
 *    the loop's envelope, stamped at dispatch — tools never see it.
 * 5. Registers a handler on event type `name`: parses `detail.arguments`
 *    (a parsed object per dispatch contract) with `inputSchema`, awaits `run`,
 *    validates the result with `outputSchema`, then triggers **both**
 *    `${name}_result` (trace visibility) and `tool.result` (items-store
 *    integration + turn continuation).
 * 6. Returns a frozen {@link ToolDescriptor} for the dispatch-time registry.
 *
 * @param hooks.addHandler - Partially-applied handler registration (root scope).
 * @param hooks.trigger - Partially-applied event trigger (root scope).
 * @param args.name - The event type / tool name (matches `function_call.name`).
 * @param args.inputSchema - Zod schema for tool arguments (pure — no `call_id`).
 * @param args.outputSchema - Zod schema for tool result (pure — no `call_id`).
 * @param args.run - Async function receiving validated input, returning output.
 * @param args.description - Optional description for model tool definitions.
 * @returns A frozen {@link ToolDescriptor}.
 */
export const useTool = <I extends z.ZodType, O extends z.ZodType>(
  hooks: { addHandler: AddHandler; trigger: Trigger },
  args: {
    name: string
    inputSchema: I
    outputSchema: O
    run: (input: z.output<I>) => Promise<z.output<O>>
    description?: string
  },
): ToolDescriptor => {
  // ----------------------------------------------------------------
  // Name validation
  // ----------------------------------------------------------------
  if (!args.name || args.name.trim().length === 0) {
    throw new Error('tool name must be a non-empty string')
  }
  if (args.name.endsWith('_result')) {
    throw new Error(`tool name "${args.name}" must not end with "_result"`)
  }
  if (args.name === 'tool.result') {
    throw new Error(`tool name "${args.name}" conflicts with reserved event type "tool.result"`)
  }

  const { addHandler, trigger } = hooks

  // ----------------------------------------------------------------
  // JSON Schema derivation and shape validation
  // ----------------------------------------------------------------
  const jsonSchema = z.toJSONSchema(args.inputSchema) as Record<string, unknown>
  const outputJsonSchema = z.toJSONSchema(args.outputSchema) as Record<string, unknown>

  JsonSchemaObjectSchema.parse(jsonSchema)
  JsonSchemaObjectSchema.parse(outputJsonSchema)

  // ----------------------------------------------------------------
  // Purity check — structural, no Ajv
  //
  // Reject registration when either derived schema has a top-level
  // `properties.call_id` or `call_id` in `required`. `call_id` is the
  // loop's envelope, stamped at dispatch — tools never see it.
  // ----------------------------------------------------------------
  const inputProps = jsonSchema.properties as Record<string, unknown> | undefined
  const outputProps = outputJsonSchema.properties as Record<string, unknown> | undefined
  const inputRequired = (jsonSchema.required ?? []) as string[]
  const outputRequired = (outputJsonSchema.required ?? []) as string[]

  if ((inputProps && 'call_id' in inputProps) || (outputProps && 'call_id' in outputProps)) {
    throw new Error(
      `tool "${args.name}" schema must not contain top-level "call_id"` +
        " — call_id is the loop's envelope, stamped at dispatch",
    )
  }
  if (inputRequired.includes('call_id') || outputRequired.includes('call_id')) {
    throw new Error(
      `tool "${args.name}" schema must not require "call_id"` +
        " — call_id is the loop's envelope, stamped at dispatch",
    )
  }

  // ----------------------------------------------------------------
  // Handler registration
  //
  // The handler receives `detail.arguments` as a parsed object (not a
  // JSON string — the dispatch-time validation in `registerAgentThreads`
  // parses and validates before triggering the tool event). Parsed args
  // are passed directly to `inputSchema.parse()`.
  // ----------------------------------------------------------------
  addHandler(args.name, async ({ detail }) => {
    const { call_id, arguments: rawArgs } = (detail ?? {}) as {
      call_id: string
      arguments: unknown
    }
    const parsed = args.inputSchema.parse(rawArgs) as z.output<I>
    const result = await args.run(parsed)
    const validatedResult = args.outputSchema.parse(result) as z.output<O>
    const output = JSON.stringify(validatedResult)

    // Trace visibility — spec-named result carries call_id for correlation
    trigger({ type: `${args.name}_result`, detail: { call_id, output } })
    // Items-store integration + turn continuation — the Phase 1 bridge
    trigger({ type: 'tool.result', detail: { call_id, output } })
  })

  return Object.freeze({
    name: args.name,
    inputSchema: args.inputSchema,
    outputSchema: args.outputSchema,
    jsonSchema,
    description: args.description,
  })
}
