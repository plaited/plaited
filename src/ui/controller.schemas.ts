import * as z from 'zod'

import {
  type DefaultHandlers,
  isRulesFunction,
  type RulesFunction,
  SnapshotMessageSchema,
  type Trigger,
} from '../behavioral.ts'
import { isTypeOf, trueTypeOf } from '../utils.ts'
import { CONTROLLER_EVENTS, SWAP_MODES } from './controller.constants.ts'

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
  type: z.literal(CONTROLLER_EVENTS.render),
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
  type: z.literal(CONTROLLER_EVENTS.attrs),
  detail: z.object({
    target: z.string(),
    attr: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]).nullable()),
  }),
})

/** @public */
export type AttrsMessage = z.infer<typeof AttrsMessageSchema>

/** @public */
export type UserAction = {
  type: typeof CONTROLLER_EVENTS.user_action
  detail: {
    type: string
    event: Event
  }
}

export const UserActionMessageSchema = z.object({
  type: z.literal(CONTROLLER_EVENTS.user_action),
  detail: z.string(),
})

/** @public */
export type UserActionMessage = z.infer<typeof UserActionMessageSchema>

export const RootConnectedMessageSchema = z.object({
  type: z.literal(CONTROLLER_EVENTS.root_connected),
  detail: z.string(),
})

/** @public */
export type RootConnectedMessage = z.infer<typeof RootConnectedMessageSchema>

/**
 * Schema for disconnect messages sent from server to client
 *
 * @remarks
 * The server sends a disconnect message to tear down the shell,
 * close the WebSocket, and clean up the behavioral program.
 *
 * @public
 */
export const DisconnectMessageSchema = z.object({
  type: z.literal(CONTROLLER_EVENTS.disconnect),
  detail: z.undefined().optional(),
})

/** @public */
export type DisconnectMessage = z.infer<typeof DisconnectMessageSchema>

export const UpdateBehavioralMessageSchema = z.object({
  type: z.literal(CONTROLLER_EVENTS.update_behavioral),
  detail: z.httpUrl(),
})

/** @public */
export type AddBThreadsMessage = z.infer<typeof UpdateBehavioralMessageSchema>

export const BehavioralUpdatedMessageSchema = z.object({
  type: z.literal(CONTROLLER_EVENTS.behavioral_updated),
  detail: z.object({
    src: z.httpUrl(),
    threads: z.array(z.string()).optional(),
    handlers: z.array(z.string()).optional(),
  }),
})

/** @public */
export type BThreadAddedMessage = z.infer<typeof BehavioralUpdatedMessageSchema>

/**
 * Schema for snapshot messages sent from client to server.
 *
 * @remarks
 * The shell forwards all BP engine snapshot observations (selection bids,
 * feedback errors, restricted trigger rejections, b-thread warnings)
 * to the server over WebSocket for server-side observability.
 *
 * @public
 */
export const SnapshotEventSchema = z.object({
  type: z.literal(CONTROLLER_EVENTS.snapshot),
  detail: SnapshotMessageSchema,
})

/** @public */
export type SnapshotEvent = z.infer<typeof SnapshotEventSchema>

type ShellMessage = RenderMessage | AttrsMessage | UserAction | DisconnectMessage | AddBThreadsMessage

export type ShellHandlers = {
  [M in ShellMessage as M['type']]: M['detail']
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
  threads: z.record(z.string(), z.custom<RulesFunction>(isRulesFunction)).optional(),
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
