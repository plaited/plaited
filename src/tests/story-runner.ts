import { chromium, type BrowserContext } from 'playwright'
import { bProgram } from '../behavioral.js'

import { getStories, getActions, getServerConfig } from '../workshop.js'

const cwd = `${process.cwd()}/src`
const runnerPath = '/_test-runner'
const { stories, getResponses } = await getStories({
  cwd,
  runnerPath,
  imports: {
    'plaited/jsx-runtime': '/jsx/runtime.js',
    sinon: '/sinon.js',
  },
})

const browser = await chromium.launch()
const contexts = new Set<BrowserContext>()

const { useFeedback, trigger } = bProgram()

const server = Bun.serve(
  getServerConfig({
    trigger,
    getResponses,
    runnerPath,
    cwd,
  }),
)

const actions = getActions({
  stories,
  contexts,
  server,
  trigger,
  port: server.port,
})

useFeedback(actions)

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
  trigger({ type: 'SIGINT' })
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})
