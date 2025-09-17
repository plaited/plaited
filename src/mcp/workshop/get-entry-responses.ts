import { posix } from 'node:path'

import { kebabCase } from '../../utils'
import { getNormalizedPath } from './get-normalized-path.js'
import { WORKSHOP_ROUTE } from './wokrkshop.constants.js'
import { zip } from './zip.js'

export const getEntryResponses = async ({ cwd, entrypoints }: { cwd: string; entrypoints: string[] }) => {
  const responses: {
    [key: string]: Response
  } = {}
  const { outputs } = await Bun.build({
    entrypoints: ['plaited/testing', ...entrypoints],
    splitting: true,
    root: cwd,
    // minify: true,
    sourcemap: 'inline',
  })
  await Promise.all(
    outputs.map(async (artifact) => {
      const path = artifact.path
      const content = await artifact.text()
      const { kind } = artifact
      let formattedPath: string = path
      if (kind === 'entry-point' && path === `.${WORKSHOP_ROUTE}`) {
        formattedPath = WORKSHOP_ROUTE
      } else if (kind === 'entry-point') {
        const normalizedPath = getNormalizedPath(path)
        formattedPath = `/${posix.dirname(normalizedPath)}/${kebabCase(posix.basename(normalizedPath, '.stories.js'))}--index.js`
      } else if (path.startsWith('.')) {
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
