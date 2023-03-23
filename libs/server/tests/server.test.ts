import { assert, assertEquals } from '../../test-deps.ts'
import { server } from '../server.ts'
import {
  __dirname,
  help,
  helpHandler,
  home,
  homeHandler,
  newStyles,
  root,
} from './utils.ts'
import { wait } from '../../utils/wait.ts'
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

Deno.test('server: reload', async () => {
  const process = Deno.run({
    cmd: [
      'deno',
      'run',
      '--allow-sys',
      '--allow-net',
      '--allow-read',
      `${__dirname}/start-reload-server.ts`,
    ],
  })
  await wait(500)
  const socket = new WebSocket('ws://localhost:9000/livereload')
  const messages: string[] = []
  const reload = (evt: MessageEvent) => {
    messages.push(evt.data)
  }
  socket.addEventListener('message', reload)
  await Deno.writeTextFile(`${root}/new-styles.css`, newStyles)
  await wait(500)
  socket.close()
  await Deno.remove(`${root}/new-styles.css`)
  console.log(messages)
  assert(messages.length)
  process.close()
})
