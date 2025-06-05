declare global {
  // eslint-disable-next-line no-var
  var reloadCount: number
}

import type { TestParams } from '../testing/assert.types'
import { LIVE_RELOAD_PATHNAME, globFiles } from './workshop.utils.js'
import { STORIES_FILTERS_REGEX } from '../testing/assert.constants.js'
import { setStoriesAndResponses } from './set-stories-and-responses.js'
import { setExternalLibraries } from './set-external-libraries.js'
import { buildExternalLibraries } from './build-external-libraries'
import { transformLocalFile } from './transform-local-file.js'

export type WorkshopParams = {
  cwd: string
  port?: number
}

export const workshop = async ({ cwd, port = 3000 }: WorkshopParams) => {
  const responses = new Map<string, Response>()
  const stories = new Map<string, TestParams>()
  const externalLibraries = new Set<string>()
  const files = await globFiles(cwd)
  const entries = files.flatMap((path) => (STORIES_FILTERS_REGEX.test(path) ? path : []))
  await setExternalLibraries({ cwd, externalLibraries, files })
  const imports = await buildExternalLibraries(externalLibraries, responses)
  await Promise.allSettled(
    entries.map(async (entry) => {
      await setStoriesAndResponses({ entry, cwd, imports, responses, stories, port })
    }),
  )
  globalThis.reloadCount ??= 0
  return Bun.serve({
    static: Object.fromEntries(responses),
    port,
    async fetch(req: Request) {
      const { pathname } = new URL(req.url)
      if (/\.js(x)$/.test(pathname)) {
        const path = Bun.resolveSync(`.${pathname}`, cwd)
        return await transformLocalFile(path)
      }
      if (pathname === LIVE_RELOAD_PATHNAME) {
        return new Response(
          //@ts-ignore: it's cool
          async function* () {
            yield 'data: Hello, world!\n\n'

            while (true) {
              await Bun.sleep(100)
              yield `data: { reloads: ${globalThis.reloadCount} }\n\n`
              globalThis.reloadCount++
            }
          },
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          },
        )
      }
      return new Response('NOT FOUND', { status: 404 })
    },
  })
}
