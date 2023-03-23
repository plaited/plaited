import { assert, assertEquals, assertSnapshot } from '../../test-deps.ts'
import { server } from '../server.ts'
import {
  __dirname,
  help,
  helpHandler,
  home,
  homeHandler,
  root,
} from './utils.ts'

import { getFileHandler } from '../get-file-handler.ts'
Deno.test('server: adding routes', async () => {
  const routes = new Map()
  routes.set('/', homeHandler)
  const { close } = await server({
    root,
    routes,
    port: 9000,
    middleware: (handler) => async (req, ctx) => {
      const res = await getFileHandler({ assets: root, req })
      if (res) {
        return res
      }
      return await handler(req, ctx)
    },
  })
  const homeRes = await fetch('http://localhost:9000/')
  const homeData = await homeRes.text()
  assert(homeData.includes(home))
  let helpRes = await fetch('http://localhost:9000/help')
  await helpRes.body?.cancel()
  assertEquals(helpRes.status, 404)
  routes.set('/help', helpHandler)
  helpRes = await fetch('http://localhost:9000/help')
  const helpData = await helpRes.text()
  assert(helpData.includes(help))
  await close()
})

Deno.test('server: reload', async (t) => {
  const process = Deno.run({
    cmd: [
      'deno',
      'run',
      '--allow-sys',
      '--allow-net',
      '--allow-read',
      '--allow-write',
      `${__dirname}/start-reload-server.ts`,
    ],
    stdout: 'piped',
  })
  const [status, stdout] = await Promise.all([
    process.status(),
    process.output(),
  ])
  assert(status)
  assertSnapshot(t, new TextDecoder().decode(stdout))
  process.close()
})
