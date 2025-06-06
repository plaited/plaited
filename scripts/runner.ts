import { workshop } from 'plaited/workshop'
import { chromium, type BrowserContext } from 'playwright'

const cwd = `${process.cwd()}/src`

const { server, stories } = await workshop({ cwd, port: 3000 })

const stopServer = async () => {
  console.log('\n...stopping server')
  await server?.stop(true)
  console.log('server stopped')
}

process.on('SIGINT', async () => {
  await stopServer()
  process.exit()
})

process.on('uncaughtException', (error) => {
  console?.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console?.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('exit', async () => {
  await stopServer()
  console.log('server stopped')
})

process.on('SIGTERM', async () => {
  await stopServer()
  process.exit()
})

process.on('SIGHUP', async () => {
  await stopServer()
  process.exit()
})

const browser = await chromium.launch()
const contexts = new Set<BrowserContext>()

await Promise.allSettled(
  [...stories].map(async ([route, params]) => {
    const context = await browser.newContext()
    contexts.add(context)
    const page = await context.newPage()
    await page.goto(`http://localhost:${server.port}${route}`)
  }),
)
