import * as z from 'zod'

import {
  ActorEnvelopeSchema,
  type ActorRef,
  type WebsocketRuntimeEnvelope,
  WebsocketRuntimeEnvelopeSchema,
} from '../behavioral.ts'
import { ueid } from '../utils/ueid.ts'

const DEFAULT_ACTOR_ID = 'inference:websocket_runtime'

export const INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES = {
  invalidInboundJson: 'invalid_inbound_json',
  invalidInboundEnvelope: 'invalid_inbound_envelope',
  inboundTargetMismatch: 'inbound_target_mismatch',
  invalidOutboundEnvelope: 'invalid_outbound_envelope',
} as const

type InferenceWebsocketRuntimeDiagnosticCode =
  (typeof INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES)[keyof typeof INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES]

export type InferenceWebsocketRuntimeValidationDiagnostic = {
  kind: 'validation'
  lane: 'ingress' | 'egress'
  timestamp: number
  code: InferenceWebsocketRuntimeDiagnosticCode
  error: string
  topic: string
  connectionId?: string
}

export type InferenceWebsocketIngressResult =
  | {
      status: 'received'
      routedEnvelope: WebsocketRuntimeEnvelope
    }
  | {
      status: 'rejected'
      code: InferenceWebsocketRuntimeDiagnosticCode
      error: string
    }

export type InferenceWebsocketEmitResult =
  | {
      status: 'emitted'
      routedEnvelope: WebsocketRuntimeEnvelope
    }
  | {
      status: 'rejected'
      code: InferenceWebsocketRuntimeDiagnosticCode
      error: string
    }

export type CreateInferenceWebsocketRuntimeActorOptions = {
  actorId?: string
}

export type EmitInferenceEnvelopeInput = {
  topic: string
  type: string
  detail?: Record<string, unknown>
  target?: ActorRef
  correlationId?: string
  causationId?: string
  grantId?: string
  purpose?: string
}

export type EmitModelResponseEnvelopeInput = Omit<EmitInferenceEnvelopeInput, 'type' | 'purpose'>

export type EmitToolIntentEnvelopeInput = Omit<EmitInferenceEnvelopeInput, 'type' | 'purpose'>

export type EmitContextRequestEnvelopeInput = Omit<EmitInferenceEnvelopeInput, 'type' | 'purpose'>

const cloneDiagnostics = (diagnostics: InferenceWebsocketRuntimeValidationDiagnostic[]) => structuredClone(diagnostics)

const cloneEnvelopeHistory = (history: WebsocketRuntimeEnvelope[]) => structuredClone(history)

const formatValidationError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.map((segment) => String(segment)).join('.') || '<root>'
      return `${path}: ${issue.message}`
    })
    .join('; ')

export const createInferenceWebsocketRuntimeActor = (options: CreateInferenceWebsocketRuntimeActorOptions = {}) => {
  const actorId = options.actorId ?? DEFAULT_ACTOR_ID
  const actorRef: ActorRef = {
    id: actorId,
    kind: 'inference',
  }

  const diagnostics: InferenceWebsocketRuntimeValidationDiagnostic[] = []
  const inboundEnvelopeHistory: WebsocketRuntimeEnvelope[] = []
  const outboundEnvelopeHistory: WebsocketRuntimeEnvelope[] = []
  const outboundEnvelopeQueue: WebsocketRuntimeEnvelope[] = []

  const addDiagnostic = ({
    lane,
    code,
    error,
    topic,
    connectionId,
  }: {
    lane: 'ingress' | 'egress'
    code: InferenceWebsocketRuntimeDiagnosticCode
    error: string
    topic: string
    connectionId?: string
  }) => {
    diagnostics.push({
      kind: 'validation',
      lane,
      timestamp: Date.now(),
      code,
      error,
      topic,
      ...(connectionId !== undefined && { connectionId }),
    })
  }

  const receiveInboundEnvelope = ({
    topic,
    rawMessage,
    connectionId,
    protocol,
  }: {
    topic: string
    rawMessage: string
    connectionId?: string
    protocol?: string
  }): InferenceWebsocketIngressResult => {
    let payload: unknown
    try {
      payload = JSON.parse(rawMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      addDiagnostic({
        lane: 'ingress',
        code: INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidInboundJson,
        error: `inference websocket ingress rejected: ${message}`,
        topic,
        connectionId,
      })
      return {
        status: 'rejected',
        code: INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidInboundJson,
        error: message,
      }
    }

    let envelope: z.infer<typeof ActorEnvelopeSchema>
    try {
      envelope = ActorEnvelopeSchema.parse(payload)
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw error
      }

      const message = formatValidationError(error)
      addDiagnostic({
        lane: 'ingress',
        code: INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidInboundEnvelope,
        error: `inference websocket ingress rejected: ${message}`,
        topic,
        connectionId,
      })
      return {
        status: 'rejected',
        code: INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidInboundEnvelope,
        error: message,
      }
    }

    const targetMatchesActor = envelope.target?.kind === 'inference' && envelope.target.id === actorRef.id
    if (!targetMatchesActor) {
      const message = 'inference websocket ingress rejected: target must reference the inference websocket actor.'
      addDiagnostic({
        lane: 'ingress',
        code: INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.inboundTargetMismatch,
        error: message,
        topic,
        connectionId,
      })
      return {
        status: 'rejected',
        code: INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.inboundTargetMismatch,
        error: message,
      }
    }

    const routedEnvelope = WebsocketRuntimeEnvelopeSchema.parse({
      route: {
        lane: 'inference',
        direction: 'ingress',
        topic,
        ...(connectionId !== undefined && { connectionId }),
        ...(protocol !== undefined && { protocol }),
      },
      envelope,
    })

    inboundEnvelopeHistory.push(structuredClone(routedEnvelope))

    return {
      status: 'received',
      routedEnvelope,
    }
  }

  const emitOutboundEnvelope = ({
    topic,
    type,
    detail,
    target,
    correlationId,
    causationId,
    grantId,
    purpose,
  }: EmitInferenceEnvelopeInput): InferenceWebsocketEmitResult => {
    let envelope: z.infer<typeof ActorEnvelopeSchema>
    try {
      envelope = ActorEnvelopeSchema.parse({
        id: ueid('env_'),
        type,
        source: actorRef,
        ...(target !== undefined && { target }),
        ...(correlationId !== undefined && { correlationId }),
        ...(causationId !== undefined && { causationId }),
        ...(grantId !== undefined && { grantId }),
        ...(detail !== undefined && { detail }),
        meta: {
          purpose: purpose ?? 'inference_runtime_egress',
          boundary: 'websocket',
        },
      })
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw error
      }

      const message = formatValidationError(error)
      addDiagnostic({
        lane: 'egress',
        code: INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidOutboundEnvelope,
        error: `inference websocket egress rejected: ${message}`,
        topic,
      })
      return {
        status: 'rejected',
        code: INFERENCE_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidOutboundEnvelope,
        error: message,
      }
    }

    const routedEnvelope = WebsocketRuntimeEnvelopeSchema.parse({
      route: {
        lane: 'inference',
        direction: 'egress',
        topic,
      },
      envelope,
    })

    outboundEnvelopeHistory.push(structuredClone(routedEnvelope))
    outboundEnvelopeQueue.push(structuredClone(routedEnvelope))

    return {
      status: 'emitted',
      routedEnvelope,
    }
  }

  const emitModelResponseEnvelope = (input: EmitModelResponseEnvelopeInput) =>
    emitOutboundEnvelope({
      ...input,
      type: 'inference:model_response',
      purpose: 'model_response',
    })

  const emitToolIntentEnvelope = (input: EmitToolIntentEnvelopeInput) =>
    emitOutboundEnvelope({
      ...input,
      type: 'inference:tool_intent',
      purpose: 'tool_intent',
    })

  const emitContextRequestEnvelope = (input: EmitContextRequestEnvelopeInput) =>
    emitOutboundEnvelope({
      ...input,
      type: 'inference:context_request',
      purpose: 'context_request',
    })

  const takeOutboundEnvelopes = () => {
    const queue = cloneEnvelopeHistory(outboundEnvelopeQueue)
    outboundEnvelopeQueue.length = 0
    return queue
  }

  return Object.freeze({
    actorRef,
    receiveInboundEnvelope,
    emitOutboundEnvelope,
    emitModelResponseEnvelope,
    emitToolIntentEnvelope,
    emitContextRequestEnvelope,
    takeOutboundEnvelopes,
    getInboundEnvelopeHistory: () => cloneEnvelopeHistory(inboundEnvelopeHistory),
    getOutboundEnvelopeHistory: () => cloneEnvelopeHistory(outboundEnvelopeHistory),
    getValidationDiagnostics: () => cloneDiagnostics(diagnostics),
  })
}

export type InferenceWebsocketRuntimeActor = ReturnType<typeof createInferenceWebsocketRuntimeActor>
