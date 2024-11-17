import { chromium, type BrowserContext } from 'playwright'
import { type Trigger } from '../behavioral/b-program.js'
import * as esbuild from 'esbuild'
import type { Server, ServerWebSocket } from 'bun'
import { isTypeOf } from '../utils/is-type-of.js'
import { getEntryPoints } from './get-entry-points.js'
import { getStories } from './get-stories.js'
import { zip } from './zip.js'
import { getFile } from './get-file.js'
import { runnerModdule } from './runner-module.js'
import { isPlaitedMessage } from '../main/client.guards.js'

const cwd = `${process.cwd()}/src`
const streamURL = '/_test-runner'

const imports = {
  plaited: '/_plaited/plaited.js',
  'plaited/behavioral': '/_plaited/behavioral.js',
  'plaited/jsx-runtime': '/_plaited/runtime.js',
  'plaited/jsx-dev-runtime': '/_plaited/dev-runtime.js',
  'plaited/style': '/_plaited/style.js',
  'plaited/test': '/_plaited/test.js',
  'plaited/utils': '/_plaited/utils.js',
  sinon: '/_sinon/sinon.js',
} as const

const { stories, responses } = await getStories({
  cwd,
  streamURL,
  imports,
})

const { outputFiles } = await esbuild.build({
  entryPoints: getEntryPoints(imports),
  write: false,
  outdir: '/',
  format: 'esm',
  bundle: true,
  splitting: true,
})

for (const { path, text } of outputFiles) {
  responses.set(path, zip(text))
}

const browser = await chromium.launch()
const contexts = new Set<BrowserContext>()

const map = new Map<string, Trigger>()

const server = Bun.serve({
  static: Object.fromEntries(responses),
  port: 3000,
  async fetch(req: Request, server: Server) {
    const { pathname } = new URL(req.url)
    if (/\.js$/.test(pathname)) {
      const path = Bun.resolveSync(`.${pathname}`, cwd)
      return await getFile(path)
    }
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
  runnerModdule({
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
