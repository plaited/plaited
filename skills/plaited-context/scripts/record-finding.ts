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
  finding: FindingInputSchema.describe('Finding payload to insert into the context database.'),
}).describe('Input contract for recording a finding with optional evidence.')

export const RecordFindingOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates finding insertion completed successfully.'),
    dbPath: z.string().min(1).describe('Resolved writable SQLite DB path.'),
    findingId: z.number().int().positive().describe('Inserted finding row id.'),
    evidenceCount: z.number().int().nonnegative().describe('Number of evidence rows inserted.'),
  })
  .describe('Output contract for recording a finding.')

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
    `  bun skills/plaited-context/scripts/record-finding.ts '{"finding":{"kind":"anti-pattern","status":"candidate","summary":"Avoid local ZodError recovery","evidence":[{"path":"src/worker/worker.ts","line":100,"symbol":"startWorker"}]}}'`,
    `  bun skills/plaited-context/scripts/record-finding.ts --schema input`,
  ].join('\n'),
  run: recordFindingEntry,
})

if (import.meta.main) {
  await recordFindingCli(Bun.argv.slice(2))
}
