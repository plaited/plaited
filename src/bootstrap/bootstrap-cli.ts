import { makeCli } from '../cli.ts'
import { BootstrapInputSchema, BootstrapOutputSchema } from './bootstrap.schemas.ts'
import { bootstrapAgent } from './bootstrap.ts'

/**
 * CLI entrypoint for writing a bootstrapped Plaited agent layout to disk.
 *
 * @public
 */
export const bootstrapCli = makeCli({
  name: 'bootstrap',
  inputSchema: BootstrapInputSchema,
  outputSchema: BootstrapOutputSchema,
  help: [
    'Bootstrap a local-first Plaited agent deployment layout.',
    '',
    'This command writes a `.plaited/` runtime scaffold for the target directory,',
    'including deployment config, memory roots, and model endpoint metadata.',
  ].join('\n'),
  run: async (input) => bootstrapAgent(input),
})
