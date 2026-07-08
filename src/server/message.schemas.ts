import * as z from 'zod'
import { BPEventSchema } from '../behavioral/behavioral.schemas.ts'
import { SERVER_TO_CONTROLLER_EVENTS, SWAP_MODES } from './message.constants.ts'

/**
 * Schema for render messages that insert or replace DOM content.
 *
 * @public
 */
export const RenderMessageSchema = z.object({
  type: z.literal(SERVER_TO_CONTROLLER_EVENTS.render),
  detail: z.object({
    id: z.string(),
    target: z.string(),
    html: z.string(),
    stylesheets: z.array(z.string()),
    swap: z.enum([
      SWAP_MODES.afterbegin,
      SWAP_MODES.afterend,
      SWAP_MODES.beforebegin,
      SWAP_MODES.beforeend,
      SWAP_MODES.innerHTML,
      SWAP_MODES.outerHTML,
    ]),
  }),
})

/** @public */
export type RenderMessage = z.output<typeof RenderMessageSchema>

/**
 * Schema for attrs messages that update element attributes.
 *
 * @public
 */
export const AttrsMessageSchema = z.object({
  type: z.literal(SERVER_TO_CONTROLLER_EVENTS.attrs),
  detail: z.object({
    id: z.string(),
    target: z.string(),
    attr: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]).nullable()),
  }),
})

/** @public */
export type AttrsMessage = z.output<typeof AttrsMessageSchema>

/**
 * Schema for dispatch-custom-event messages that instruct the controller to
 * dispatch a BP event as a custom DOM event on a target element.
 *
 * @public
 */
export const DispatchCustomEventMessageSchema = z.object({
  type: z.literal(SERVER_TO_CONTROLLER_EVENTS.dispatch_custom_event),
  detail: z.object({
    id: z.string(),
    target: z.string(),
    event: BPEventSchema,
    bubbles: z.boolean().optional(),
    cancelable: z.boolean().optional(),
    composed: z.boolean().optional(),
  }),
})

/** @public */
export type DispatchCustomEventMessage = z.output<typeof DispatchCustomEventMessageSchema>

/**
 * Schema for navigate messages that instruct the controller to navigate to a
 * URL.
 *
 * @remarks
 * When `replace` is `true` the controller uses `location.replace`, otherwise
 * it defaults to `location.assign`.
 *
 * @public
 */
export const NavigateMessageSchema = z.object({
  type: z.literal(SERVER_TO_CONTROLLER_EVENTS.navigate),
  detail: z.object({
    id: z.string(),
    url: z.string(),
    replace: z.literal(true).optional(),
  }),
})

/** @public */
export type NavigateMessage = z.output<typeof NavigateMessageSchema>

/**
 * Discriminated union schema for all server-to-controller messages.
 *
 * @public
 */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  RenderMessageSchema,
  AttrsMessageSchema,
  DispatchCustomEventMessageSchema,
  NavigateMessageSchema,
])

/** @public */
export type ServerMessage = z.output<typeof ServerMessageSchema>
