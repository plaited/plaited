import * as z from 'zod'
import { parseCliRequest } from '../../../src/cli.ts'
import {
  type ModulePatternCheckOutput,
  ModulePatternCheckOutputSchema,
  checkModulePatterns as runModulePatternCheck,
} from '../../plaited-context/scripts/module-patterns.ts'

export { ModulePatternCheckOutputSchema } from '../../plaited-context/scripts/module-patterns.ts'

export const ModulePatternCheckInputSchema = z
  .object({
    files: z.array(z.string().min(1)).min(1).describe('Module actor files to check with deterministic pattern rules.'),
  })
  .describe('Compatibility input contract for deterministic MSS/module pattern checking.')

export type ModulePatternCheckInput = z.infer<typeof ModulePatternCheckInputSchema>

export const checkModulePatterns = async (input: ModulePatternCheckInput): Promise<ModulePatternCheckOutput> => {
  return runModulePatternCheck({
    files: input.files,
    record: false,
  })
}

const renderHumanOutput = ({ output }: { output: ModulePatternCheckOutput }) => {
  if (output.findings.length === 0) {
    return 'No module pattern findings.'
  }

  const lines = output.findings.map((finding, index) => {
    return (
      `${index + 1}. [${finding.severity}] ${finding.ruleId} ${finding.file}:${finding.line}:${finding.column}\n` +
      `   ${finding.message}\n` +
      `   Why: ${finding.why}\n` +
      `   Fix: ${finding.fix}`
    )
  })

  return lines.join('\n')
}

export const checkModulePatternsCli = async (args: string[]) => {
  try {
    const { input, flags } = await parseCliRequest(args, ModulePatternCheckInputSchema, {
      name: 'skills/mss-module-review/scripts/check-module-patterns.ts',
      outputSchema: ModulePatternCheckOutputSchema,
      help:
        `Examples:\n  bun skills/mss-module-review/scripts/check-module-patterns.ts ` +
        `'{"files":["src/modules/ui-websocket-runtime-actor.ts"]}'\n` +
        `  bun skills/mss-module-review/scripts/check-module-patterns.ts ` +
        `'{"files":["src/modules/ui-websocket-runtime-actor.ts"]}' --human`,
    })

    const output = await checkModulePatterns(input)

    if (flags.human) {
      console.log(renderHumanOutput({ output }))
    } else {
      console.log(JSON.stringify(output, null, 2))
    }

    process.exit(output.ok ? 0 : 1)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
}

if (import.meta.main) {
  await checkModulePatternsCli(Bun.argv.slice(2))
}
