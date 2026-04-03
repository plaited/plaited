#!/usr/bin/env bun

import type { ProgramRunnerRunInput, ProgramRunnerStatusInput } from '../src/improve/program-runner.types.ts'
import {
  loadFactoryProgramRun,
  ProgramRunnerRunInputSchema,
  ProgramRunnerStatusInputSchema,
  runFactoryProgram,
} from '../src/improve.ts'
import { parseCliRequest } from '../src/utils.ts'

const printUsage = () => {
  console.error(`Usage: bun scripts/factory-program-runner.ts <run|status> '<json>'
       echo '<json>' | bun scripts/factory-program-runner.ts <run|status>

Commands:
  run     create worktree-backed attempts and optionally execute commands
  status  load a prior run.json and print its current state`)
}

const runCommand = async (args: string[]) => {
  const { input } = await parseCliRequest(args, ProgramRunnerRunInputSchema, {
    name: 'factory-program-runner run',
  })
  const result = await runFactoryProgram(input as ProgramRunnerRunInput)
  console.log(JSON.stringify(result, null, 2))
}

const statusCommand = async (args: string[]) => {
  const { input } = await parseCliRequest(args, ProgramRunnerStatusInputSchema, {
    name: 'factory-program-runner status',
  })
  const result = await loadFactoryProgramRun(input as ProgramRunnerStatusInput)
  console.log(JSON.stringify(result, null, 2))
}

const main = async () => {
  const command = Bun.argv[2]
  const args = Bun.argv.slice(3)

  if (!command || command === '--help' || command === '-h') {
    printUsage()
    process.exit(command ? 0 : 1)
  }

  if (command === 'run') {
    await runCommand(args)
    return
  }

  if (command === 'status') {
    await statusCommand(args)
    return
  }

  console.error(`Unknown command: ${command}`)
  printUsage()
  process.exit(1)
}

await main()
