import * as z from 'zod'

import { ActorEnvelopeSchema, type WebsocketRuntimeEnvelope, WebsocketRuntimeEnvelopeSchema } from '../../behavioral.ts'
import type { ClientMessage, ControllerServerMessage } from '../../ui.ts'
import { ClientMessageSchema, ControllerServerMessageSchema } from '../../ui.ts'
import { ueid } from '../../utils/ueid.ts'

const DEFAULT_ACTOR_ID = 'ui:websocket_runtime'
const DEFAULT_UI_CORE_TARGET_ID = 'ui_core'
const DEFAULT_SERVER_SOURCE_ACTOR_ID = 'module:server_module'
const DEFAULT_SERVER_MODULE_ID = 'server_module'

export const UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES = {
  invalidIngressJson: 'invalid_ingress_json',
  invalidIngressMessage: 'invalid_ingress_message',
  invalidEgressJson: 'invalid_egress_json',
  invalidEgressMessage: 'invalid_egress_message',
} as const

type UiWebsocketRuntimeDiagnosticCode =
  (typeof UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES)[keyof typeof UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES]

export type UiWebsocketRuntimeValidationDiagnostic = {
  kind: 'validation'
  lane: 'ingress' | 'egress'
  timestamp: number
  code: UiWebsocketRuntimeDiagnosticCode
  error: string
  topic: string
  connectionId?: string
}

type UiIngressRecord = {
  timestamp: number
  message: ClientMessage
  routedEnvelope: WebsocketRuntimeEnvelope
}

type UiEgressRecord = {
  timestamp: number
  message: ControllerServerMessage
  routedEnvelope: WebsocketRuntimeEnvelope
}

export type UiWebsocketIngressResult =
  | {
      status: 'accepted'
      message: ClientMessage
      routedEnvelope: WebsocketRuntimeEnvelope
    }
  | {
      status: 'rejected'
      code: UiWebsocketRuntimeDiagnosticCode
      error: string
    }

export type UiWebsocketEgressResult =
  | {
      status: 'accepted'
      message: ControllerServerMessage
      serialized: string
      routedEnvelope: WebsocketRuntimeEnvelope
    }
  | {
      status: 'rejected'
      code: UiWebsocketRuntimeDiagnosticCode
      error: string
    }

export type CreateUiWebsocketRuntimeActorOptions = {
  actorId?: string
  uiCoreTargetId?: string
  serverSourceActorId?: string
  serverSourceModuleId?: string
}

const cloneDiagnostics = (diagnostics: UiWebsocketRuntimeValidationDiagnostic[]) => structuredClone(diagnostics)

const cloneIngressHistory = (history: UiIngressRecord[]) => structuredClone(history)

const cloneEgressHistory = (history: UiEgressRecord[]) => structuredClone(history)

const formatValidationError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.map((segment) => String(segment)).join('.') || '<root>'
      return `${path}: ${issue.message}`
    })
    .join('; ')

export const createUiWebsocketRuntimeActor = (options: CreateUiWebsocketRuntimeActorOptions = {}) => {
  const actorId = options.actorId ?? DEFAULT_ACTOR_ID
  const uiCoreTargetId = options.uiCoreTargetId ?? DEFAULT_UI_CORE_TARGET_ID
  const serverSourceActorId = options.serverSourceActorId ?? DEFAULT_SERVER_SOURCE_ACTOR_ID
  const serverSourceModuleId = options.serverSourceModuleId ?? DEFAULT_SERVER_MODULE_ID

  const diagnostics: UiWebsocketRuntimeValidationDiagnostic[] = []
  const ingressHistory: UiIngressRecord[] = []
  const egressHistory: UiEgressRecord[] = []

  const addDiagnostic = ({
    lane,
    code,
    error,
    topic,
    connectionId,
  }: {
    lane: 'ingress' | 'egress'
    code: UiWebsocketRuntimeDiagnosticCode
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

  const routeIngressMessage = ({
    connectionId,
    protocol,
    topic,
    rawMessage,
  }: {
    connectionId: string
    protocol: string
    topic: string
    rawMessage: string
  }): UiWebsocketIngressResult => {
    let payload: unknown
    try {
      payload = JSON.parse(rawMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      addDiagnostic({
        lane: 'ingress',
        code: UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidIngressJson,
        error: `ui websocket ingress rejected: ${message}`,
        topic,
        connectionId,
      })
      return {
        status: 'rejected',
        code: UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidIngressJson,
        error: message,
      }
    }

    let parsedMessage: ClientMessage
    try {
      parsedMessage = ClientMessageSchema.parse(payload)
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw error
      }

      const message = formatValidationError(error)
      addDiagnostic({
        lane: 'ingress',
        code: UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidIngressMessage,
        error: `ui websocket ingress rejected: ${message}`,
        topic,
        connectionId,
      })
      return {
        status: 'rejected',
        code: UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidIngressMessage,
        error: message,
      }
    }

    const routedEnvelope = WebsocketRuntimeEnvelopeSchema.parse({
      route: {
        lane: 'ui',
        direction: 'ingress',
        topic,
        connectionId,
        protocol,
      },
      envelope: ActorEnvelopeSchema.parse({
        id: ueid('env_'),
        type: `ui:websocket:${parsedMessage.type}`,
        source: {
          id: `ui:websocket:${connectionId}:${protocol}`,
          kind: 'ui',
        },
        target: {
          id: uiCoreTargetId,
          kind: 'ui',
        },
        detail: {
          connectionId,
          topic,
          protocol,
          messageType: parsedMessage.type,
          messageDetail: parsedMessage.detail,
        },
        meta: {
          purpose: 'controller_ingress',
          boundary: 'websocket',
        },
      }),
    })

    ingressHistory.push({
      timestamp: Date.now(),
      message: structuredClone(parsedMessage),
      routedEnvelope: structuredClone(routedEnvelope),
    })

    return {
      status: 'accepted',
      message: parsedMessage,
      routedEnvelope,
    }
  }

  const routeEgressMessage = ({
    topic,
    rawMessage,
  }: {
    topic: string
    rawMessage: string
  }): UiWebsocketEgressResult => {
    let payload: unknown
    try {
      payload = JSON.parse(rawMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      addDiagnostic({
        lane: 'egress',
        code: UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidEgressJson,
        error: `ui websocket egress rejected: ${message}`,
        topic,
      })
      return {
        status: 'rejected',
        code: UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidEgressJson,
        error: message,
      }
    }

    let parsedMessage: ControllerServerMessage
    try {
      parsedMessage = ControllerServerMessageSchema.parse(payload)
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw error
      }

      const message = formatValidationError(error)
      addDiagnostic({
        lane: 'egress',
        code: UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidEgressMessage,
        error: `ui websocket egress rejected: ${message}`,
        topic,
      })
      return {
        status: 'rejected',
        code: UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES.invalidEgressMessage,
        error: message,
      }
    }

    const routedEnvelope = WebsocketRuntimeEnvelopeSchema.parse({
      route: {
        lane: 'ui',
        direction: 'egress',
        topic,
      },
      envelope: ActorEnvelopeSchema.parse({
        id: ueid('env_'),
        type: `ui:websocket:${parsedMessage.type}`,
        source: {
          id: serverSourceActorId,
          kind: 'module',
          moduleId: serverSourceModuleId,
        },
        target: {
          id: `ui:websocket:${topic}`,
          kind: 'ui',
        },
        detail: {
          topic,
          messageType: parsedMessage.type,
          messageDetail: parsedMessage.detail ?? null,
        },
        meta: {
          purpose: 'controller_egress',
          boundary: 'websocket',
        },
      }),
    })

    const serialized = JSON.stringify(parsedMessage)
    egressHistory.push({
      timestamp: Date.now(),
      message: structuredClone(parsedMessage),
      routedEnvelope: structuredClone(routedEnvelope),
    })

    return {
      status: 'accepted',
      message: parsedMessage,
      serialized,
      routedEnvelope,
    }
  }

  return Object.freeze({
    actorRef: {
      id: actorId,
      kind: 'ui' as const,
    },
    routeIngressMessage,
    routeEgressMessage,
    getValidationDiagnostics: () => cloneDiagnostics(diagnostics),
    getIngressHistory: () => cloneIngressHistory(ingressHistory),
    getEgressHistory: () => cloneEgressHistory(egressHistory),
  })
}

export type UiWebsocketRuntimeActor = ReturnType<typeof createUiWebsocketRuntimeActor>
