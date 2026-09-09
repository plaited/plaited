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
 * @internal
 */

import type { JSONSchemaType } from 'ajv'
import { createKernel } from '../kernel/kernel.ts'
import { makeCli } from './cli.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TurnCliInput = {
  space: string
  prompt: string
}

type Usage = {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

type TurnCliOutput = {
  ok: true
  space: string
  status: 'completed' | 'incomplete' | 'failed'
  items: Record<string, unknown>[]
  iterations: number
  usage?: Usage
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

const UsageSchema = {
  type: 'object',
  properties: {
    input_tokens: { type: 'integer', minimum: 0 },
    output_tokens: { type: 'integer', minimum: 0 },
    total_tokens: { type: 'integer', minimum: 0 },
  },
  required: ['input_tokens', 'output_tokens', 'total_tokens'],
  additionalProperties: false,
  description: 'Token usage from the last model-respond round',
} as unknown as JSONSchemaType<Usage>

const TurnCliOutputSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean', const: true, description: 'the turn executed' },
    space: { type: 'string', description: 'the space the turn ran in' },
    status: {
      type: 'string',
      enum: ['completed', 'incomplete', 'failed'],
      description: 'turn outcome',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
      },
      description: 'full trajectory — user prompt + model outputs + tool-call outputs',
    },
    iterations: {
      type: 'integer',
      minimum: 0,
      description: 'number of model-respond rounds',
    },
    usage: {
      ...UsageSchema,
      nullable: true,
      description: 'token usage from the last round, when reported',
    },
  },
  required: ['ok', 'space', 'status', 'items', 'iterations'],
  additionalProperties: false,
  description: 'Turn CLI output — the turn result, deterministic against the scripted model',
} as unknown as JSONSchemaType<TurnCliOutput>

export const turnCli = makeCli({
  name: 'turn',
  inputSchema: TurnCliInputSchema,
  outputSchema: TurnCliOutputSchema,
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
