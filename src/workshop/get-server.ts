import { RELOAD_URL, RELOAD_PAGE } from '../testing/testing.constants.js'
import { getHTMLRoutes } from './get-html-routes.js'
import { discoverTemplateMetadata } from './discover-template-metadata.js'
import { getEntryRoutes } from './get-entry-routes.js'

/** @internal WebSocket reload topic */
const RELOAD_TOPIC = 'RELOAD_TOPIC'

/**
 * Generates routes for all discovered templates.
 * Combines HTML routes (handler functions) and entry routes (static JS bundles).
 *
 * @param cwd - Current working directory (template discovery root)
 * @param exclude - Glob pattern to exclude from template discovery
 * @returns Routes object compatible with Bun.serve()
 *
 * @internal
 */
export const getRoutes = async (
  cwd: string,
  exclude: string,
): Promise<{
  [path: string]: Response | ((req: Request) => Response | Promise<Response>)
}> => {
  console.log(`🔍 Discovering templates in: ${cwd}`)
  console.log(`📋 Excluding pattern: ${exclude}`)

  // Step 1: Discover all templates
  const templates = await discoverTemplateMetadata(cwd, exclude)

  if (templates.length === 0) {
    console.warn('⚠️  No templates found')
    return {}
  }

  console.log(`📄 Found ${templates.length} template exports`)

  // Step 2: Generate HTML routes for each template (returns handler functions)
  const htmlRoutesPromises = templates.map(async (template) => {
    return await getHTMLRoutes({
      exportName: template.exportName,
      filePath: template.filePath,
      cwd,
    })
  })

  const htmlRoutesArray = await Promise.all(htmlRoutesPromises)

  // Step 3: Collect unique file paths for bundling
  const uniqueFilePaths = [...new Set(templates.map((t) => t.filePath))]

  // Step 4: Bundle all templates and get entry routes (returns static Responses)
  const entryRoutes = await getEntryRoutes(cwd, uniqueFilePaths)

  // Step 5: Merge all routes together
  const allRoutes = {
    ...entryRoutes, // Static Response objects for JS bundles
  }

  // Merge HTML handler functions
  for (const htmlRoutes of htmlRoutesArray) {
    Object.assign(allRoutes, htmlRoutes)
  }

  console.log(`✅ Registered ${Object.keys(allRoutes).length} total routes`)
  console.log(`   - ${htmlRoutesArray.length * 2} HTML routes (handlers)`)
  console.log(`   - ${Object.keys(entryRoutes).length} entry routes (static)`)

  return allRoutes
}

/**
 * Creates a server for Playwright template testing with hot reload.
 * Serves templates dynamically with WebSocket-based live reload support.
 *
 * @param options - Server configuration options
 * @param options.cwd - Current working directory (template discovery root)
 * @param options.port - Server port number
 * @param options.testMatch - Pattern to exclude from template discovery (e.g., '*.spec.ts')
 * @returns Reload callback function to notify connected clients
 */

export const getServer = async ({ cwd, port, testMatch }: { cwd: string; port: number; testMatch: string }) => {
  console.log(`🔍 Starting Plaited server`)
  console.log(`📂 Root: ${cwd}`)
  console.log(`🌐 Port: ${port}`)
  console.log(`📋 Test Match: ${testMatch}`)

  const testServer = Bun.serve({
    port,
    routes: await getRoutes(cwd, testMatch),
    async fetch(req: Request, server: Bun.Server) {
      const { pathname } = new URL(req.url)

      // Health check endpoint for Playwright webServer
      if (pathname === '/' || pathname === '/health') {
        return new Response('OK', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }

      // Handle WebSocket upgrade for hot reload
      if (pathname === RELOAD_URL) {
        const success = server.upgrade(req)
        return success ? undefined : new Response('WebSocket upgrade error', { status: 400 })
      }

      // Not found
      return new Response('Not Found', { status: 404 })
    },
    websocket: {
      open(ws) {
        ws.subscribe(RELOAD_TOPIC)
        console.log(`WebSocket client connected`)
      },
      message(ws, message) {
        // Echo messages for test communication if needed
        console.log(`WebSocket message:`, message)
      },
      close(ws) {
        ws.unsubscribe(RELOAD_TOPIC)
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
    await testServer?.stop(true)
    console.log('Server stopped')
  })

  // Hot reload: Broadcast to all connected clients
  const reloadClients = () => {
    testServer.publish(RELOAD_TOPIC, RELOAD_PAGE)
    console.log('🔄 Reloading all clients...')
  }

  console.log(`✅ Server ready at http://localhost:${port}`)
  console.log(`🔥 Hot reload enabled via WebSocket`)

  return reloadClients
}
