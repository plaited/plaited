import type { Server, ServerWebSocket } from 'bun'
import type { Trigger } from '../behavioral/b-program.js'
import type { TestParams, FailedTestEvent, PassedTestEvent } from './workshop.types.js'
import { transform } from '@swc/core'
import { globStories } from './glob.js'
import { mapStoryResponses } from './map.js'
import { SION_ROUTE, RUN_PLAY_ACTION } from './workshop.constants.js'
import { TEST_PASSED, TEST_EXCEPTION, UNKNOWN_ERROR } from '../assert/assert.constants.js'
import { isAPassedTestEvent, isAnExceptionEvent } from './guards.js'
import { isTypeOf } from '../utils/is-type-of.js'

const zip = (content: string) => {
  const compressed = Bun.gzipSync(content)
  return new Response(compressed, {
    headers: {
      'content-type': 'text/javascript;charset=utf-8',
      'content-encoding': 'gzip',
    },
  })
}

export const getStories = async ({
  cwd,
  runnerPath,
  imports,
}: {
  cwd: string
  runnerPath: `/${string}`
  imports: Record<string, string>
}) => {
  const storyEntries = await globStories(cwd)
  const responseMap: Map<string, Response> = new Map()
  const getResponses = () => {
    const toRet: Record<string, Response> = {}
    for (const [path, response] of responseMap) {
      toRet[path] = response.clone()
    }
    return toRet
  }
  const stories = await mapStoryResponses({ storyEntries, responseMap, cwd, runnerPath, imports })
  const { outputs } = await Bun.build({
    entrypoints: ['sinon'],
  })
  const sinon = await outputs[0].text()
  responseMap.set(SION_ROUTE, zip(sinon))
  return { stories, getResponses }
}

export const getFile = async (path: string) => {
  const file = Bun.file(path)
  try {
    const text = await file.text()
    const { code } = await transform(text, {
      filename: path,
      // sourceMaps: 'inline',
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
            importSource: 'plaited',
          },
        },
      },
    })
    return zip(code)
  } catch (error) {
    console.error(error)
  }
}

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

export const getServerConfig = ({
  getResponses,
  cwd,
  trigger,
  runnerPath,
}: {
  getResponses: () => Record<string, Response>
  cwd: string
  trigger: Trigger
  runnerPath?: string
}) => ({
  static: getResponses(),
  port: 3000,
  async fetch(req: Request, server: Server) {
    const { pathname } = new URL(req.url)
    if (/\.js$/.test(pathname)) {
      const path = Bun.resolveSync(`.${pathname}`, cwd)
      return await getFile(path)
    }
    if (pathname === runnerPath) {
      const success = server.upgrade(req)
      return success ? undefined : new Response('WebSocket upgrade error', { status: 400 })
    }
    return new Response('Upgrade failed', { status: 500 })
  },
  websocket: {
    open(ws: ServerWebSocket<unknown>) {
      ws.send(JSON.stringify(RUN_PLAY_ACTION))
    },
    message(_: ServerWebSocket<unknown>, message: string | Buffer) {
      if (!isTypeOf<string>(message, 'string')) return
      try {
        const json = JSON.parse(message)
        if (isAnExceptionEvent(json)) trigger<FailedTestEvent['detail']>(json)
        if (isAPassedTestEvent(json)) trigger<PassedTestEvent['detail']>(json)
      } catch (error) {
        console.error(error)
      }
    },
  },
})
