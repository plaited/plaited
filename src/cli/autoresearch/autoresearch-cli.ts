import { loadAdapter, loadGrader, loadPrompts, readStdinPrompts } from '../eval/eval.utils.ts'
import { parseCli } from '../utils/cli.ts'
import { AutoresearchInputSchema, AutoresearchOutputSchema } from './autoresearch.schemas.ts'
import { runAutoresearch } from './autoresearch.ts'

/**
 * CLI handler for the autoresearch command.
 *
 * @public
 */
export const autoresearchCli = async (args: string[]): Promise<void> => {
  const input = await parseCli(args, AutoresearchInputSchema, {
    name: 'autoresearch',
    outputSchema: AutoresearchOutputSchema,
  })

  const adapter = await loadAdapter(input.adapterPath)
  const grader = input.graderPath ? await loadGrader(input.graderPath) : undefined

  const prompts = input.promptsPath ? await loadPrompts(input.promptsPath) : await readStdinPrompts()
  if (!prompts || prompts.length === 0) {
    console.error('Error: promptsPath required or pipe prompts via stdin')
    process.exit(2)
  }

  const result = await runAutoresearch({
    target: input.target,
    adapter,
    prompts,
    grader,
    outputDir: input.outputDir,
    workspaceDir: input.workspaceDir,
    baselineResultsPath: input.baselineResultsPath,
    evidencePaths: input.evidencePaths,
    budget: input.budget,
    promotion: input.promotion,
    progress: input.progress,
  })

  console.log(JSON.stringify(result, null, 2))
}
