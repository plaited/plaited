import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import {
  closeContextDatabase,
  OperationalContextOverrideSchema,
  openContextDatabase,
  resolveOperationalContext,
} from './plaited-context.ts'

export const InitDbInputSchema = OperationalContextOverrideSchema.extend({
  dbPath: z.string().min(1).optional(),
})

export const InitDbOutputSchema = z.object({
  ok: z.literal(true),
  dbPath: z.string().min(1),
  created: z.boolean(),
})

export type InitDbInput = z.infer<typeof InitDbInputSchema>
export type InitDbOutput = z.infer<typeof InitDbOutputSchema>

export const initDb = async (input: InitDbInput): Promise<InitDbOutput> => {
  const context = await resolveOperationalContext(input)
  const dbFile = Bun.file(context.dbPath)
  const existed = await dbFile.exists()
  const db = await openContextDatabase({ dbPath: context.dbPath })
  closeContextDatabase(db)

  return {
    ok: true,
    dbPath: context.dbPath,
    created: !existed,
  }
}

export const initDbCli = makeCli({
  name: 'skills/plaited-context/scripts/init-db.ts',
  inputSchema: InitDbInputSchema,
  outputSchema: InitDbOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/init-db.ts '{"dbPath":".plaited/context.sqlite"}'`,
    `  bun skills/plaited-context/scripts/init-db.ts --schema input`,
  ].join('\n'),
  run: initDb,
})

if (import.meta.main) {
  await initDbCli(Bun.argv.slice(2))
}
