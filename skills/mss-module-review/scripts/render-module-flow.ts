import * as z from 'zod'
import { parseCliRequest } from '../../../src/cli.ts'
import { ModuleFlowGraphSchema, renderModuleFlow as runModuleFlow } from '../../plaited-context/scripts/module-flow.ts'

export const ModuleFlowRenderInputSchema = z
  .object({
    files: z.array(z.string().min(1)).min(1).describe('Module actor files to analyze for review flow evidence.'),
    format: z.enum(['json', 'mermaid']).default('json').describe('Requested review output format.'),
  })
  .describe('Compatibility input contract for MSS/module flow rendering.')

export const ModuleFlowRenderOutputSchema = z
  .discriminatedUnion('format', [
    z
      .object({
        ok: z.literal(true).describe('Indicates flow rendering completed successfully.'),
        format: z.literal('json').describe('Requested output format.'),
        graph: ModuleFlowGraphSchema.describe('Structured flow graph facts.'),
      })
      .describe('JSON graph output contract for MSS compatibility flow rendering.'),
    z
      .object({
        ok: z.literal(true).describe('Indicates flow rendering completed successfully.'),
        format: z.literal('mermaid').describe('Requested output format.'),
        graph: ModuleFlowGraphSchema.describe('Structured flow graph facts.'),
        mermaid: z.string().min(1).describe('Deterministic Mermaid flowchart review artifact.'),
      })
      .describe('Mermaid output contract for MSS compatibility flow rendering.'),
  ])
  .describe('Compatibility output contract for MSS/module flow rendering.')

export type ModuleFlowRenderInput = z.infer<typeof ModuleFlowRenderInputSchema>
export type ModuleFlowRenderOutput = z.infer<typeof ModuleFlowRenderOutputSchema>

export const renderModuleFlow = async (input: ModuleFlowRenderInput): Promise<ModuleFlowRenderOutput> => {
  const output = await runModuleFlow({
    files: input.files,
    format: input.format,
    record: false,
  })

  if (input.format === 'mermaid') {
    return {
      ok: true,
      format: 'mermaid',
      graph: output.graph,
      mermaid: output.mermaid,
    }
  }

  return {
    ok: true,
    format: 'json',
    graph: output.graph,
  }
}

export const renderModuleFlowCli = async (args: string[]) => {
  try {
    const { input } = await parseCliRequest(args, ModuleFlowRenderInputSchema, {
      name: 'skills/mss-module-review/scripts/render-module-flow.ts',
      outputSchema: ModuleFlowRenderOutputSchema,
      help:
        `Examples:\n  bun skills/mss-module-review/scripts/render-module-flow.ts ` +
        `'{"files":["src/modules/ui-websocket-runtime-actor.ts"],"format":"json"}'\n` +
        `  bun skills/mss-module-review/scripts/render-module-flow.ts ` +
        `'{"files":["src/modules/ui-websocket-runtime-actor.ts"],"format":"mermaid"}'`,
    })

    const output = await renderModuleFlow(input)
    console.log(JSON.stringify(output, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
}

if (import.meta.main) {
  await renderModuleFlowCli(Bun.argv.slice(2))
}
