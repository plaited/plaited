import { z } from 'zod/v4'
import { useSignal, type Signal } from '../../behavioral.js'
import { type StoryObj } from '../../testing.js'
import { RELOAD_STORY_PAGE, RUNNER_URL } from '../../testing/testing.constants.js'
import { getHTMLRoutes } from './get-html-routes.js'
import { addStoryParams, getEntryRoutes, globFiles } from './story-server.utils.js'
import type { StoryParams } from './story-server.types.js'
import { isTypeOf } from '../../utils.js'
import { RunnerMessageSchema } from '../story-runner/story-runner.schema.js'
import { STORY_RUNNER_EVENTS } from '../story-runner/story-runner.constants.js'
import type { Trigger } from '../../behavioral.js'
/** Glob pattern for story files */
const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`

/** @internal WebSocket reload topic */
const RELOAD_TOPIC = 'RELOAD_TOPIC'

/**
 * @internal
 * Story development server with hot reload and WebSocket communication.
 * Serves story pages, manages test execution, and handles live updates.
 *
 * @param options - Server configuration
 * @param options.root - Project root for story discovery
 * @param options.trigger - Event dispatcher for test messages
 * @param options.designTokens - Global CSS tokens signal
 * @returns Server instance with reload controls and story params
 *
 * @example
 * ```ts
 * const { storyServer, reloadStoryClients } = await useStoryServer({
 *   root: process.cwd(),
 *   trigger: myTrigger,
 *   designTokens: tokenSignal
 * });
 * // Server auto-discovers *.stories.tsx files
 * // WebSocket at RUNNER_URL handles test communication
 * ```
 */
export const useStoryServer = async ({
  root,
  trigger,
  designTokens,
}: {
  root: string
  trigger: Trigger
  designTokens?: Signal<string>
}) => {
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
      message(ws, message) {
        if (!isTypeOf<string>(message, 'string')) return
        try {
          const json = JSON.parse(message)
          const detail = RunnerMessageSchema.parse(json)
          trigger?.({ type: STORY_RUNNER_EVENTS.on_runner_message, detail })
        } catch (error) {
          if (error instanceof z.ZodError) {
            console.error('Validation failed:', error.issues)
          } else {
            console.error('JSON parsing or other error:', error)
          }
        }
      },
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
