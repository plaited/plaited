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

const ContextModeSchema = z.enum(['review', 'implement', 'docs', 'general'])

export const ContextInputSchema = OperationalContextOverrideSchema.extend({
  task: z.string().min(1),
  mode: ContextModeSchema.default('review'),
  paths: z.array(z.string().min(1)).default([]),
})

export const ContextOutputSchema = z.object({
  ok: z.literal(true),
  filesToRead: z.array(z.string()),
  skillsToUse: z.array(z.string()),
  commandsToRun: z.array(z.string()),
  knownPatterns: z.array(z.string()),
  knownAntiPatterns: z.array(z.string()),
  sourceOfTruth: z.array(z.string()),
  openQuestions: z.array(z.string()),
})

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
    `  bun skills/plaited-context/scripts/context.ts '{"task":"review module actor diagnostics","mode":"review","paths":["src/modules/example.ts"]}'`,
    `  bun skills/plaited-context/scripts/context.ts --schema output`,
  ].join('\n'),
  run: assembleTaskContext,
})

if (import.meta.main) {
  await contextCli(Bun.argv.slice(2))
}
