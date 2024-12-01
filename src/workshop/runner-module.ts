import type { ServerWebSocket } from 'bun'
import type { JSONDetail } from '../main/plaited.types.js'
import { defineModule } from '../main/define-module.js'
import { TEST_PASSED, TEST_EXCEPTION, UNKNOWN_ERROR, FIXTURE_CONNECTED, PLAY_EVENT } from '../test/assert.constants.js'
import type { FailedTestEvent, PassedTestEvent, TestParams } from '../test/assert.types.js'
import { PLAITED_FIXTURE } from './plaited-fixture.utils.js'

type ModuleMessageDetail<T extends JSONDetail | undefined = undefined> = {
  ws: ServerWebSocket<unknown>
  message: T
}

export const PLAITED_RUNNER = 'PLAITED_RUNNER'

export const runnerModdule = defineModule({
  id: PLAITED_RUNNER,
  publicEvents: [TEST_PASSED, TEST_EXCEPTION, UNKNOWN_ERROR, FIXTURE_CONNECTED],
  bProgram(
    { trigger },
    ctx: {
      stories: [string, TestParams][]
      contexts: Set<{ close(options?: { reason?: string }): Promise<void> }>
      port: number
    },
  ) {
    const logError = ({ url, type, file, story }: { url: string; type: string; file: string; story: string }) => {
      console.error(
        `\x1b[31m${type}\x1b[0m`,
        `\nStory: \x1b[32m${story}\x1b[0m`,
        `\nFile:  \x1b[32m${file}\x1b[0m`,
        `\nURL:   \x1b[32m${url}\x1b[0m`,
      )
    }
    const running = new Map(ctx.stories)
    const fail = new Set()
    const pass = new Set()
    return {
      async end() {
        await Promise.all([...ctx.contexts].map(async (context) => await context.close()))
        console.log('Fail: ', fail.size)
        console.log('Pass: ', pass.size)
        if (!process.execArgv.includes('--hot')) trigger({ type: 'close' })
      },
      close() {
        if (fail.size) {
          process.exitCode = 1
        } else {
          process.exitCode = 0
        }
        process.exit()
      },
      SIGINT() {
        console.log('\nCtrl-C was pressed')
        trigger({ type: 'close' })
      },
      [TEST_EXCEPTION]({ message: { route, ...rest } }: ModuleMessageDetail<FailedTestEvent['detail']>) {
        fail.add(route)
        running.delete(route)
        logError(rest)
        running.size === 0 && trigger({ type: 'end' })
      },
      [UNKNOWN_ERROR]({ message: { route, ...rest } }: ModuleMessageDetail<FailedTestEvent['detail']>) {
        fail.add(route)
        running.delete(route)
        logError(rest)
        running.size === 0 && trigger({ type: 'end' })
      },
      [TEST_PASSED]({ message: { route } }: ModuleMessageDetail<PassedTestEvent['detail']>) {
        pass.add(route)
        running.delete(route)
        console.log('\x1b[32m ✓ \x1b[0m', `http://localhost:${ctx.port}${route}`)
        running.size === 0 && trigger({ type: 'end' })
      },
      [FIXTURE_CONNECTED]({ ws }: ModuleMessageDetail) {
        ws.send(
          JSON.stringify({
            address: PLAITED_FIXTURE,
            type: PLAY_EVENT,
          }),
        )
      },
    }
  },
})
