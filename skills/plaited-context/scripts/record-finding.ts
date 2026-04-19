import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import {
  closeContextDatabase,
  FindingInputSchema,
  OperationalContextOverrideSchema,
  openContextDatabase,
  recordFinding,
  resolveOperationalContext,
} from './plaited-context.ts'

export const RecordFindingInputSchema = OperationalContextOverrideSchema.extend({
  finding: FindingInputSchema,
})

export const RecordFindingOutputSchema = z.object({
  ok: z.literal(true),
  dbPath: z.string().min(1),
  findingId: z.number().int().positive(),
  evidenceCount: z.number().int().nonnegative(),
})

export type RecordFindingInput = z.infer<typeof RecordFindingInputSchema>
export type RecordFindingOutput = z.infer<typeof RecordFindingOutputSchema>

export const recordFindingEntry = async (input: RecordFindingInput): Promise<RecordFindingOutput> => {
  const context = await resolveOperationalContext(input)
  const db = await openContextDatabase({ dbPath: context.dbPath })

  try {
    const result = recordFinding({
      db,
      finding: input.finding,
    })

    return {
      ok: true,
      dbPath: context.dbPath,
      findingId: result.findingId,
      evidenceCount: result.evidenceCount,
    }
  } finally {
    closeContextDatabase(db)
  }
}

export const recordFindingCli = makeCli({
  name: 'skills/plaited-context/scripts/record-finding.ts',
  inputSchema: RecordFindingInputSchema,
  outputSchema: RecordFindingOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/record-finding.ts '{"finding":{"kind":"anti-pattern","status":"candidate","summary":"Avoid local ZodError recovery","evidence":[{"path":"src/modules/example.ts","line":100,"symbol":"server_start"}]}}'`,
    `  bun skills/plaited-context/scripts/record-finding.ts --schema input`,
  ].join('\n'),
  run: recordFindingEntry,
})

if (import.meta.main) {
  await recordFindingCli(Bun.argv.slice(2))
}
