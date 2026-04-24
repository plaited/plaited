import { describe, expect, test } from 'bun:test'

import { CONTROLLER_TO_AGENT_EVENTS } from '../controller.constants.ts'
import type { ControllerErrorMessage } from '../controller.schemas.ts'
import { dispatchControllerError, normalizeControllerErrorDetail } from '../use-controller.ts'

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

describe('dispatchControllerError', () => {
  test('dispatches normalized controller errors through injected send', () => {
    const outbound: ControllerErrorMessage[] = []

    dispatchControllerError({
      error: new Error('module import failed'),
      kind: 'module_import_error',
      context: {
        path: '/dist/modules/controller-module.js',
      },
      send: (event) => {
        outbound.push(event as ControllerErrorMessage)
      },
      fallbackSend: () => {
        throw new Error('fallbackSend should not run when send succeeds')
      },
    })

    expect(outbound).toEqual([
      {
        type: CONTROLLER_TO_AGENT_EVENTS.error,
        detail: {
          message: 'module import failed',
          kind: 'module_import_error',
          context: {
            path: '/dist/modules/controller-module.js',
          },
        },
      },
    ])
  })

  test('falls back to socket sender when injected send throws', () => {
    const fallbackMessages: ControllerErrorMessage[] = []

    const message = dispatchControllerError({
      error: new Error('unsupported controller event'),
      kind: 'server_message_error',
      context: {
        rawMessage: '{"type":"unsupported_controller_event"}',
      },
      send: () => {
        throw new Error('fixture injected send failure')
      },
      fallbackSend: (fallback) => {
        fallbackMessages.push(fallback)
      },
    })

    expect(fallbackMessages).toHaveLength(1)
    expect(message).toEqual(fallbackMessages[0]!)
    expect(message).toEqual({
      type: CONTROLLER_TO_AGENT_EVENTS.error,
      detail: {
        message: 'unsupported controller event',
        kind: 'server_message_error',
        context: {
          rawMessage: '{"type":"unsupported_controller_event"}',
          reportingFailure: {
            message: 'fixture injected send failure',
            kind: 'injected_send_error',
            context: {
              originalKind: 'server_message_error',
              originalMessage: 'unsupported controller event',
            },
          },
        },
      },
    })
  })
})
