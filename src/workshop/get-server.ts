import { RELOAD_PAGE, RUNNER_URL } from '../testing/testing.constants.ts'
import { discoverStoryMetadata } from './collect-stories.ts'
import { getEntryRoutes } from './get-entry-routes.ts'
import { getHTMLRoutes } from './get-html-routes.tsx'

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

  // Collect unique story file paths for bundling
  const uniqueFilePaths = [...new Set(stories.map((s) => s.filePath))]

  // Steps 2-4: Run HTML route generation and bundling in parallel for maximum performance
  const [htmlRoutesArray, entryRoutes] = await Promise.all([
    // Step 2: Generate HTML routes for each story
    Promise.all(
      stories.map((story) =>
        getHTMLRoutes({
          exportName: story.exportName,
          filePath: story.filePath,
          cwd,
        }),
      ),
    ),
    // Step 3: Bundle all story files and get entry routes (runs in parallel with HTML generation)
    getEntryRoutes(cwd, uniqueFilePaths),
  ])

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
 * @param options.port - Server port number (0 for auto-assignment)
 * @param options.trigger - Optional trigger function for test runner events
 * @returns Object with reload callback, server instance, and actual port number
 */

export const getServer = async ({ cwd, port }: { cwd: string; port: number }) => {
  console.log(`🔍 Starting Plaited server`)
  console.log(`📂 Root: ${cwd}`)
  console.log(`🌐 Port: ${port}`)
  const server = Bun.serve({
    port,
    routes: await getRoutes(cwd),
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
        ws.subscribe(RUNNER_TOPIC)
      },
      message(_ws, message) {},
      close(ws) {
        ws.unsubscribe(RUNNER_TOPIC)
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

  // Get actual port (important when port 0 is used for auto-assignment)
  const actualPort = server.port

  console.log(`✅ Server ready at http://localhost:${actualPort}`)
  console.log(`🔥 Hot reload enabled via WebSocket`)

  return { reload, server, port: actualPort }
}
