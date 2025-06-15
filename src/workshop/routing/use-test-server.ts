import { $ } from 'bun'
import { OUTPUT_DIR } from '../../../.plaited.js'
import type { TestRoutes } from './routing.types.js'

export const useTestServer = async ({
  port,
  getRoutes,
  assetServer,
  development,
}: {
  port: number
  getRoutes: () => Promise<TestRoutes>
  assetServer: Bun.Server
  development?: Bun.ServeOptions['development']
}) => {
  const testServer = Bun.serve({
    port,
    development,
    routes: await getRoutes(),
  })

  process.on('SIGINT', async () => {
    console.log('\n...stopping server')
    await $`rm -rf ${OUTPUT_DIR}`
    process.exit()
  })

  process.on('uncaughtException', (error) => {
    console?.error('Uncaught Exception:', error)
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console?.error('Unhandled Rejection at:', promise, 'reason:', reason)
    process.exit(1)
  })

  process.on('exit', async () => {
    await testServer?.stop(true)
    await assetServer?.stop(true)
    console.log('server stopped')
  })

  process.on('SIGTERM', async () => {
    console.log('\n...stopping server')
    await $`rm -rf ${OUTPUT_DIR}`
    process.exit()
  })

  process.on('SIGHUP', async () => {
    console.log('\n...stopping server')
    await $`rm -rf ${OUTPUT_DIR}`
    process.exit()
  })
  const reloadTestServer = async () =>
    testServer.reload({
      routes: await getRoutes(),
    })
  return { testServer, reloadTestServer }
}
