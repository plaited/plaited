import { describe, expect, test } from 'bun:test'

import type { ActorRef } from '../../behavioral.ts'
import {
  createInferenceWebsocketRuntimeActor,
  INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES,
} from '../create-websocket-runtime-actor.ts'

const createTarget = (id = 'inference:websocket_runtime'): ActorRef => ({
  id,
  kind: 'inference',
})

describe('createInferenceWebsocketRuntimeActor', () => {
  test('receives valid inbound envelopes targeted to the inference websocket actor', () => {
    const actor = createInferenceWebsocketRuntimeActor()
    const result = actor.receiveInboundEnvelope({
      topic: 'session-a:inference',
      rawMessage: JSON.stringify({
        id: 'env-inbound-1',
        type: 'inference:prompt',
        source: {
          id: 'supervisor:runtime',
          kind: 'supervisor',
        },
        target: createTarget(),
        detail: {
          prompt: 'Summarize this text.',
        },
      }),
      connectionId: 'session-a',
      protocol: 'inference',
    })

    expect(result.status).toBe('received')
    if (result.status !== 'received') {
      throw new Error('Expected received inbound result.')
    }

    expect(result.routedEnvelope.route).toEqual({
      lane: 'inference',
      direction: 'ingress',
      topic: 'session-a:inference',
      connectionId: 'session-a',
      protocol: 'inference',
    })
    expect(result.routedEnvelope.envelope.type).toBe('inference:prompt')
  })

  test('rejects malformed inbound JSON', () => {
    const actor = createInferenceWebsocketRuntimeActor()
    const result = actor.receiveInboundEnvelope({
      topic: 'session-a:inference',
      rawMessage: '{no-json',
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') {
      throw new Error('Expected rejected inbound result.')
    }

    expect(result.code).toBe(INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidInboundJson)
  })

  test('rejects schema-invalid inbound envelopes', () => {
    const actor = createInferenceWebsocketRuntimeActor()
    const result = actor.receiveInboundEnvelope({
      topic: 'session-a:inference',
      rawMessage: JSON.stringify({
        type: 'inference:prompt',
        source: {
          id: 'supervisor:runtime',
          kind: 'supervisor',
        },
        target: createTarget(),
      }),
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') {
      throw new Error('Expected rejected inbound result.')
    }

    expect(result.code).toBe(INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidInboundEnvelope)
  })

  test('rejects inbound envelopes targeted to a different actor', () => {
    const actor = createInferenceWebsocketRuntimeActor()
    const result = actor.receiveInboundEnvelope({
      topic: 'session-a:inference',
      rawMessage: JSON.stringify({
        id: 'env-inbound-2',
        type: 'inference:prompt',
        source: {
          id: 'supervisor:runtime',
          kind: 'supervisor',
        },
        target: createTarget('inference:other-runtime'),
      }),
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') {
      throw new Error('Expected rejected inbound result.')
    }

    expect(result.code).toBe(INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.inboundTargetMismatch)
  })

  test('emits model responses, tool intents, and context requests as outbound envelopes', () => {
    const actor = createInferenceWebsocketRuntimeActor()

    const response = actor.emitModelResponseEnvelope({
      topic: 'session-a:inference',
      detail: {
        content: 'Done.',
      },
      target: {
        id: 'supervisor:runtime',
        kind: 'supervisor',
      },
      correlationId: 'corr-1',
    })
    expect(response.status).toBe('emitted')
    if (response.status !== 'emitted') {
      throw new Error('Expected emitted model response envelope.')
    }
    expect(response.routedEnvelope.envelope.type).toBe('inference:model_response')

    const toolIntent = actor.emitToolIntentEnvelope({
      topic: 'session-a:inference',
      detail: {
        tool: 'search',
        query: 'plaited docs',
      },
    })
    expect(toolIntent.status).toBe('emitted')
    if (toolIntent.status !== 'emitted') {
      throw new Error('Expected emitted tool intent envelope.')
    }
    expect(toolIntent.routedEnvelope.envelope.type).toBe('inference:tool_intent')

    const contextRequest = actor.emitContextRequestEnvelope({
      topic: 'session-a:inference',
      detail: {
        need: 'conversation_history',
      },
    })
    expect(contextRequest.status).toBe('emitted')
    if (contextRequest.status !== 'emitted') {
      throw new Error('Expected emitted context request envelope.')
    }
    expect(contextRequest.routedEnvelope.envelope.type).toBe('inference:context_request')

    const queued = actor.takeOutboundEnvelopes()
    expect(queued).toHaveLength(3)
    expect(actor.takeOutboundEnvelopes()).toEqual([])
  })

  test('rejects outbound envelopes with non-JSON detail payloads', () => {
    const actor = createInferenceWebsocketRuntimeActor()
    const result = actor.emitOutboundEnvelope({
      topic: 'session-a:inference',
      type: 'inference:model_response',
      detail: {
        fn: () => 'not-json',
      },
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') {
      throw new Error('Expected rejected outbound result.')
    }

    expect(result.code).toBe(INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidOutboundEnvelope)
  })
})
