/**
 * The turn CLI seam — the Harbor hook. `behavioral turn '<json>'` runs one scripted
 * model turn end-to-end and prints the {@link TurnResult} as JSON.
 *
 * @remarks
 * The `--no-serve` slice only: no daemon, no serve mode, no `--seed` flag, no
 * permission flow (those are Phase 6). One cold run per invocation: create a
 * kernel (scripted model by default — deterministic, no network), run the turn,
 * drain the pool, print the JSON result. Harbor drives this seam later.
 *
 * The output schema is the kernel's {@link TurnResultSchema} — the single
 * JSON-schema home for the TurnResult shape. The CLI does not hand-mirror the
 * type; it imports the schema so a kernel type change and its schema stay in
 * sync.
 *
 * @internal
 */

import type { JSONSchemaType } from 'ajv'
import { TurnResultSchema } from '../kernel/kernel.schemas.ts'
import { createKernel, type TurnResult } from '../kernel/kernel.ts'
import { makeCli } from './cli.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TurnCliInput = {
  space: string
  prompt: string
}

// ---------------------------------------------------------------------------
// JSON Schemas (AJV — matching useTool's convention)
// ---------------------------------------------------------------------------

const TurnCliInputSchema = {
  type: 'object',
  properties: {
    space: { type: 'string', minLength: 1, description: 'space/scope label for the turn' },
    prompt: {
      type: 'string',
      minLength: 1,
      description: 'the user prompt to run the turn against',
    },
  },
  required: ['space', 'prompt'],
  additionalProperties: false,
  description: 'Turn CLI input — run one scripted model turn from a prompt to a JSON result',
} as unknown as JSONSchemaType<TurnCliInput>

export const turnCli = makeCli({
  name: 'turn',
  inputSchema: TurnCliInputSchema,
  // The output schema is the kernel's TurnResultSchema — the single schema
  // home for the TurnResult shape. No hand-mirrored copy here.
  outputSchema: TurnResultSchema.schema as unknown as JSONSchemaType<TurnResult>,
  help: [
    'Run one scripted model turn end-to-end and print the JSON result.',
    '',
    'The Harbor seam — the --no-serve slice only (no daemon, no --seed, no permission flow).',
    'Deterministic against the kernel default scripted model (no network).',
    '',
    'Examples:',
    '  behavioral turn \'{"space":"s","prompt":"Hello"}\'',
    '  echo \'{"space":"s","prompt":"Hello"}\' | behavioral turn',
  ].join('\n'),
  run: async (input) => {
    const kernel = createKernel()
    try {
      return await kernel.runTurn({ space: input.space, prompt: input.prompt })
    } finally {
      await kernel.shutdown()
    }
  },
})
