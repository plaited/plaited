import * as z from 'zod'

import { SnapshotMessageSchema } from '../../behavioral.ts'
import { AGENT_TO_CONTROLLER_EVENTS } from '../../bridge-events.ts'
import { isTypeOf } from '../../utils.ts'
import { CONTROLLER_TO_AGENT_EVENTS, SWAP_MODES } from './dom.constants.ts'

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isEventLike = (value: unknown): value is Event =>
  isObject(value) && isTypeOf((value as { type?: unknown }).type, 'string')

const isMessageEventLike = (value: unknown): value is MessageEvent =>
  isEventLike(value) && isObject(value) && 'data' in value

const HttpImportUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol
  return protocol === 'http:' || protocol === 'https:'
}, 'Expected an http(s) URL')

/** @internal */
export const EventDetailSchema = z.custom<Event>(isEventLike)

/** @internal */
export const MessageEventDetailSchema = z.custom<MessageEvent>(isMessageEventLike)

/** @internal */
export const UserActionDetailSchema = z.object({
  type: z.string(),
  event: EventDetailSchema,
})

// ─── Server → Client Message Schemas ────────────────────────────────────────

/**
 * Schema for DOM insertion position values
 *
 * @remarks
 * Maps to the standard `insertAdjacentHTML` positions plus
 * `innerHTML` and `outerHTML` for full content replacement.
 *
 * @public
 */
export const SwapModeSchema = z.enum([
  SWAP_MODES.afterbegin,
  SWAP_MODES.afterend,
  SWAP_MODES.beforebegin,
  SWAP_MODES.beforeend,
  SWAP_MODES.innerHTML,
  SWAP_MODES.outerHTML,
])

/** @public */
export type SwapMode = z.infer<typeof SwapModeSchema>

/**
 * Schema for render messages that insert or replace DOM content.
 *
 * @public
 */
export const RenderMessageSchema = z.object({
  type: z.literal(AGENT_TO_CONTROLLER_EVENTS.render),
  detail: z.object({
    target: z.string(),
    html: z.string(),
    swap: SwapModeSchema.optional(),
  }),
})

/** @public */
export type RenderMessage = z.infer<typeof RenderMessageSchema>

/**
 * Schema for attrs messages that update element attributes.
 *
 * @public
 */
export const AttrsMessageSchema = z.object({
  type: z.literal(AGENT_TO_CONTROLLER_EVENTS.attrs),
  detail: z.object({
    target: z.string(),
    attr: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]).nullable()),
  }),
})

/** @public */
export type AttrsMessage = z.infer<typeof AttrsMessageSchema>

/**
 * Schema for user action messages sent from client to server.
 *
 * @public
 */
export const UserActionMessageSchema = z.object({
  type: z.literal(CONTROLLER_TO_AGENT_EVENTS.user_action),
  detail: z.object({
    id: z.string(),
    source: z.string(),
    msg: z.string(),
  }),
})

/** @public */
export type UserActionMessage = z.infer<typeof UserActionMessageSchema>

/**
 * Schema for disconnect messages sent from server to client.
 *
 * @public
 */
export const DisconnectMessageSchema = z.object({
  type: z.literal(AGENT_TO_CONTROLLER_EVENTS.disconnect),
  detail: z.undefined().optional(),
})

/** @public */
export type DisconnectMessage = z.infer<typeof DisconnectMessageSchema>

/**
 * Schema for wire-compatible `update_behavioral` messages sent from server.
 *
 * @remarks
 * The detail stays constrained to HTTP(S) URLs so browser import() does not
 * accept arbitrary local paths.
 *
 * @public
 */
export const UpdateBehavioralMessageSchema = z.object({
  type: z.literal(AGENT_TO_CONTROLLER_EVENTS.update_behavioral),
  detail: HttpImportUrlSchema,
})

/** @public */
export type UpdateBehavioralMessage = z.infer<typeof UpdateBehavioralMessageSchema>

/** @internal Detail schema reused for internal `update_extension` handling. */
export const UpdateExtensionDetailSchema = UpdateBehavioralMessageSchema.shape.detail

/**
 * Schema for snapshot messages sent from client to server.
 *
 * @public
 */
export const SnapshotEventSchema = z.object({
  type: z.literal(CONTROLLER_TO_AGENT_EVENTS.snapshot),
  detail: z.object({
    id: z.string(),
    source: z.string(),
    msg: SnapshotMessageSchema,
  }),
})

/** @public */
export type SnapshotEvent = z.infer<typeof SnapshotEventSchema>

/**
 * Discriminated union schema for all client → server WebSocket messages.
 *
 * @public
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [UserActionMessageSchema, SnapshotEventSchema])

/** @public */
export type ClientMessage = z.infer<typeof ClientMessageSchema>
