import { useSignal, type Signal } from '../../behavioral/use-signal.js'
import type { StoryObj } from '../testing/plaited-fixture.types.js'
import type { StoryParams } from '../workshop.types.js'
import { globFiles } from './glob-files.js'
import { getHTMLRoutes } from './get-html-routes.js'
import { addStoryParams } from './add-story-params.js'
import { getEntryRoutes } from './get-entry-routes.js'
import { RELOAD_STORY_PAGE, RUNNER_URL } from '../testing/testing.constants.js'

/** Glob pattern used to find story files within the project. */
const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`

export const RELOAD_TOPIC = 'RELOAD_TOPIC'

export const useServer = async ({
  cwd,
  development,
  port,
  designTokensSignal,
}: {
  cwd: string
  development?: Bun.ServeOptions['development']
  port: number
  designTokensSignal: Signal<string>
}) => {
  // Get Story Sets
  const entrypoints = await globFiles(cwd, STORY_GLOB_PATTERN)
  const storySets = new Map<string, Record<string, StoryObj>>()
  await Promise.all(
    entrypoints.map(async (entry) => {
      try {
        const { default: _, ...storySet } = (await import(entry)) as {
          [key: string]: StoryObj
        }
        storySets.set(entry, storySet)
      } catch (err) {
        console.log(err)
      }
    }),
  )
  const storyParamSetSignal = useSignal<Set<StoryParams>>(new Set())

  const getRoutes = async () => {
    const bundledRoutes = {
      ...(await getEntryRoutes(cwd, [...storySets.keys()])),
    }
    await Promise.all(
      storySets.entries().map(async ([entry, storySet]) => {
        const filePath = entry.replace(new RegExp(`^${cwd}`), '')
        addStoryParams({ filePath, storySet, storyParamSetSignal })
        const routes = await getHTMLRoutes({
          designTokens: designTokensSignal.get(),
          storySet,
          filePath,
        })
        Object.assign(bundledRoutes, ...routes)
      }),
    )
    return bundledRoutes
  }
  const server = Bun.serve({
    routes: await getRoutes(),
    development,
    port,
    async fetch(req: Request, server: Bun.Server) {
      const { pathname } = new URL(req.url)
      if (pathname === RUNNER_URL) {
        const success = server.upgrade(req)
        return success ? undefined : new Response('WebSocket upgrade error', { status: 400 })
      }
      return new Response('Not Found', { status: 404 })
    },
    websocket: {
      open(ws) {
        ws.subscribe(RELOAD_TOPIC)
      },
      message() {},
      close(ws) {
        ws.unsubscribe(RELOAD_TOPIC)
      },
    },
  })

  process.on('SIGINT', async () => {
    console.log('\n...stopping server')
    process.exit()
  })

  process.on('uncaughtException', (error) => {
    console?.error('Uncaught Exception:', error)
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console?.error('Unhandled Rejection at:', promise, 'reason:', reason)
    process.exit(1)
  })

  process.on('exit', async () => {
    await server?.stop(true)
    console.log('server stopped')
  })

  process.on('SIGTERM', async () => {
    console.log('\n...stopping server')
    process.exit()
  })

  process.on('SIGHUP', async () => {
    console.log('\n...stopping server')
    process.exit()
  })

  const reloadClients = () => server.publish(RELOAD_TOPIC, RELOAD_STORY_PAGE)
  const reload = async () => {
    server.publish(RELOAD_TOPIC, RELOAD_STORY_PAGE)
    storyParamSetSignal.set(new Set())
    return server.reload({
      routes: await getRoutes(),
    })
  }

  return {
    url: server.url,
    reload,
    reloadClients,
    storyParamSetSignal,
  }
}
