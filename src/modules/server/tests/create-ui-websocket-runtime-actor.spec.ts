import { describe, expect, test } from 'bun:test'

import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../../../bridge-events.ts'
import {
  createUiWebsocketRuntimeActor,
  UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES,
} from '../create-ui-websocket-runtime-actor.ts'

describe('createUiWebsocketRuntimeActor', () => {
  test('routes valid controller ingress messages as ui lane ingress envelopes', () => {
    const actor = createUiWebsocketRuntimeActor()
    const result = actor.routeIngressMessage({
      connectionId: 'session-a',
      protocol: 'document',
      topic: 'session-a',
      rawMessage: JSON.stringify({
        type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
        detail: {
          type: 'click',
          detail: {
            id: 'save-button',
          },
        },
      }),
    })

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') {
      throw new Error('Expected accepted ingress result.')
    }

    expect(result.message.type).toBe(CONTROLLER_TO_AGENT_EVENTS.ui_event)
    expect(result.routedEnvelope.route).toEqual({
      lane: 'ui',
      direction: 'ingress',
      topic: 'session-a',
      connectionId: 'session-a',
      protocol: 'document',
    })
    expect(result.routedEnvelope.envelope.target).toEqual({
      id: 'ui_core',
      kind: 'ui',
    })
  })

  test('rejects malformed ingress JSON and records diagnostics', () => {
    const actor = createUiWebsocketRuntimeActor()
    const result = actor.routeIngressMessage({
      connectionId: 'session-a',
      protocol: 'document',
      topic: 'session-a',
      rawMessage: '{not-json',
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') {
      throw new Error('Expected rejected ingress result.')
    }

    expect(result.code).toBe(UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidIngressJson)
    expect(actor.getValidationDiagnostics()).toContainEqual(
      expect.objectContaining({
        lane: 'ingress',
        code: UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidIngressJson,
      }),
    )
  })

  test('rejects schema-invalid ingress messages and records diagnostics', () => {
    const actor = createUiWebsocketRuntimeActor()
    const result = actor.routeIngressMessage({
      connectionId: 'session-a',
      protocol: 'document',
      topic: 'session-a',
      rawMessage: JSON.stringify({
        type: 'unknown_event',
        detail: {},
      }),
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') {
      throw new Error('Expected rejected ingress result.')
    }

    expect(result.code).toBe(UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidIngressMessage)
    expect(actor.getValidationDiagnostics()).toContainEqual(
      expect.objectContaining({
        lane: 'ingress',
        code: UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidIngressMessage,
      }),
    )
  })

  test('routes valid controller egress messages as ui lane egress envelopes', () => {
    const actor = createUiWebsocketRuntimeActor()
    const result = actor.routeEgressMessage({
      topic: 'session-a',
      rawMessage: JSON.stringify({
        type: AGENT_TO_CONTROLLER_EVENTS.render,
        detail: {
          target: 'main',
          html: '<p>hello</p>',
          stylesheets: [],
          registry: [],
        },
      }),
    })

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') {
      throw new Error('Expected accepted egress result.')
    }

    expect(result.message.type).toBe(AGENT_TO_CONTROLLER_EVENTS.render)
    expect(JSON.parse(result.serialized)).toEqual({
      type: AGENT_TO_CONTROLLER_EVENTS.render,
      detail: {
        target: 'main',
        html: '<p>hello</p>',
        stylesheets: [],
        registry: [],
      },
    })
    expect(result.routedEnvelope.route).toEqual({
      lane: 'ui',
      direction: 'egress',
      topic: 'session-a',
    })
    expect(result.routedEnvelope.envelope.source).toEqual({
      id: 'module:server_module',
      kind: 'module',
      moduleId: 'server_module',
    })
  })

  test('accepts disconnect egress messages', () => {
    const actor = createUiWebsocketRuntimeActor()
    const result = actor.routeEgressMessage({
      topic: 'session-a',
      rawMessage: JSON.stringify({
        type: AGENT_TO_CONTROLLER_EVENTS.disconnect,
      }),
    })

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') {
      throw new Error('Expected accepted disconnect egress result.')
    }
    expect(result.message.type).toBe(AGENT_TO_CONTROLLER_EVENTS.disconnect)
  })

  test('rejects unsupported egress event envelopes and records diagnostics', () => {
    const actor = createUiWebsocketRuntimeActor()
    const result = actor.routeEgressMessage({
      topic: 'session-a',
      rawMessage: JSON.stringify({
        type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
        detail: { type: 'click' },
      }),
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') {
      throw new Error('Expected rejected egress result.')
    }

    expect(result.code).toBe(UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidEgressMessage)
    expect(actor.getValidationDiagnostics()).toContainEqual(
      expect.objectContaining({
        lane: 'egress',
        code: UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidEgressMessage,
      }),
    )
  })
})
