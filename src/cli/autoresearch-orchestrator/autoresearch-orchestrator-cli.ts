import { parseCli } from '../utils/cli.ts'
import {
  AutoresearchOrchestratorInputSchema,
  AutoresearchOrchestratorOutputSchema,
} from './autoresearch-orchestrator.schemas.ts'
import { runAutoresearchOrchestrator } from './autoresearch-orchestrator.ts'

/**
 * CLI handler for the autoresearch-orchestrator command.
 *
 * @public
 */
export const autoresearchOrchestratorCli = async (args: string[]): Promise<void> => {
  const input = await parseCli(args, AutoresearchOrchestratorInputSchema, {
    name: 'autoresearch-orchestrator',
    outputSchema: AutoresearchOrchestratorOutputSchema,
  })

  const result = await runAutoresearchOrchestrator(input)
  console.log(JSON.stringify(result, null, 2))
}
