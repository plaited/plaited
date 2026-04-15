import { join, resolve } from 'node:path'
import type { AutoresearchLaneState, AutoresearchTargetRef } from './autoresearch.types.ts'

const timestamp = (): string => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')

/** @public */
export const buildAutoresearchRunId = (target: AutoresearchTargetRef): string =>
  `${target.kind}-${target.id}-${timestamp()}`

/** @public */
export const resolveAutoresearchLaneDir = ({ outputDir, runId }: { outputDir?: string; runId: string }): string =>
  resolve(outputDir ?? join(process.cwd(), '.plaited', 'autoresearch', 'lanes', runId))

/** @public */
export const createInitialLaneState = ({
  laneDir,
  programPath,
  runId,
  target,
}: {
  laneDir: string
  programPath: string
  runId: string
  target: AutoresearchTargetRef
}): AutoresearchLaneState => ({
  runId,
  laneDir,
  programPath,
  target,
  initializedAt: new Date().toISOString(),
  experiments: [],
})

/** @public */
export const buildAutoresearchHelp = (): string =>
  [
    'Commands:',
    '  init      create lane state and capture a baseline writable-root snapshot',
    '  evaluate  evaluate the current workspace state for an existing lane',
    '  accept    promote the current workspace state as the lane baseline',
    '  revert    restore the lane baseline into the current workspace',
    '  status    print the current lane state',
  ].join('\n')
