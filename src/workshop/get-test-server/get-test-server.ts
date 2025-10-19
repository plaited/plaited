import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { RUNNER_URL, RELOAD_STORY_PAGE } from '../../testing/testing.constants.js'
import { type SignalWithoutInitialValue } from '../../main.js'
import { isTypeOf } from '../../utils.js'
import { RunnerMessageSchema, type RunnerMessage } from '../../testing.js'
import { type StoryMetadata } from '../workshop.schemas.js'
import { getHtmlRoutes } from './get-html-routes.js'
import { getEntryRoutes } from './get-entry-routes.js'

/** @internal WebSocket reload topic */
const RELOAD_TOPIC = 'RELOAD_TOPIC'

const getRoutes = async ({
  cwd,
  entrypointsMetadata,
}: {
  cwd: string
  entrypointsMetadata: [string, StoryMetadata[]][]
}): Promise<{
  [key: string]: Response
}> => ({
  ...(await getHtmlRoutes(cwd, entrypointsMetadata)),
  ...(await getEntryRoutes(
    cwd,
    entrypointsMetadata.map(([entry]) => entry),
  )),
})

export const getTestServer = async ({
  cwd,
  runnerMessage,
  server,
  port = 0,
  entrypointsMetadata,
}: {
  cwd: string
  runnerMessage: SignalWithoutInitialValue<RunnerMessage>
  server?: McpServer
  port?: number
  entrypointsMetadata: [string, StoryMetadata[]][]
}) => {
  const testServer = Bun.serve({
    port, // Let system assign available port
    routes: await getRoutes({ cwd, entrypointsMetadata }),
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
          runnerMessage.set(detail)
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

  const reloadTestServer = async ({
    cwd,
    entrypointsMetadata,
  }: {
    cwd: string
    entrypointsMetadata: [string, StoryMetadata[]][]
  }) => {
    testServer.publish(RELOAD_TOPIC, RELOAD_STORY_PAGE)
    return testServer.reload({
      routes: await getRoutes({
        cwd,
        entrypointsMetadata,
      }),
    })
  }

  return {
    reloadTestServer,
    reloadTestClients,
    testServer,
  }
}
