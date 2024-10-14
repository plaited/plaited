import type { Server } from 'bun'
import type { Trigger } from '../behavioral/b-program.js'
import type { TestParams, FailedTestEvent, PassedTestEvent } from '../assert/assert.types.js'
import { TEST_PASSED, TEST_EXCEPTION, UNKNOWN_ERROR } from '../assert/assert.constants.js'

export const getActions = ({
  stories,
  contexts,
  server,
  trigger,
  port,
}: {
  stories: [string, TestParams][]
  contexts: Set<{ close(options?: { reason?: string }): Promise<void> }>
  server: Server
  trigger: Trigger
  port: number
}) => {
  const logError = ({ url, type, file, story }: { url: string; type: string; file: string; story: string }) => {
    console.error(
      `\x1b[31m${type}\x1b[0m`,
      `\nStory: \x1b[32m${story}\x1b[0m`,
      `\nFile:  \x1b[32m${file}\x1b[0m`,
      `\nURL:   \x1b[32m${url}\x1b[0m`,
    )
  }
  const running = new Map(stories)
  const fail = new Set()
  const pass = new Set()
  return {
    async end() {
      await Promise.all([...contexts].map(async (context) => await context.close()))
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
      server.stop()
      process.exit()
    },
    SIGINT() {
      console.log('\nCtrl-C was pressed')
      trigger({ type: 'close' })
    },
    [TEST_EXCEPTION]({ route, ...rest }: FailedTestEvent['detail']) {
      fail.add(route)
      running.delete(route)
      logError(rest)
      running.size === 0 && trigger({ type: 'end' })
    },
    [UNKNOWN_ERROR]({ route, ...rest }: FailedTestEvent['detail']) {
      fail.add(route)
      running.delete(route)
      logError(rest)
      running.size === 0 && trigger({ type: 'end' })
    },
    [TEST_PASSED]({ route }: PassedTestEvent['detail']) {
      pass.add(route)
      running.delete(route)
      console.log('\x1b[32m ✓ \x1b[0m', `http://localhost:${port}${route}`)
      running.size === 0 && trigger({ type: 'end' })
    },
  }
}
