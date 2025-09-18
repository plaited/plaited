import { z } from 'zod'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { getRoutes } from './get-routes.js'
import { RUNNER_URL, RELOAD_STORY_PAGE } from '../../testing/testing.constants.js'
import { type Trigger } from '../../main.js'
import { isTypeOf } from '../../utils.js'
import { TEST_RUNNER_EVENTS } from './test-runner.constants.js'
import { RunnerMessageSchema } from './test-runner.schemas.js'

/** @internal WebSocket reload topic */
const RELOAD_TOPIC = 'RELOAD_TOPIC'

export const getTestServer = async ({
  cwd,
  entrypoints,
  trigger,
  server,
  port = 0,
}: {
  cwd: string
  entrypoints: string[]
  trigger: Trigger
  server?: Server
  port?: number
}) => {
  const testServer = Bun.serve({
    port, // Let system assign available port
    routes: await getRoutes(cwd, entrypoints),
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
          trigger?.({ type: TEST_RUNNER_EVENTS.on_runner_message, detail })
        } catch (error) {
          if (error instanceof z.ZodError) {
            server?.sendLoggingMessage({
              level: 'error',
              data: {
                error: `Test server message received: failed zod validation`,
                details: error.issues,
              },
            })
          } else {
            server?.sendLoggingMessage({
              level: 'error',
              data: {
                error: `Test server message received: JSON parsing or other error`,
                details: error,
              },
            })
          }
        }
      },
      close(ws) {
        ws.unsubscribe(RELOAD_TOPIC)
      },
    },
  })

  process.on('SIGINT', async () => {
    server?.sendLoggingMessage({
      level: 'notice',
      data: {
        message: '\n...stopping test server',
      },
    })
    process.exit()
  })

  process.on('uncaughtException', (error) => {
    server?.sendLoggingMessage({
      level: 'error',
      data: {
        error: `Test server uncaughtException`,
        details: error,
      },
    })
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    server?.sendLoggingMessage({
      level: 'error',
      data: {
        error: `Test server unhandled rejection`,
        details: {
          promise,
          reason,
        },
      },
    })
    process.exit(1)
  })

  process.on('exit', async () => {
    await testServer?.stop(true)
    server?.sendLoggingMessage({
      level: 'notice',
      data: {
        message: 'Test server stopped',
      },
    })
  })

  process.on('SIGTERM', async () => {
    server?.sendLoggingMessage({
      level: 'notice',
      data: {
        message: '\n...stopping test server',
      },
    })
    process.exit()
  })

  process.on('SIGHUP', async () => {
    server?.sendLoggingMessage({
      level: 'notice',
      data: {
        message: '\n...stopping test server',
      },
    })
    process.exit()
  })

  const reloadTestClients = () => testServer.publish(RELOAD_TOPIC, RELOAD_STORY_PAGE)

  const reloadTestServer = async (entries = entrypoints) => {
    testServer.publish(RELOAD_TOPIC, RELOAD_STORY_PAGE)
    return testServer.reload({
      routes: await getRoutes(cwd, entries),
    })
  }

  return {
    reloadTestServer,
    reloadTestClients,
    testServer,
  }
}
