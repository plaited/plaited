import { writeClient } from './write-client.ts'
import { Write } from './types.ts'
import { walk } from '../deps.ts'
import { writeTestRunner } from './write-test-runner.ts'
export const write: Write = async ({
  assets,
  exts,
  dev,
  importMap,
  workspace,
}) => {
  const { island, story, worker } = exts
  const workerExts = worker && Array.isArray(worker)
    ? worker
    : worker
    ? [worker]
    : []
  const islandExts = Array.isArray(island) ? island : [island]
  const storyExts = Array.isArray(story) ? story : [story]
  const combinedExts = [...islandExts, ...storyExts, ...workerExts]

  /** get paths and name for each island */
  const entryPoints: string[] = []
  for await (
    const entry of walk(workspace, {
      exts: combinedExts,
    })
  ) {
    const { path } = entry
    entryPoints.push(path)
  }

  const storyModules = entryPoints.filter((entry) =>
    storyExts.some((ext) => entry.endsWith(ext))
  )
  /** write client side code*/
  const clientEntries = await writeClient({
    dev,
    entryPoints,
    assets,
    importMap,
    workerExts,
  })

  const runnerEntry = await writeTestRunner({
    assets,
  })

  return { clientEntries, runnerEntry, storyModules }
}
