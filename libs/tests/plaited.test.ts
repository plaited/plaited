import { assert } from '../test-deps.ts'
import { wait } from '../utils/wait.ts'
const __dirname = new URL('.', import.meta.url).pathname

Deno.test('plaited browser test', async () => {
  const server = Deno.run({
    env: {
      TEST: 'true',
    },
    cmd: [
      'deno',
      'run',
      '--allow-sys',
      '--allow-read',
      '--allow-env',
      '--allow-net',
      '--allow-run',
      `${__dirname}/start.ts`,
    ],
  })
  await wait(500)
  const url = 'http://localhost:3000'

  const browser = Deno.run({
    cmd: [
      'google-chrome',
      '--headless',
      '--no-sandbox',
      '--window-size=412,892',
      '--remote-debugging-port=9222',
      url,
    ],
  })
  const status = await server.status()
  browser.close()
  server.close()
  assert(status.code === 0)
})
