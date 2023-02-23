import { assert, assertEquals } from '../../test-deps.ts'
import { server } from '../server.ts'
import {
  __dirname,
  help,
  helpRoute,
  home,
  homeRoute,
  newStyles,
  root,
} from './utils.ts'
import { wait } from '../../utils/wait.ts'
Deno.test('server: adding routes', async () => {
  const routes = homeRoute
  const { close, addRoutes } = await server({
    root,
    routes,
    port: 9000,
    reload: false,
  })
  const homeRes = await fetch('http://localhost:9000/')
  const homeData = await homeRes.text()
  assert(homeData.includes(home))
  let helpRes = await fetch('http://localhost:9000/help')
  await helpRes.body?.cancel()
  assertEquals(helpRes.status, 404)
  addRoutes(helpRoute)
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
  const sse = await fetch('http://localhost:9000/livereload')

  const stylesRes = await fetch('http://localhost:9000/styles.css')
  assertEquals(stylesRes.headers.get('content-type'), 'text/css')
  stylesRes.body?.cancel()

  const failRes = await fetch('http://localhost:9000/new-styles.css')
  assertEquals(failRes.status, 404)
  failRes.body?.cancel()

  await Deno.writeTextFile(`${root}/new-styles.css`, newStyles)
  await wait(500)
  const successRes = await fetch('http://localhost:9000/new-styles.css')
  assertEquals(successRes.status, 200)
  successRes.body?.cancel()
  await Deno.remove(`${root}/new-styles.css`)
  const messages = []
  if (sse.ok && sse.body) {
    const reader = sse.body.getReader()
    let count = 0
    while (count < 2) {
      const { value } = await reader.read()
      count += 1
      const val = new TextDecoder().decode(value)
      messages.push(val)
    }
    reader.cancel()
  }
  assert(messages[0].includes('ready'))
  assert(messages[1].includes('reload'))
  process.close()
})
