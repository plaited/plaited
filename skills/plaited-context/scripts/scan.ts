import { resolve } from 'node:path'
import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import {
  closeContextDatabase,
  indexWorkspace,
  OperationalContextOverrideSchema,
  openContextDatabase,
  resolveOperationalContext,
} from './plaited-context.ts'

export const ScanInputSchema = OperationalContextOverrideSchema.extend({
  rootDir: z.string().min(1).default('.').describe('Root directory to scan and index.'),
  include: z
    .array(z.string().min(1))
    .default(['AGENTS.md', 'src', 'skills', 'docs'])
    .describe('Relative include paths under rootDir to index.'),
  force: z.boolean().default(false).describe('When true, clears prior index state before indexing.'),
}).describe('Input contract for scanning and indexing workspace context.')

export const ScanOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates scan completed successfully.'),
    dbPath: z.string().min(1).describe('Resolved writable SQLite DB path.'),
    filesIndexed: z.number().int().nonnegative().describe('Count of indexed files.'),
    symbolsIndexed: z.number().int().nonnegative().describe('Count of indexed symbols.'),
    skillsIndexed: z.number().int().nonnegative().describe('Count of indexed skills.'),
    wikiIndexed: z.number().int().nonnegative().describe('Count of indexed wiki/reference documents.'),
  })
  .describe('Output summary for a scan/index run.')

export type ScanInput = z.infer<typeof ScanInputSchema>
export type ScanOutput = z.infer<typeof ScanOutputSchema>

export const scanWorkspace = async (input: ScanInput): Promise<ScanOutput> => {
  const context = await resolveOperationalContext(input)
  const rootDir = resolve(context.cwd, input.rootDir)
  const db = await openContextDatabase({ dbPath: context.dbPath })

  try {
    const result = await indexWorkspace({
      db,
      rootDir,
      include: input.include,
      force: input.force,
    })

    return {
      ok: true,
      dbPath: context.dbPath,
      filesIndexed: result.filesIndexed,
      symbolsIndexed: result.symbolsIndexed,
      skillsIndexed: result.skillsIndexed,
      wikiIndexed: result.wikiIndexed,
    }
  } finally {
    closeContextDatabase(db)
  }
}

export const scanCli = makeCli({
  name: 'skills/plaited-context/scripts/scan.ts',
  inputSchema: ScanInputSchema,
  outputSchema: ScanOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/scan.ts '{"rootDir":".","include":["AGENTS.md","src","skills","docs"],"force":true}'`,
    `  bun skills/plaited-context/scripts/scan.ts --schema output`,
  ].join('\n'),
  run: scanWorkspace,
})

if (import.meta.main) {
  await scanCli(Bun.argv.slice(2))
}
