import type { Server, ServerWebSocket } from 'bun'
import type { Trigger } from '../behavioral/b-program.js'
import type { FailedTestEvent, PassedTestEvent } from '../assert/assert.types.js'
import { RUN_PLAY_ACTION } from '../assert/assert.constants.js'
import { isAPassedTestEvent, isAnExceptionEvent } from '../assert/type-guards.js'
import { isTypeOf } from '../utils/is-type-of.js'

export const getServerConfig = ({
  responses,
  cwd,
  trigger,
  runnerPath,
  getFile,
}: {
  responses: Map<string, Response>
  cwd: string
  trigger: Trigger
  runnerPath?: string
  getFile: (path: string) => Promise<Response>
}) => ({
  static: Object.fromEntries(responses),
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
