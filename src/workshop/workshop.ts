import { globEntries } from './workshop.utils.js'
import { type StoryObj, type TestParams } from '../testing/assert.types.js'
import { createStoryRoute } from './create-story-route.js'
import { createTestPage } from './create-test-page.js'
import type { WorkshopParams } from './workshop.types.js'

export const workshop = async ({ cwd, output, background, color, designTokens }: WorkshopParams) => {
  const stories = new Map<string, TestParams>()
  const entrypoints = await globEntries(cwd)
  await Promise.allSettled(
    entrypoints.map(async (entry) => {
      const { default: _, ...rest } = (await import(entry)) as {
        [key: string]: StoryObj
      }
      return await Promise.allSettled(
        Object.entries(rest).map(async ([exportName, story]) => {
          const filePath = entry.replace(new RegExp(`^${cwd}`), '')
          const route = createStoryRoute({ filePath, exportName })
          await createTestPage({
            output,
            story,
            route,
            entry,
            exportName,
            background,
            color,
            designTokens,
          })
        }),
      )
    }),
  )
  // // await buildEntries({ entrypoints, responses, cwd })
  // const server = Bun.serve({
  //   static: Object.fromEntries(responses),
  //   port,
  //   async fetch(req: Request) {
  //     // const { signal, url } = req
  //     // const { pathname } = new URL(url)
  //     // // if (pathname === LIVE_RELOAD_PATHNAME) {
  //     // //   return new Response(
  //     // //     new ReadableStream({
  //     // //       start(controller) {
  //     // //         const interval = setInterval(() => {
  //     // //           controller.enqueue(`data: \n\n`)
  //     // //         }, 1000)

  //     // //         signal.onabort = () => {
  //     // //           clearInterval(interval)
  //     // //           controller.close()
  //     // //         }
  //     // //       },
  //     // //     }),
  //     // //     {
  //     // //       status: 200,
  //     // //       headers: {
  //     // //         'Content-Type': 'text/event-stream',
  //     // //         'Cache-Control': 'no-cache',
  //     // //         Connection: 'keep-alive',
  //     // //       },
  //     // //     },
  //     // //   )
  //     // // }
  //     return new Response('NOT FOUND', { status: 404 })
  //   },
  //   development: true,
  // })
  // const stopServer = async () => {
  //   console.log('\n...stopping server')
  //   await server?.stop(true)
  //   console.log('server stopped')
  // }

  // process.on('SIGINT', async () => {
  //   await stopServer()
  //   process.exit()
  // })

  // process.on('uncaughtException', (error) => {
  //   console?.error('Uncaught Exception:', error)
  // })

  // process.on('unhandledRejection', (reason, promise) => {
  //   console?.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // })

  // process.on('exit', async () => {
  //   await stopServer()
  //   console.log('server stopped')
  // })

  // process.on('SIGTERM', async () => {
  //   await stopServer()
  //   process.exit()
  // })

  // process.on('SIGHUP', async () => {
  //   await stopServer()
  //   process.exit()
  // })
  return stories
}
