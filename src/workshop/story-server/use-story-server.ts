import { z } from 'zod/v4'
import { useSignal, type Signal } from '../../behavioral/use-signal.js'
import type { StoryObj } from '../story-fixture/story-fixture.types.js'
import { getHTMLRoutes } from './get-html-routes.js'
import { addStoryParams, getEntryRoutes, globFiles } from './story-server.utils.js'
import { RELOAD_STORY_PAGE, RUNNER_URL } from '../story-fixture/story-fixture.constants.js'
import type { StoryParams } from './story-server.types.js'
import { isTypeOf } from 'plaited/utils'
import { RunnerMessageSchema } from '../story-runner/story-runner.schema.js'
import { STORY_RUNNER_EVENTS } from '../story-runner/story-runner.constants.js'
import type { Trigger } from 'plaited/behavioral'
/** Glob pattern used to find story files within the project. */
const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`

/** @internal Topic used for WebSocket communication to reload story clients. */
const RELOAD_TOPIC = 'RELOAD_TOPIC'

/**
 * @internal
 * Initializes and manages a Bun server for serving Plaited stories and facilitating communication
 * with the story runner via WebSockets.
 *
 * Responsibilities:
 * - Scans for story files (`*.stories.tsx?`) within the specified root directory.
 * - Dynamically imports story modules to build a set of executable stories.
 * - Generates HTML routes for each story, including full pages and template-only includes.
 * - Bundles necessary JavaScript assets (workshop client, story entry points) using Bun.build.
 * - Serves story content and bundled assets.
 * - Establishes a WebSocket server at `RUNNER_URL` to communicate with story fixtures:
 *   - Receives messages (like snapshots and test outcomes) from fixtures.
 *   - Forwards these messages to the provided `trigger` function for processing by a behavioral program (e.g., `storyRunner`).
 *   - Can publish reload messages to connected clients.
 * - Handles process signals (SIGINT, SIGTERM, SIGHUP) for graceful server shutdown.
 * - Manages uncaught exceptions and unhandled rejections to ensure server stability.
 *
 * @param options - Configuration options for the story server.
 * @param options.root - The root directory of the project, used for globbing story files and resolving paths.
 * @param options.trigger - A Plaited trigger function to dispatch events based on WebSocket messages from fixtures.
 * @param options.designTokens - An optional signal containing global design token CSS to be injected into story pages.
 * @returns A Promise that resolves to an object containing:
 *  - `storyServer`: The Bun server instance.
 *  - `storyParamSet`: A signal containing a Set of `StoryParams` for all discovered stories.
 *  - `reloadStoryServer`: An async function to rebuild routes and reload the server.
 *  - `reloadStoryClients`: A function to publish a reload message to all connected WebSocket clients.
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
