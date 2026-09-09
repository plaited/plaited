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

import * as z from 'zod'
import { createKernel } from '../kernel/kernel.ts'
import { makeCli } from './cli.ts'

const TurnCliInputSchema = z
  .object({
    space: z.string().min(1).describe('space/scope label for the turn'),
    prompt: z.string().min(1).describe('the user prompt to run the turn against'),
  })
  .strict()
  .describe('Turn CLI input — run one scripted model turn from a prompt to a JSON result')

const UsageSchema = z
  .object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
  })
  .describe('Token usage from the last model-respond round')

const TurnCliOutputSchema = z
  .object({
    ok: z.literal(true).describe('the turn executed'),
    space: z.string().describe('the space the turn ran in'),
    status: z.enum(['completed', 'incomplete', 'failed']).describe('turn outcome'),
    items: z
      .array(z.record(z.string(), z.unknown()))
      .describe('full trajectory — user prompt + model outputs + tool-call outputs'),
    iterations: z.number().int().nonnegative().describe('number of model-respond rounds'),
    usage: UsageSchema.optional().describe('token usage from the last round, when reported'),
  })
  .describe('Turn CLI output — the turn result, deterministic against the scripted model')

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
