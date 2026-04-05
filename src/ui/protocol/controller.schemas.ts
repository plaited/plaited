import * as z from 'zod'

import {
  type BSync,
  type DefaultHandlers,
  isBehavioralRule,
  SnapshotMessageSchema,
  type Trigger,
} from '../../behavioral.ts'
import { AGENT_TO_CONTROLLER_EVENTS } from '../../factories/server-factory/server-factory.constants.ts'
import { isTypeOf, trueTypeOf } from '../../utils.ts'
import { CONTROLLER_TO_AGENT_EVENTS, SWAP_MODES } from './controller.constants.ts'
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
 * Schema for render messages that insert or replace DOM content
 *
 * @remarks
 * The server sends render messages to place HTML at a target element.
 * The optional `swap` field controls insertion position, defaulting
 * to `innerHTML` when omitted.
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
 * Schema for attrs messages that update element attributes
 *
 * @remarks
 * Attrs messages allow surgical attribute updates to a target element —
 * setting or removing attributes (null values remove the attribute).
 * For HTML content replacement, use a render message instead.
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
 * Internal message shape for user actions forwarded from the DOM into the BP engine.
 *
 * @remarks
 * Created by the `bindTriggers` helper when a p-trigger-bound element fires a DOM event.
 * The `event` is the raw DOM event and `type` is the BP event type string.
 *
 * @internal
 */
export type UserAction = {
  type: typeof CONTROLLER_TO_AGENT_EVENTS.user_action
  detail: {
    type: string
    event: Event
  }
}

/**
 * Schema for user action messages sent from client to server.
 *
 * @remarks
 * When a p-trigger-bound DOM event fires, the controller serialises the action
 * type string and sends it to the server for routing.
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
 * Schema for disconnect messages sent from server to client
 *
 * @remarks
 * The server sends a disconnect message to tear down the controller,
 * close the WebSocket, and clean up the behavioral program.
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
 * Schema for `update_behavioral` messages sent from server to client.
 *
 * @remarks
 * The server sends this message to instruct the client to dynamically import
 * a behavioral module from the given HTTP URL. The URL is validated with
 * `z.httpUrl()` to prevent local file imports.
 *
 * @public
 */
export const UpdateBehavioralMessageSchema = z.object({
  type: z.literal(AGENT_TO_CONTROLLER_EVENTS.update_behavioral),
  detail: z.httpUrl(),
})

/** @public */
export type UpdateBehavioralMessage = z.infer<typeof UpdateBehavioralMessageSchema>

/**
 * Schema for snapshot messages sent from client to server.
 *
 * @remarks
 * The controller forwards all BP engine snapshot observations (selection bids,
 * feedback errors, restricted trigger rejections, b-thread warnings)
 * to the server over WebSocket for server-side observability.
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
 * @remarks
 * Composes the protocol schemas into a single union for server-side
 * validation. The `type` field discriminates:
 * - `user_action` — DOM event forwarded from a p-trigger binding
 * - `snapshot` — BP engine observation forwarded from the client controller
 *
 * @public
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [UserActionMessageSchema, SnapshotEventSchema])

/** @public */
export type ClientMessage = z.infer<typeof ClientMessageSchema>

type ControllerMessage = RenderMessage | AttrsMessage | UserAction | DisconnectMessage

/**
 * Maps controller message event types to their detail payloads.
 *
 * @remarks
 * Used to type the `handlers` object inside `controller()`. Each key is a
 * `CONTROLLER_EVENTS` string and each value is the corresponding detail type.
 *
 * @internal
 */
export type ControllerHandlers = {
  [M in ControllerMessage as M['type']]: M['detail']
}

/**
 * Schema for the return value of a dynamically imported behavioral module.
 *
 * @remarks
 * Both fields are optional — a module may provide only threads, only handlers, or both.
 *
 * @public
 */
export const UpdateBehavioralResultSchema = z.object({
  threads: z.record(z.string(), z.custom<ReturnType<BSync>>(isBehavioralRule)).optional(),
  handlers: z
    .custom<DefaultHandlers>((obj) => {
      const isObject = isTypeOf<Record<string, unknown>>(obj, 'object')
      if (!isObject) return false
      for (const val of Object.values(obj)) {
        if (trueTypeOf(val) === 'function' || trueTypeOf(val) === 'asyncfunction') continue
        return false
      }
      return true
    })
    .optional(),
})

/** @public */
export type UpdateBehavioralResult = z.infer<typeof UpdateBehavioralResultSchema>

/**
 * Schema for validating dynamically imported behavioral modules.
 *
 * @remarks
 * After the client fetches a module URL from an `update_behavioral` message,
 * it `import()`s the module and validates its default export. The default
 * export must be a function that receives {@link Trigger} and returns
 * `{ threads?, handlers? }`.
 *
 * @public
 */
export const UpdateBehavioralModuleSchema = z.object({
  default: z.custom<(trigger: Trigger) => UpdateBehavioralResult>((val) => trueTypeOf(val) === 'function'),
})

/** @public */
export type UpdateBehavioralModule = z.infer<typeof UpdateBehavioralModuleSchema>
