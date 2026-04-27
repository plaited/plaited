import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import {
  assembleContext,
  closeContextDatabase,
  OperationalContextOverrideSchema,
  openContextDatabase,
  recordContextRun,
  resolveOperationalContext,
} from './plaited-context.ts'

const ContextModeSchema = z
  .enum(['review', 'implement', 'docs', 'general'])
  .describe('Context assembly mode for review, implementation, or docs work.')

export const ContextInputSchema = OperationalContextOverrideSchema.extend({
  task: z.string().min(1).describe('Task statement to gather context for.'),
  mode: ContextModeSchema.default('review').describe('How context should be assembled for the task.'),
  paths: z.array(z.string().min(1)).default([]).describe('Optional target paths to prioritize in context assembly.'),
}).describe('Input contract for assembling task context from indexed data.')

export const ContextOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates context assembly completed successfully.'),
    filesToRead: z.array(z.string()).describe('Source files to inspect first for this task.'),
    skillsToUse: z.array(z.string()).describe('Skill names likely relevant to the task.'),
    commandsToRun: z.array(z.string()).describe('Suggested targeted commands to gather further evidence.'),
    knownPatterns: z.array(z.string()).describe('Indexed validated patterns relevant to the task.'),
    knownAntiPatterns: z.array(z.string()).describe('Indexed anti-patterns relevant to the task.'),
    sourceOfTruth: z.array(z.string()).describe('Ordered high-authority references for decisions.'),
    authorityOrder: z
      .array(
        z.object({
          rank: z
            .number()
            .int()
            .positive()
            .describe('Authority precedence rank; lower numbers are stronger authority.'),
          authority: z
            .enum(['source', 'agent-instructions', 'skill', 'wiki', 'other'])
            .describe('Authority source category.'),
          label: z.string().min(1).describe('Short label for this authority layer.'),
          description: z.string().min(1).describe('Human-readable summary for this authority layer.'),
        }),
      )
      .describe('Explicit source authority precedence for conflict resolution.'),
    authorityPolicy: z
      .string()
      .min(1)
      .describe('Conflict policy describing why code/AGENTS/skills outrank wiki assertions.'),
    openQuestions: z.array(z.string()).describe('Open questions that need direct source confirmation.'),
  })
  .describe('Output contract for assembled operational task context.')

export type ContextInput = z.infer<typeof ContextInputSchema>
export type ContextOutput = z.infer<typeof ContextOutputSchema>

export const assembleTaskContext = async (input: ContextInput): Promise<ContextOutput> => {
  const { task, mode, paths, ...contextOverrides } = input
  const context = await resolveOperationalContext(contextOverrides)
  const db = await openContextDatabase({ dbPath: context.dbPath })

  try {
    const output = assembleContext({
      db,
      task,
      mode,
      paths,
    })

    recordContextRun({
      db,
      task,
      mode,
      paths,
      result: output,
    })

    return output
  } finally {
    closeContextDatabase(db)
  }
}

export const contextCli = makeCli({
  name: 'skills/plaited-context/scripts/context.ts',
  inputSchema: ContextInputSchema,
  outputSchema: ContextOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/context.ts '{"task":"review runtime boundary diagnostics","mode":"review","paths":["src/worker/worker.ts"]}'`,
    `  bun skills/plaited-context/scripts/context.ts --schema output`,
  ].join('\n'),
  run: assembleTaskContext,
})

if (import.meta.main) {
  await contextCli(Bun.argv.slice(2))
}
