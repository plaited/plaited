import { type JsonObject, type JsonSchemaObject, JsonSchemaObjectSchema } from '../main/behavioral.schemas.ts'
import type { AddHandler, AddThread, Trigger } from '../main/behavioral.types.ts'
import { compileValidator } from '../main/behavioral.utils.ts'
import type { ToolArgs } from './pack.types.ts'

/**
 * Descriptor for a registered tool, returned frozen by {@link defineTool}.
 *
 * Used as a registry entry at dispatch time: the `respond` handler in
 * `threads.ts` looks up by `name`, validates arguments against `inputSchema`,
 * and dispatches only when validation passes.
 */
export type ToolDescriptor = {
  name: string
  inputSchema: JsonSchemaObject
  outputSchema: JsonSchemaObject
  description?: string
}
/**
 * The scoped hooks a tool registrar receives. Already partially-applied with
 * the space/topic by the provisioner.
 */
export type ToolHooks = {
  addHandler: AddHandler
  addThread: AddThread
  trigger: Trigger
}

const RESERVED_TOOL_NAMES = new Set(['', 'tool.result'])
const isReservedSuffix = (name: string) => name.endsWith('_result')

/**
 * Create and register a tool in the behavioral program.
 *
 * Takes a pure {@link ToolArgs} data object (no engine imports, no hooks —
 * testable standalone) and returns a registrar that, given the program's bound
 * hooks, wires the tool's handler and returns a frozen
 * {@link ToolDescriptor} for the dispatch-time registry.
 *
 * The factory:
 * 1. Validates `name` (non-empty, no `_result` suffix, no `tool.result`
 *    collision).
 * 2. Shape-validates `inputSchema` and `outputSchema` with
 *    {@link JsonSchemaObjectSchema} (the engine's single source of truth for
 *    "is this a JSON Schema document?").
 * 3. Compiles `outputSchema` via Ajv to validate the tool's return value.
 * 4. Registers a handler on event type `name`: reads `{ call_id, arguments,
 *    item_id }` from the event detail (a private harness contract, not a
 *    spec item shape), calls `run(arguments)`, validates the output against
 *    `outputSchema`, and triggers `tool.result` with
 *    `{ call_id, output, isError?, item_id }`. `threads.ts` owns building the
 *    spec-valid `function_call_output` item (id + status) from that.
 *
 * **No guard thread.** Dispatch-time validation in `threads.ts` is the sole
 * schema gate — a block-idiom guard thread here could never fire because the
 * dispatcher only triggers the tool event with already-validated arguments.
 * Semantic block-idiom guards (policy) are Phase 5, designed with the
 * `call_id` correlation problem solved.
 *
 * @param args - The tool definition (pure data + `run`).
 * @returns A partially-applied registrar: pass the program's bound hooks to
 *   register the handler and receive a frozen {@link ToolDescriptor}.
 */
export const defineTool = (args: ToolArgs) => {
  if (RESERVED_TOOL_NAMES.has(args.name) || isReservedSuffix(args.name)) {
    throw new Error(`tool name "${args.name}" is reserved (empty, "tool.result", or *_result suffix)`)
  }
  const inputIssues = JsonSchemaObjectSchema.safeParse(args.inputSchema)
  if (inputIssues.error) {
    throw new Error(
      `tool "${args.name}": inputSchema is not a valid JSON Schema document — ${inputIssues.error.message}`,
    )
  }
  const outputIssues = JsonSchemaObjectSchema.safeParse(args.outputSchema)
  if (outputIssues.error) {
    throw new Error(
      `tool "${args.name}": outputSchema is not a valid JSON Schema document — ${outputIssues.error.message}`,
    )
  }
  const outputValidator = compileValidator(args.outputSchema)

  return ({ addHandler, trigger }: ToolHooks): ToolDescriptor => {
    addHandler(args.name, async ({ detail }) => {
      const {
        call_id,
        arguments: rawArgs,
        item_id,
      } = (detail ?? {}) as {
        call_id: string
        arguments: JsonObject
        item_id?: string
      }
      const { output } = await args.run(rawArgs)

      if (!outputValidator(output)) {
        // Tool returned output violating its own declared schema — a tool bug,
        // surfaced as a handler error (feedback_error trace), not model data.
        throw new Error(`tool "${args.name}" output failed its declared outputSchema`)
      }
      const outputString = JSON.stringify(output)

      // Items-store integration + turn continuation — the Phase 1 bridge.
      // threads.ts builds the spec-valid function_call_output (id + status)
      // from this detail; defineTool stays free of spec-item shape.
      trigger({
        type: 'tool.result',
        detail: { call_id, output: outputString, ...(item_id !== undefined && { item_id }) },
      })
    })

    return Object.freeze({
      name: args.name,
      inputSchema: args.inputSchema,
      outputSchema: args.outputSchema,
      ...(args.description !== undefined && { description: args.description }),
    })
  }
}
