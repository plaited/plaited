declare global {
  // eslint-disable-next-line no-var
  var reloadCount: number
}

import type { TestParams } from '../testing/assert.types'
import { LIVE_RELOAD_PATHNAME, globEntries, buildEntries } from './workshop.utils.js'
import { setStoriesAndResponses } from './set-stories-and-responses.js'

export type WorkshopParams = {
  cwd: string
  port?: number
}

export const workshop = async ({ cwd, port = 3000 }: WorkshopParams) => {
  const responses = new Map<string, Response>()
  const stories = new Map<string, TestParams>()
  const entrypoints = await globEntries(cwd)
  await buildEntries({ entrypoints, responses, cwd })
  await Promise.allSettled(
    entrypoints.map(async (entry) => {
      await setStoriesAndResponses({ entry, cwd, responses, stories, port })
    }),
  )
  globalThis.reloadCount ??= 0
  const server = Bun.serve({
    static: Object.fromEntries(responses),
    port,
    async fetch(req: Request) {
      const { pathname } = new URL(req.url)
      if (pathname === LIVE_RELOAD_PATHNAME) {
        return new Response(
          //@ts-ignore: it's cool
          async function* () {
            yield 'data: Hello, world!\n\n'

            while (true) {
              await Bun.sleep(100)
              yield `event: notice\ndata: ${globalThis.reloadCount}\n\n`
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
  return {
    server,
    stories,
  }
}
