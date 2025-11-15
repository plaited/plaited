import { RUNNER_URL, RELOAD_PAGE } from '../testing/testing.constants.js'
import { getHTMLRoutes } from './get-html-routes.js'
import { discoverStoryMetadata } from './discover-story-metadata.js'
import { getEntryRoutes } from './get-entry-routes.js'
import type { Trigger } from '../main.js'

/** @internal WebSocket topic */
const RUNNER_TOPIC = 'RUNNER_TOPIC'

/**
 * Generates routes for all discovered story exports.
 * Combines HTML routes (static story pages) and entry routes (static JS bundles).
 *
 * @param cwd - Current working directory (story discovery root)
 * @returns Routes object compatible with Bun.serve()
 *
 * @internal
 */
export const getRoutes = async (cwd: string): Promise<Record<string, Response>> => {
  console.log(`🔍 Discovering stories in: ${cwd}`)

  // Step 1: Discover all story exports
  const stories = await discoverStoryMetadata(cwd)

  if (stories.length === 0) {
    console.warn('⚠️  No story exports found')
    return {}
  }

  console.log(`📄 Found ${stories.length} story exports`)

  // Step 2: Generate HTML routes for each story (returns handler functions)
  const htmlRoutesPromises = stories.map(async (story) => {
    return await getHTMLRoutes({
      exportName: story.exportName,
      filePath: story.filePath,
      cwd,
    })
  })

  const htmlRoutesArray = await Promise.all(htmlRoutesPromises)

  // Step 3: Collect unique story file paths for bundling
  const uniqueFilePaths = [...new Set(stories.map((s) => s.filePath))]

  // Step 4: Bundle all story files and get entry routes (returns static Responses)
  const entryRoutes = await getEntryRoutes(cwd, uniqueFilePaths)

  // Step 5: Merge all routes together
  const allRoutes: Record<string, Response> = {
    ...entryRoutes, // Static Response objects for JS bundles
  }

  // Merge HTML static Responses
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
 * @param options - Server configuration options
 * @param options.cwd - Current working directory (story discovery root)
 * @param options.port - Server port number
 * @param options.trigger - Optional trigger function for test runner events
 * @returns Reload callback function to notify connected clients
 */

export const getServer = async ({ cwd, port, trigger }: { cwd: string; port: number; trigger?: Trigger }) => {
  console.log(`🔍 Starting Plaited server`)
  console.log(`📂 Root: ${cwd}`)
  console.log(`🌐 Port: ${port}`)

  const server = Bun.serve({
    port,
    routes: await getRoutes(cwd),
    async fetch(req: Request, server: Bun.Server) {
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
        ws.subscribe(RUNNER_TOPIC)
        console.log(`WebSocket client connected`)
      },
      message(ws, message) {
        console.log(`WebSocket message:`, message)

        // Handle runner messages if trigger is provided
        if (trigger && typeof message === 'string') {
          try {
            const data = JSON.parse(message)
            // Trigger the event with the parsed data
            trigger(data)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }
      },
      close(ws) {
        ws.unsubscribe(RUNNER_TOPIC)
        console.log(`WebSocket client disconnected`)
      },
    },
  })

  // Graceful shutdown handlers
  process.on('SIGINT', async () => {
    console.log('\n...stopping server')
    process.exit()
  })

  process.on('SIGTERM', async () => {
    console.log('\n...stopping server')
    process.exit()
  })

  process.on('SIGHUP', async () => {
    console.log('\n...stopping server')
    process.exit()
  })

  process.on('uncaughtException', (error) => {
    console.error('Server uncaughtException:', error)
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Server unhandled rejection:', { promise, reason })
    process.exit(1)
  })

  process.on('exit', async () => {
    await server?.stop(true)
    console.log('Server stopped')
  })

  // Hot reload: Broadcast to all connected clients
  const reload = () => {
    server.publish(RUNNER_TOPIC, RELOAD_PAGE)
    console.log('🔄 Reloading all clients...')
  }

  console.log(`✅ Server ready at http://localhost:${port}`)
  console.log(`🔥 Hot reload enabled via WebSocket`)

  return { reload, server }
}
