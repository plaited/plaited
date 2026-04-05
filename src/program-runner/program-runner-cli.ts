import { parseCliRequest } from '../utils.ts'
import {
  type ProgramRunnerRunInput,
  ProgramRunnerRunInputSchema,
  ProgramRunnerRunSchema,
  type ProgramRunnerStatusInput,
  ProgramRunnerStatusInputSchema,
} from './program-runner.schemas.ts'
import { loadFactoryProgramRun, runFactoryProgram } from './program-runner.ts'

const buildUsage = () =>
  [
    "Usage: plaited program-runner <run|status> '<json>'",
    "       echo '<json>' | plaited program-runner <run|status>",
    '',
    'Commands:',
    '  run     create worktree-backed attempts and optionally execute commands',
    '  status  load a prior run.json and print its current state',
  ].join('\n')

const runProgramCommand = async (args: string[]) => {
  const { input } = await parseCliRequest(args, ProgramRunnerRunInputSchema, {
    name: 'program-runner run',
    outputSchema: ProgramRunnerRunSchema,
  })
  const result = await runFactoryProgram(input as ProgramRunnerRunInput)
  console.log(JSON.stringify(result, null, 2))
}

const statusProgramCommand = async (args: string[]) => {
  const { input } = await parseCliRequest(args, ProgramRunnerStatusInputSchema, {
    name: 'program-runner status',
    outputSchema: ProgramRunnerRunSchema,
  })
  const result = await loadFactoryProgramRun(input as ProgramRunnerStatusInput)
  console.log(JSON.stringify(result, null, 2))
}

export const programRunnerCli = async (args: string[]): Promise<void> => {
  const command = args[0]
  const commandArgs = args.slice(1)

  if (!command || command === '--help' || command === '-h') {
    console.error(buildUsage())
    process.exit(command ? 0 : 1)
  }

  if (command === 'run') {
    await runProgramCommand(commandArgs)
    return
  }

  if (command === 'status') {
    await statusProgramCommand(commandArgs)
    return
  }

  console.error(`Unknown program-runner command: ${command}`)
  console.error(buildUsage())
  process.exit(1)
}
