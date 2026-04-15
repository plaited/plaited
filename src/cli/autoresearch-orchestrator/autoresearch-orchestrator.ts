import { join, resolve } from 'node:path'
import type { AutoresearchInitInput } from '../autoresearch/autoresearch.schemas.ts'
import type { AutoresearchLaneState } from '../autoresearch/autoresearch.types.ts'
import { getWorkspaceRoot } from '../program-runner/program-runner.ts'
import type { AutoresearchOrchestratorInput } from './autoresearch-orchestrator.schemas.ts'

const timestamp = (): string => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')

const toJson = (value: unknown): string => JSON.stringify(value, null, 2)

const substituteAdapterCommand = ({
  command,
  laneDir,
  laneId,
  programPath,
  worktreePath,
}: {
  command: string[]
  laneDir: string
  laneId: string
  programPath: string
  worktreePath: string
}): string[] =>
  command.map((segment) =>
    segment
      .replaceAll('{{lane_dir}}', laneDir)
      .replaceAll('{{lane_id}}', laneId)
      .replaceAll('{{program}}', programPath)
      .replaceAll('{{worktree}}', worktreePath),
  )

const runCommand = async ({
  args,
  cwd,
}: {
  args: string[]
  cwd: string
}): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  const proc = Bun.spawn(args, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return {
    exitCode,
    stdout,
    stderr,
  }
}

const ensureWorktree = async ({
  baseRef,
  path,
  workspaceRoot,
}: {
  baseRef: string
  path: string
  workspaceRoot: string
}) => {
  const result = await runCommand({
    args: ['git', 'worktree', 'add', '--detach', path, baseRef],
    cwd: workspaceRoot,
  })

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `Failed to create worktree at ${path}`)
  }
}

const runWithConcurrencyLimit = async <TItem, TResult>({
  items,
  limit,
  worker,
}: {
  items: TItem[]
  limit: number
  worker: (item: TItem, index: number) => Promise<TResult>
}): Promise<TResult[]> => {
  const results = new Array<TResult>(items.length)
  let nextIndex = 0

  const runWorker = async () => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= items.length) {
        return
      }

      const item = items[currentIndex]
      if (item === undefined) {
        return
      }

      results[currentIndex] = await worker(item, currentIndex)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => runWorker()))
  return results
}

/** @public */
export const buildAutoresearchOrchestratorRunId = (): string => `autoresearch-orchestrator-${timestamp()}`

/**
 * Runs multiple autoresearch lanes in parallel worktrees.
 *
 * @public
 */
export const runAutoresearchOrchestrator = async (input: AutoresearchOrchestratorInput) => {
  const workspaceRoot = await getWorkspaceRoot(process.cwd())
  const runId = buildAutoresearchOrchestratorRunId()
  const rootDir = resolve(input.rootDir ?? join(workspaceRoot, '.worktrees', 'autoresearch-orchestrator', runId))

  await Bun.$`mkdir -p ${rootDir}`.cwd(workspaceRoot).quiet()

  const lanes = await runWithConcurrencyLimit({
    items: input.lanes,
    limit: input.parallel,
    worker: async (lane, index) => {
      const laneId = lane.laneId ?? lane.target.id
      const laneDir = join(rootDir, `${String(index + 1).padStart(2, '0')}-${laneId}`)
      const worktreePath = join(laneDir, 'worktree')
      const outputDir = lane.outputDir ?? join(laneDir, 'lane')

      await Bun.$`mkdir -p ${laneDir}`.cwd(workspaceRoot).quiet()

      try {
        await ensureWorktree({
          baseRef: input.baseRef,
          path: worktreePath,
          workspaceRoot,
        })

        const laneInput: AutoresearchInitInput = {
          ...lane,
          outputDir,
        }

        const result = await runCommand({
          args: ['bun', 'run', './bin/plaited.ts', 'autoresearch', 'init', JSON.stringify(laneInput)],
          cwd: worktreePath,
        })

        await Bun.write(join(laneDir, 'lane.stdout.log'), result.stdout)
        await Bun.write(join(laneDir, 'lane.stderr.log'), result.stderr)

        if (result.exitCode !== 0) {
          return {
            laneId,
            status: 'failed' as const,
            worktreePath,
            laneDir: outputDir,
            exitCode: result.exitCode,
            error: result.stderr.trim() || result.stdout.trim() || `Lane ${laneId} failed`,
          }
        }

        let adapterExitCode: number | undefined
        if (input.adapterCommand && input.adapterCommand.length > 0) {
          const adapterCommand = substituteAdapterCommand({
            command: input.adapterCommand,
            laneDir: outputDir,
            laneId,
            programPath: lane.programPath,
            worktreePath,
          })
          const adapterResult = await runCommand({
            args: adapterCommand,
            cwd: worktreePath,
          })
          adapterExitCode = adapterResult.exitCode
          await Bun.write(join(laneDir, 'adapter.stdout.log'), adapterResult.stdout)
          await Bun.write(join(laneDir, 'adapter.stderr.log'), adapterResult.stderr)

          if (adapterResult.exitCode !== 0) {
            return {
              laneId,
              status: 'failed' as const,
              worktreePath,
              laneDir: outputDir,
              exitCode: result.exitCode,
              adapterExitCode,
              error: adapterResult.stderr.trim() || adapterResult.stdout.trim() || `Adapter failed for lane ${laneId}`,
            }
          }
        }

        return {
          laneId,
          status: 'succeeded' as const,
          worktreePath,
          laneDir: outputDir,
          exitCode: result.exitCode,
          ...(adapterExitCode !== undefined && { adapterExitCode }),
          result: JSON.parse(result.stdout) as AutoresearchLaneState,
        }
      } catch (error) {
        return {
          laneId,
          status: 'failed' as const,
          worktreePath,
          laneDir: outputDir,
          exitCode: 1,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  })

  const output = {
    runId,
    baseRef: input.baseRef,
    parallel: input.parallel,
    lanes,
  }

  await Bun.write(join(rootDir, 'run.json'), toJson(output))
  return output
}
