import { describe, expect, test } from 'bun:test'

import { normalizeControllerErrorDetail } from '../controller-error-detail.ts'

describe('normalizeControllerErrorDetail', () => {
  test('normalizes controller errors into JSON-safe detail', () => {
    const detail = normalizeControllerErrorDetail({
      error: new Error('failed to parse server message'),
      kind: 'server_message_error',
      context: {
        rawMessage: '{"type":"broken"}',
      },
    })

    expect(detail).toEqual({
      message: 'failed to parse server message',
      kind: 'server_message_error',
      context: {
        rawMessage: '{"type":"broken"}',
      },
    })
  })

  test('preserves structured error fields when available', () => {
    const detail = normalizeControllerErrorDetail({
      error: {
        message: 'fixture stylesheet rejection',
        kind: 'stylesheet_error',
        context: { stylesheetLength: 31 },
      },
    })

    expect(detail).toEqual({
      message: 'fixture stylesheet rejection',
      kind: 'stylesheet_error',
      context: { stylesheetLength: 31 },
    })
  })
})
