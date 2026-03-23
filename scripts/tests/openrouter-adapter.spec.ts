import { describe, expect, test } from 'bun:test'
import { buildOpenRouterHeaders, extractOpenRouterText } from '../openrouter-adapter.ts'

describe('openrouter-adapter', () => {
  test('extracts text from string content', () => {
    expect(
      extractOpenRouterText({
        choices: [{ message: { content: 'hello world' } }],
      }),
    ).toBe('hello world')
  })

  test('extracts text from content parts', () => {
    expect(
      extractOpenRouterText({
        choices: [
          {
            message: {
              content: [
                { type: 'text', text: 'hello' },
                { type: 'text', text: 'world' },
              ],
            },
          },
        ],
      }),
    ).toBe('hello\nworld')
  })

  test('builds auth headers from env', () => {
    process.env.OPENROUTER_API_KEY = 'test-key'

    const headers = buildOpenRouterHeaders()

    expect(headers.Authorization).toBe('Bearer test-key')
    expect(headers['Content-Type']).toBe('application/json')
  })
})
