import { describe, expect, test } from 'bun:test'
import type { App } from '@modelcontextprotocol/ext-apps'

import { CONTROLLER_TO_AGENT_EVENTS } from '../../../bridge-events.ts'
import type { ClientMessage } from '../controller.schemas.ts'
import { useMcpSender } from '../use-mcp-sender.ts'

const TOOL_NAME = 'plaited.ui.controller.outbound'

const createMcpAppMock = () => {
  const calls: Array<Parameters<Pick<App, 'callServerTool'>['callServerTool']>[0]> = []
  const app: Pick<App, 'callServerTool'> = {
    callServerTool: async (params) => {
      calls.push(params)
      return { content: [] }
    },
  }
  return { app, calls }
}

const createSyncThrowingMcpAppMock = (error: Error) => {
  const app: Pick<App, 'callServerTool'> = {
    callServerTool: () => {
      throw error
    },
  }
  return { app }
}

describe('useMcpSender', () => {
  test('forwards ui_event without translation', () => {
    const { app, calls } = createMcpAppMock()
    const send = useMcpSender({ app, toolName: TOOL_NAME })
    const message: ClientMessage = {
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'clicked',
        detail: { target: 'save-button' },
      },
    }

    send(message)

    expect(calls).toEqual([{ name: TOOL_NAME, arguments: message }])
  })

  test('forwards form_submit without translation', () => {
    const { app, calls } = createMcpAppMock()
    const send = useMcpSender({ app, toolName: TOOL_NAME })
    const message: ClientMessage = {
      type: CONTROLLER_TO_AGENT_EVENTS.form_submit,
      detail: {
        id: 'checkout-form',
        action: '/checkout',
        method: 'post',
        data: {
          quantity: '2',
          tags: ['new', 'priority'],
        },
      },
    }

    send(message)

    expect(calls).toEqual([{ name: TOOL_NAME, arguments: message }])
  })

  test('forwards error without translation', () => {
    const { app, calls } = createMcpAppMock()
    const send = useMcpSender({ app, toolName: TOOL_NAME })
    const message: ClientMessage = {
      type: CONTROLLER_TO_AGENT_EVENTS.error,
      detail: {
        message: 'module import failed',
        kind: 'module_import_error',
        context: { path: '/assets/runtime.js' },
      },
    }

    send(message)

    expect(calls).toEqual([{ name: TOOL_NAME, arguments: message }])
  })

  test('preserves payload objects without mutation', () => {
    const { app, calls } = createMcpAppMock()
    const send = useMcpSender({ app, toolName: TOOL_NAME })
    const message: ClientMessage = {
      type: CONTROLLER_TO_AGENT_EVENTS.form_submit,
      detail: {
        id: 'search-form',
        action: '/search',
        method: 'get',
        data: {
          q: 'caps',
          filters: ['recent', 'docs'],
        },
      },
    }
    const before = JSON.parse(JSON.stringify(message)) as typeof message

    send(message)

    expect(message).toEqual(before)
    expect(calls[0]?.arguments).toEqual(before)
  })

  test('rejects non-controller outbound events at adapter boundary', () => {
    const { app, calls } = createMcpAppMock()
    const send = useMcpSender({ app, toolName: TOOL_NAME })
    const invalidMessage = {
      type: 'external_event',
      detail: { some: 'value' },
    }

    expect(() => send(invalidMessage)).toThrow()
    expect(calls).toHaveLength(0)
  })

  test('reports synchronous callServerTool failures through onError', () => {
    const failure = new Error('sync fail')
    const { app } = createSyncThrowingMcpAppMock(failure)
    const errors: unknown[] = []
    const send = useMcpSender({
      app,
      toolName: TOOL_NAME,
      onError: (error) => {
        errors.push(error)
      },
    })
    const message: ClientMessage = {
      type: CONTROLLER_TO_AGENT_EVENTS.error,
      detail: {
        message: 'controller failure',
      },
    }

    send(message)

    expect(errors).toEqual([failure])
  })
})
