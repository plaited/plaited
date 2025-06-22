import { useSignal, type Signal } from '../../behavioral/use-signal.js'
import type { StoryObj } from '../story-fixture/story-fixture.types.js'
import { getHTMLRoutes } from './get-html-routes.js'
import { addStoryParams, getEntryRoutes, globFiles } from './story-server.utils.js'
import { RELOAD_STORY_PAGE, RUNNER_URL } from '../story-fixture/story-fixture.constants.js'
import type { StoryParams } from './story-server.types.js'

/** Glob pattern used to find story files within the project. */
const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`

const RELOAD_TOPIC = 'RELOAD_TOPIC'

export const useStoryServer = async (root: string, designTokens?: Signal<string>) => {
  // Get Story Sets
  const entrypoints = await globFiles(root, STORY_GLOB_PATTERN)
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
  const storyParamSet = useSignal<Set<StoryParams>>(new Set())

  const getRoutes = async () => {
    const bundledRoutes = {
      ...(await getEntryRoutes(root, [...storySets.keys()])),
    }
    await Promise.all(
      storySets.entries().map(async ([entry, storySet]) => {
        const filePath = entry.replace(new RegExp(`^${root}`), '')
        addStoryParams({ filePath, storySet, storyParamSet })
        const routes = await getHTMLRoutes({
          designTokens,
          storySet,
          filePath,
        })
        Object.assign(bundledRoutes, ...routes)
      }),
    )
    return bundledRoutes
  }
  const storyServer = Bun.serve({
    port: 0, // Let system assign available port
    routes: await getRoutes(),
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
    await storyServer?.stop(true)
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

  const reloadStoryClients = () => storyServer.publish(RELOAD_TOPIC, RELOAD_STORY_PAGE)
  const reloadStoryServer = async () => {
    storyServer.publish(RELOAD_TOPIC, RELOAD_STORY_PAGE)
    storyParamSet.set(new Set())
    return storyServer.reload({
      routes: await getRoutes(),
    })
  }

  return {
    reloadStoryServer,
    reloadStoryClients,
    storyParamSet,
    storyServer,
  }
}
