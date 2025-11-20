import { getEntryPath } from './get-entry-path.js'
import { zip } from './workshop.utils.js'

export const getEntryRoutes = async (root: string, entrypoints: string[]) => {
  const responses: {
    [key: string]: Response
  } = {}
  const { outputs } = await Bun.build({
    entrypoints,
    splitting: true,
    minify: false, // Keep disabled for faster test builds
    root,
    sourcemap: 'inline',
  })
  await Promise.all(
    outputs.map(async (artifact) => {
      const path = artifact.path
      const content = await artifact.text()
      const { kind } = artifact
      let formattedPath: string = path
      if (kind === 'entry-point') {
        formattedPath = getEntryPath(path, '.js')
      } else {
        formattedPath = path.replace(/^\./, '')
      }
      Object.assign(responses, {
        [formattedPath]: zip({
          content,
          contentType: artifact.type,
        }),
      })
    }),
  )
  return responses
}
