import { chromium, type BrowserContext } from 'playwright'
import { isPlaitedMessage } from 'plaited'
import { type Trigger } from 'plaited/behavioral'
import { isTypeOf } from 'plaited/utils'
import type { Server, ServerWebSocket } from 'bun'
import { runnerModdule } from './runner-module.js'
import { getStoriesAndResponses } from './get-stories-and-responses.js'

const cwd = `${process.cwd()}/src`
const streamURL = '/_test-runner'

const { stories, responses } = await getStoriesAndResponses(cwd, streamURL)
const browser = await chromium.launch()
const contexts = new Set<BrowserContext>()

const map = new Map<string, Trigger>()

const server = Bun.serve({
  static: Object.fromEntries(responses),
  port: 3000,
  async fetch(req: Request, server: Server) {
    const { pathname } = new URL(req.url)
    if (pathname === streamURL) {
      const success = server.upgrade(req)
      return success ? undefined : new Response('WebSocket upgrade error', { status: 400 })
    }
    return new Response('Upgrade failed', { status: 500 })
  },
  websocket: {
    message(ws: ServerWebSocket<unknown>, message: string | Buffer) {
      if (!isTypeOf<string>(message, 'string')) return
      try {
        const json = JSON.parse(message)
        if (isPlaitedMessage(json)) {
          const { address, type, detail } = json
          const trigger = map.get(address)
          trigger?.({ type, detail: { message: detail, ws } })
        }
      } catch (error) {
        console.error(error)
      }
    },
  },
})

map.set(
  runnerModdule.id,
  runnerModdule.init({
    stories,
    contexts,
    port: 3000,
  }),
)

await Promise.all(
  stories.map(async ([route]) => {
    const context = await browser.newContext()
    contexts.add(context)
    const page = await context.newPage()
    await page.goto(`http://localhost:${server.port}${route}`)
  }),
)

process.on('SIGINT', async () => {
  server.stop()
  await Promise.all([...contexts].map(async (context) => await context.close()))
  map.get(runnerModdule.id)!({ type: 'SIGINT' })
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('exit', () => {
  server.stop()
})

process.on('SIGTERM', () => {
  server.stop()
})

process.on('SIGHUP', () => {
  server.stop()
})
