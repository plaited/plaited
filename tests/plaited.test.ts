import { assert } from '../libs/dev-deps.ts'

Deno.test('plaited browser test', async () => {
  const server = Deno.run({
    cmd: ['deno', 'run', '--allow-all', 'tests/server/start.ts'],
    env: {
      TEST: 'true',
    },
  })

  const reporter = Deno.run({
    cmd: ['python3', 'tests/reporter.py'],
  })

  const status = await reporter.status()

  server.close()
  reporter.close()
  assert(status.success)
})