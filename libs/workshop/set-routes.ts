import { bundler } from '../bundler/mod.ts'
import { mimeTypes, Routes } from '../server/mod.ts'
import { walk } from '../deps.ts'
import { compress } from '../deps.ts'
import { getStorySetData } from './get-story-set-data.ts'
import { setStoryRoutes } from './set-story-routes.ts'
import { testSocketHandler } from './test-socket-handler.ts'
import { exts, testSocketPath } from './constants.ts'

export const setRoutes = async ({
  dev,
  host,
  importMap,
  routes,
  workspace,
}: {
  dev: boolean
  host: string
  importMap?: URL
  routes: Routes
  workspace: string
}) => {
  /** get paths and name for exts */
  const entryPoints: string[] = []
  for await (
    const entry of walk(workspace, {
      exts: Object.values(exts),
    })
  ) {
    const { path } = entry
    entryPoints.push(path)
  }
  /** bundle entry point from workspace */
  const [entries] = await bundler({
    dev,
    entryPoints,
    importMap,
  })

  /** an array to hold paths to stor sets */
  const storyEntries: string[] = []
  /** create js routs for entries and push story paths to storyEntries */
  for (const [path, file] of entries) {
    routes.set(
      path,
      () =>
        new Response(compress(file), {
          headers: {
            'content-type': mimeTypes('js'),
            'content-encoding': 'br',
          },
        }),
    )
    if (path.endsWith(exts.stories)) storyEntries.push(path)
  }
  /** get data from newly created routes */
  const data = await getStorySetData(storyEntries, host)
  setStoryRoutes({ data, dev, routes })

  /** set test socket handler */
  routes.set(testSocketPath, testSocketHandler)
}
