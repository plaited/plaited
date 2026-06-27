import { describe, expect, test } from 'bun:test'

import { A2A_METHODS, WEB_A2A_EXTENSION_URI } from './shared.constants.ts'
import { JsonRpcRequestSchema, JsonRpcResponseSchema } from './shared.schemas.ts'

describe('A2A JSON-RPC constants', () => {
  test('exposes the web-a2a extension URI', () => {
    expect(WEB_A2A_EXTENSION_URI).toMatch(/^https:\/\//)
    expect(typeof WEB_A2A_EXTENSION_URI).toBe('string')
  })

  test('exposes canonical A2A method names', () => {
    expect(A2A_METHODS.GetExtendedAgentCard).toBe('GetExtendedAgentCard')
    expect(A2A_METHODS.SendMessage).toBe('SendMessage')
    expect(A2A_METHODS.GetTask).toBe('GetTask')
  })
})

describe('JsonRpcRequestSchema', () => {
  test('parses a valid request envelope with arbitrary params', () => {
    const req = JsonRpcRequestSchema.parse({
      jsonrpc: '2.0',
      id: 'req-1',
      method: 'GetExtendedAgentCard',
      params: { hint: 'web-a2a' },
    })
    expect(req.jsonrpc).toBe('2.0')
    expect(req.id).toBe('req-1')
    expect(req.method).toBe('GetExtendedAgentCard')
  })

  test('rejects a request missing jsonrpc version', () => {
    expect(() => JsonRpcRequestSchema.parse({ id: '1', method: 'GetTask' })).toThrow()
  })

  test('rejects a request missing method', () => {
    expect(() => JsonRpcRequestSchema.parse({ jsonrpc: '2.0', id: '1' })).toThrow()
  })

  test('allows params to be omitted', () => {
    const req = JsonRpcRequestSchema.parse({ jsonrpc: '2.0', id: '1', method: 'GetTask' })
    expect(req.method).toBe('GetTask')
  })
})

describe('JsonRpcResponseSchema', () => {
  test('parses a success response carrying a result', () => {
    const res = JsonRpcResponseSchema.parse({
      jsonrpc: '2.0',
      id: 'req-1',
      result: { name: 'Agent' },
    })
    expect(res.id).toBe('req-1')
    expect(res.result).toEqual({ name: 'Agent' })
  })

  test('parses an error response', () => {
    const res = JsonRpcResponseSchema.parse({
      jsonrpc: '2.0',
      id: 'req-1',
      error: { code: -32601, message: 'method not found' },
    })
    expect(res.error?.code).toBe(-32601)
  })

  test('rejects a response with neither result nor error', () => {
    expect(() => JsonRpcResponseSchema.parse({ jsonrpc: '2.0', id: '1' })).toThrow()
  })
})
