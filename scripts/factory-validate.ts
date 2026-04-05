#!/usr/bin/env bun

import { basename, dirname } from 'node:path'

type ValidationArgs = {
  programPath: string
}

type ValidationPlan = {
  reason: string
  commands: string[][]
}

const parseArgs = (argv: string[]): ValidationArgs => {
  let programPath: string | undefined

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--program') {
      programPath = argv[index + 1]
      index += 1
    }
  }

  if (!programPath) {
    throw new Error('Usage: bun scripts/factory-validate.ts --program <path>')
  }

  return {
    programPath,
  }
}

const runCommand = async (args: string[]): Promise<number> => {
  const proc = Bun.spawn(args, {
    cwd: process.cwd(),
    stdout: 'inherit',
    stderr: 'inherit',
  })
  return await proc.exited
}

const createValidationPlan = (programPath: string): ValidationPlan => {
  const lane = basename(dirname(programPath))
  const commands: string[][] = [['bun', '--bun', 'tsc', '--noEmit']]

  const laneTests: Partial<Record<string, string[]>> = {
    'server-factory': [
      'src/factories/server-factory/tests/server-factory.spec.ts',
      'src/factories/server-factory/tests/server.spec.ts',
    ],
    'agent-bootstrap': ['src/bootstrap/tests/bootstrap.spec.ts'],
    'skill-factories': ['src/factories/skills-factory/tests/skills-factory.utils.spec.ts'],
    'mcp-factories': ['src/factories/mcp-factory/tests/mcp.manifest.spec.ts'],
    'a2a-factories': [
      'src/factories/a2a-factory/tests/a2a.schemas.spec.ts',
      'src/factories/a2a-factory/tests/a2a.utils.spec.ts',
      'src/factories/a2a-factory/tests/peers.spec.ts',
    ],
    'autoresearch-factories': ['src/cli/autoresearch/tests/autoresearch.spec.ts'],
    'fanout-factories': ['src/cli/program-runner/tests/program-runner.spec.ts'],
    'verification-factories': ['src/cli/eval/tests/eval.spec.ts'],
    'default-factories': [
      'src/agent/tests/create-agent.spec.ts',
      'src/bootstrap/tests/bootstrap.spec.ts',
      'src/cli/program-runner/tests/program-runner.spec.ts',
    ],
  }

  const testFiles = laneTests[lane]
  if (testFiles && testFiles.length > 0) {
    commands.push(['bun', 'test', ...testFiles])
    return {
      reason: `targeted tests mapped for lane '${lane}'`,
      commands,
    }
  }

  return {
    reason: `no explicit targeted tests mapped for lane '${lane}'; using typecheck-only minimum gate`,
    commands,
  }
}

export { createValidationPlan }

const main = async () => {
  const { programPath } = parseArgs(Bun.argv)
  const plan = createValidationPlan(programPath)
  console.log(`[factory-validate] program=${programPath} reason=${plan.reason}`)

  for (const command of plan.commands) {
    console.log(`[factory-validate] program=${programPath} command=${command.join(' ')}`)
    const exitCode = await runCommand(command)
    if (exitCode !== 0) {
      console.error(`[factory-validate] command failed with exit code ${exitCode}`)
      process.exit(exitCode)
    }
  }

  console.log(`[factory-validate] validation passed for ${programPath}`)
}

if (import.meta.main) {
  await main()
}
