import * as z from 'zod'

import { ActorEnvelopeSchema } from './behavioral.schemas.ts'

/**
 * Lane discriminator for websocket runtime actor routing.
 *
 * @public
 */
export const WebsocketRuntimeLaneSchema = z.enum(['ui', 'inference'])

/** @public */
export type WebsocketRuntimeLane = z.infer<typeof WebsocketRuntimeLaneSchema>

/**
 * Direction discriminator for websocket runtime actor routing.
 *
 * @public
 */
export const WebsocketRuntimeDirectionSchema = z.enum(['ingress', 'egress'])

/** @public */
export type WebsocketRuntimeDirection = z.infer<typeof WebsocketRuntimeDirectionSchema>

/**
 * Shared routing metadata attached to websocket runtime envelopes.
 *
 * @public
 */
export const WebsocketRuntimeRouteSchema = z.object({
  lane: WebsocketRuntimeLaneSchema,
  direction: WebsocketRuntimeDirectionSchema,
  topic: z.string().min(1),
  connectionId: z.string().min(1).optional(),
  protocol: z.string().min(1).optional(),
})

/** @public */
export type WebsocketRuntimeRoute = z.infer<typeof WebsocketRuntimeRouteSchema>

/**
 * Shared envelope-and-route shape emitted by websocket runtime actors.
 *
 * @public
 */
export const WebsocketRuntimeEnvelopeSchema = z.object({
  route: WebsocketRuntimeRouteSchema,
  envelope: ActorEnvelopeSchema,
})

/** @public */
export type WebsocketRuntimeEnvelope = z.infer<typeof WebsocketRuntimeEnvelopeSchema>
