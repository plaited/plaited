import { describe, expect, test } from 'bun:test'
import { CONTROLLER_TO_AGENT_EVENTS } from '../../shared/shared.constants.ts'
import { useMcpSender } from '../use-mcp-sender.ts'

describe('useMcpSender', () => {
  test('calls the MCP app server tool with a validated controller client message', () => {
    const calls: unknown[] = []
    const send = useMcpSender({
      app: {
        callServerTool(input) {
          calls.push(input)
          return Promise.resolve({ content: [] })
        },
      },
      toolName: 'ui_event',
    })

    const message = {
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'save',
      },
    }
    send(message)

    expect(calls).toEqual([
      {
        name: 'ui_event',
        arguments: message,
      },
    ])
  })

  test('rejects invalid controller client messages before calling the MCP app', () => {
    const calls: unknown[] = []
    const send = useMcpSender({
      app: {
        callServerTool(input) {
          calls.push(input)
          return Promise.resolve({ content: [] })
        },
      },
      toolName: 'ui_event',
    })

    expect(() => (send as (message: unknown) => void)({ type: 'not_a_client_message' })).toThrow()
    expect(calls).toEqual([])
  })

  test('reports async MCP tool failures through onError with the outbound message', async () => {
    const errors: Array<{ error: unknown; message: unknown }> = []
    const send = useMcpSender({
      app: {
        callServerTool() {
          return Promise.reject(new Error('tool failed'))
        },
      },
      toolName: 'ui_event',
      onError(error, message) {
        errors.push({ error, message })
      },
    })

    const message = {
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'save',
      },
    }
    send(message)
    await Promise.resolve()

    expect(errors).toHaveLength(1)
    expect(errors[0]?.error).toBeInstanceOf(Error)
    expect(errors[0]?.message).toEqual(message)
  })

  test('reports synchronous MCP tool failures through onError with the outbound message', () => {
    const errors: Array<{ error: unknown; message: unknown }> = []
    const send = useMcpSender({
      app: {
        callServerTool() {
          throw new Error('tool failed')
        },
      },
      toolName: 'ui_event',
      onError(error, message) {
        errors.push({ error, message })
      },
    })

    const message = {
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'save',
      },
    }
    send(message)

    expect(errors).toHaveLength(1)
    expect(errors[0]?.error).toBeInstanceOf(Error)
    expect(errors[0]?.message).toEqual(message)
  })
})
