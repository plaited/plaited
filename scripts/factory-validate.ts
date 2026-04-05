#!/usr/bin/env bun

import { basename, dirname } from 'node:path'

type ValidationArgs = {
  changedPathsFile?: string
  programPath: string
}

type ValidationPlan = {
  inferredTestFiles: string[]
  reason: string
  commands: string[][]
}

const parseArgs = (argv: string[]): ValidationArgs => {
  let changedPathsFile: string | undefined
  let programPath: string | undefined

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--changed-paths-file') {
      changedPathsFile = argv[index + 1]
      index += 1
      continue
    }
    if (arg === '--program') {
      programPath = argv[index + 1]
      index += 1
    }
  }

  if (!programPath) {
    throw new Error('Usage: bun scripts/factory-validate.ts --program <path>')
  }

  return {
    changedPathsFile,
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

const listSpecsUnderDirectory = async (directory: string): Promise<string[]> => {
  const exists = await Bun.$`test -d ${directory}`.quiet().nothrow()
  if (exists.exitCode !== 0) {
    return []
  }

  const files: string[] = []
  const glob = new Bun.Glob('**/*.spec.ts')
  for await (const path of glob.scan({ cwd: directory, onlyFiles: true })) {
    files.push(`${directory}/${path}`.replaceAll('\\', '/'))
  }
  return files.sort()
}

const readChangedPaths = async (changedPathsFile?: string): Promise<string[]> => {
  if (!changedPathsFile) {
    return []
  }

  const file = Bun.file(changedPathsFile)
  if (!(await file.exists())) {
    return []
  }

  const value = await file.json()
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

const getInferredFactoryTestFiles = async (changedPaths: string[]): Promise<string[]> => {
  const candidates = new Set<string>()

  for (const changedPath of changedPaths) {
    const match = changedPath.match(/^src\/factories\/([^/]+)\//)
    if (!match) {
      continue
    }
    candidates.add(`src/factories/${match[1]}/tests`)
  }

  const discovered = await Promise.all(Array.from(candidates, (directory) => listSpecsUnderDirectory(directory)))
  return Array.from(new Set(discovered.flat())).sort()
}

const createValidationPlan = async ({
  changedPaths,
  programPath,
}: {
  changedPaths: string[]
  programPath: string
}): Promise<ValidationPlan> => {
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

  const inferredTestFiles = await getInferredFactoryTestFiles(changedPaths)
  const testFiles = Array.from(new Set([...(laneTests[lane] ?? []), ...inferredTestFiles]))
  if (testFiles.length > 0) {
    commands.push(['bun', 'test', ...testFiles])
    return {
      inferredTestFiles,
      reason:
        inferredTestFiles.length > 0
          ? `targeted tests mapped and inferred for lane '${lane}'`
          : `targeted tests mapped for lane '${lane}'`,
      commands,
    }
  }

  return {
    inferredTestFiles: [],
    reason: `no targeted tests inferred for lane '${lane}'; using typecheck-only minimum gate`,
    commands,
  }
}

export { createValidationPlan }

const main = async () => {
  const { changedPathsFile, programPath } = parseArgs(Bun.argv)
  const changedPaths = await readChangedPaths(changedPathsFile)
  const plan = await createValidationPlan({
    changedPaths,
    programPath,
  })
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
