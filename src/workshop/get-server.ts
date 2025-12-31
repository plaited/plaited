import { z } from 'zod/v4'
import type { Trigger } from '../main.ts'
import { RELOAD_PAGE, RUNNER_URL } from '../testing/testing.constants.ts'
import { RunnerMessageSchema } from '../testing/testing.schemas.ts'
import { isTypeOf } from '../utils.ts'
import { collectStories } from './collect-stories.ts'
import { getEntryRoutes } from './get-entry-routes.ts'
import { getHTMLRoutes } from './get-html-routes.tsx'
import { getRoot } from './get-root.ts'
import { BPEventSchema } from './workshop.schemas.ts'
import type { StoryMetadata } from './workshop.types.ts'

/** @internal WebSocket topic for page reloads */
const RELOAD_TOPIC = 'RELOAD_TOPIC'

/** @internal WebSocket topic for agent → browser communication */
const AGENT_TO_CLIENT = 'AGENT_TO_CLIENT'

/** @internal Check if IPC is available (spawned with ipc option) */
const hasIpc = typeof process.send === 'function'

/**
 * Generates routes for all discovered story exports.
 * Combines HTML routes (static story pages) and entry routes (static JS bundles).
 *
 * @param cwd - Current working directory (story discovery root)
 * @returns Routes object compatible with Bun.serve()
 *
 * @internal
 */
export const getRoutes = async ({
  paths,
  stories,
  colorScheme,
}: {
  paths: string[]
  stories: Map<string, StoryMetadata>
  colorScheme: 'light' | 'dark'
}): Promise<Record<string, Response>> => {
  if (stories.size === 0) {
    console.warn('⚠️  No story exports found')
    return {}
  }

  console.log(`📄 Found ${stories.size} story exports`)

  const uniqueFilePaths = new Set<string>()
  let root: string
  try {
    root = getRoot(paths)
  } catch (error) {
    console.error(`🚩 Error: Failed to determine common root folder: ${error}`)
    process.exit(1)
  }
  const [htmlRoutesArray, entryRoutes] = await Promise.all([
    Promise.all(
      stories.values().map((story) => {
        const filePath = story.filePath
        !uniqueFilePaths.has(filePath) && uniqueFilePaths.add(filePath)
        return getHTMLRoutes({
          colorScheme,
          route: story.route,
          exportName: story.exportName,
          filePath: story.filePath,
          entryPath: story.entryPath,
        })
      }),
    ),
    getEntryRoutes(root, [...uniqueFilePaths]),
  ])

  const allRoutes: Record<string, Response> = {
    ...entryRoutes,
  }

  for (const htmlRoutes of htmlRoutesArray) {
    Object.assign(allRoutes, htmlRoutes)
  }

  console.log(`✅ Registered ${Object.keys(allRoutes).length} total routes`)
  console.log(`   - ${htmlRoutesArray.length * 2} HTML routes (static)`)
  console.log(`   - ${Object.keys(entryRoutes).length} entry routes (static)`)

  return allRoutes
}

/**
 * Creates a server for Playwright story testing with hot reload and test runner communication.
 * Serves stories dynamically with WebSocket-based live reload and test execution support.
 *
 * @remarks
 * When spawned with IPC (via `Bun.spawn` with `ipc` option), the server:
 * - Listens for BPEvents from parent process and broadcasts to browser clients
 * - Sends BPEvents from browser clients to parent process via `process.send`
 *
 * @param options - Server configuration options
 * @param options.cwd - Current working directory (story discovery root)
 * @param options.port - Server port number (0 for auto-assignment)
 * @param options.trigger - Optional trigger function for test runner events
 * @returns Object with reload callback, server instance, and stories map
 */
export const getServer = async ({
  cwd,
  port,
  paths,
  colorScheme,
  trigger,
}: {
  cwd: string
  port: number
  paths: string[]
  colorScheme: 'light' | 'dark'
  trigger?: Trigger
}) => {
  console.log(`🔍 Discovering stories in: ${cwd}`)

  // Step 1: Discover all story exports
  const stories = await collectStories(cwd, paths)

  console.log(`🔍 Starting Plaited server`)
  console.log(`📂 Root: ${cwd}`)
  console.log(`🌐 Port: ${port === 0 ? '0 (auto-assign)' : port}`)
  console.log(`🎨 Color scheme: ${colorScheme}`)

  const server = Bun.serve({
    port,
    routes: await getRoutes({ paths, stories, colorScheme }),
    async fetch(req, server) {
      const { pathname } = new URL(req.url)

      // Health check endpoint for Playwright webServer
      if (pathname === '/' || pathname === '/health') {
        return new Response('OK', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }

      // Handle WebSocket upgrade for runner communication
      if (pathname === RUNNER_URL) {
        const success = server.upgrade(req)
        return success ? undefined : new Response('WebSocket upgrade error', { status: 400 })
      }

      // Not found
      return new Response('Not Found', { status: 404 })
    },
    websocket: {
      open(ws) {
        ws.subscribe(RELOAD_TOPIC)
        ws.subscribe(AGENT_TO_CLIENT)
      },
      message(_, message) {
        if (!isTypeOf<string>(message, 'string')) return
        try {
          const json = JSON.parse(message)

          // Try to parse as runner message for test runner
          if (trigger) {
            const runnerResult = RunnerMessageSchema.safeParse(json)
            if (runnerResult.success) {
              trigger(runnerResult.data)
              return
            }
          }

          // Validate as BPEvent and send to parent process via IPC
          if (hasIpc) {
            const eventResult = BPEventSchema.safeParse(json)
            if (eventResult.success) {
              process.send!(eventResult.data)
            }
          }
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
        ws.unsubscribe(AGENT_TO_CLIENT)
      },
    },
  })

  // Hot reload: Broadcast to all connected clients
  const reload = () => {
    server.publish(RELOAD_TOPIC, RELOAD_PAGE)
    console.log('🔄 Reloading all clients...')
  }

  // Listen for BPEvents from parent process and broadcast to browser clients
  if (hasIpc) {
    process.on('message', (message: unknown) => {
      const eventResult = BPEventSchema.safeParse(message)
      if (eventResult.success) {
        server.publish(AGENT_TO_CLIENT, JSON.stringify(eventResult.data))
      }
    })
  }

  console.log(`✅ Server ready at http://localhost:${server.port}`)
  console.log(`🔥 Hot reload enabled via WebSocket`)

  return { reload, server, stories }
}
