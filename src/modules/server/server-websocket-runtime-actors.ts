import * as z from 'zod'

import { ActorEnvelopeSchema } from '../../behavioral.ts'
import type { ClientMessage } from '../../ui.ts'
import { ClientMessageSchema } from '../../ui.ts'

export const UI_WEBSOCKET_RUNTIME_ACTOR_ID = 'ui_websocket_runtime_actor'
export const INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID = 'inference_websocket_runtime_actor'
export const BRIDGE_UI_CORE_ID = 'ui_core'
export const BRIDGE_INFERENCE_CORE_ID = 'inference_bridge'
export const INFERENCE_WEBSOCKET_SOURCE = 'inference'
export const INFERENCE_WEBSOCKET_MESSAGE_TYPE = 'inference_envelope'

const WebSocketRuntimeActorIdSchema = z.enum([UI_WEBSOCKET_RUNTIME_ACTOR_ID, INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID])

type WebSocketRuntimeActorId = z.infer<typeof WebSocketRuntimeActorIdSchema>

export const InferenceWebSocketMessageSchema = z.object({
  type: z.literal(INFERENCE_WEBSOCKET_MESSAGE_TYPE),
  detail: ActorEnvelopeSchema,
})
export type InferenceWebSocketMessage = z.infer<typeof InferenceWebSocketMessageSchema>

const WebSocketRuntimeIngressEnvelopeSchema = z.object({
  actorId: WebSocketRuntimeActorIdSchema,
  connectionId: z.string().min(1),
  source: z.string().min(1),
  messageType: z.string().min(1),
  messageDetail: z.unknown().optional(),
})
export type WebSocketRuntimeIngressEnvelope = z.infer<typeof WebSocketRuntimeIngressEnvelopeSchema>

export type ParseWebSocketRuntimeRouteInput = {
  connectionId: string
  source: string
  payload: unknown
}

export type WebSocketRuntimeRoute = {
  actorId: WebSocketRuntimeActorId
  extensionId: string
  type: string
  detail: unknown
  detailSchema: z.ZodTypeAny
  purpose: string
  envelope: WebSocketRuntimeIngressEnvelope
}

const toIngressPurpose = ({ actorId, messageType }: { actorId: WebSocketRuntimeActorId; messageType: string }) =>
  `server_module websocket ingress (${actorId}): ${messageType}`

const toIngressEnvelope = ({
  actorId,
  connectionId,
  source,
  messageType,
  messageDetail,
}: {
  actorId: WebSocketRuntimeActorId
  connectionId: string
  source: string
  messageType: string
  messageDetail?: unknown
}) =>
  WebSocketRuntimeIngressEnvelopeSchema.parse({
    actorId,
    connectionId,
    source,
    messageType,
    ...(messageDetail !== undefined && { messageDetail }),
  })

const routeUiWebSocketIngress = ({
  connectionId,
  source,
  payload,
}: ParseWebSocketRuntimeRouteInput): WebSocketRuntimeRoute => {
  const parsedMessage: ClientMessage = ClientMessageSchema.parse(payload)
  const envelope = toIngressEnvelope({
    actorId: UI_WEBSOCKET_RUNTIME_ACTOR_ID,
    connectionId,
    source,
    messageType: parsedMessage.type,
    messageDetail: parsedMessage.detail,
  })

  return {
    actorId: UI_WEBSOCKET_RUNTIME_ACTOR_ID,
    extensionId: BRIDGE_UI_CORE_ID,
    type: parsedMessage.type,
    detail: parsedMessage.detail,
    detailSchema: z.unknown(),
    purpose: toIngressPurpose({
      actorId: UI_WEBSOCKET_RUNTIME_ACTOR_ID,
      messageType: parsedMessage.type,
    }),
    envelope,
  }
}

const routeInferenceWebSocketIngress = ({
  connectionId,
  source,
  payload,
}: ParseWebSocketRuntimeRouteInput): WebSocketRuntimeRoute => {
  const parsedMessage = InferenceWebSocketMessageSchema.parse(payload)
  const envelope = toIngressEnvelope({
    actorId: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID,
    connectionId,
    source,
    messageType: parsedMessage.type,
    messageDetail: parsedMessage.detail,
  })

  return {
    actorId: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID,
    extensionId: BRIDGE_INFERENCE_CORE_ID,
    type: parsedMessage.type,
    detail: parsedMessage.detail,
    detailSchema: ActorEnvelopeSchema,
    purpose: toIngressPurpose({
      actorId: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID,
      messageType: parsedMessage.type,
    }),
    envelope,
  }
}

export const parseWebSocketRuntimeRoute = (input: ParseWebSocketRuntimeRouteInput): WebSocketRuntimeRoute => {
  if (input.source === INFERENCE_WEBSOCKET_SOURCE) {
    return routeInferenceWebSocketIngress(input)
  }

  return routeUiWebSocketIngress(input)
}
