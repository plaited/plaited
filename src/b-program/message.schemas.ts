import * as z from 'zod'
import { BPEventSchema } from '../behavioral/behavioral.schemas.ts'
import { B_PROGRAM_MESSAGE_TYPES, SWAP_MODES } from './message.constants.ts'

/**
 * Type for element matching strategies in attribute selectors.
 * Supports all CSS attribute selector operators.
 *
 * Values:
 * - '=':  Exact match
 * - '~=': Space-separated list contains
 * - '|=': Exact match or prefix followed by hyphen
 * - '^=': Starts with
 * - '$=': Ends with
 * - '*=': Contains
 */

export const SelectorMatchScehama = z.enum(['=', '~=', '|=', '^=', '$=', '*='])

export type SelectorMatch = z.output<typeof SelectorMatchScehama>

/**
 * Schema for render messages that insert or replace DOM content.
 *
 * @public
 */
export const RenderMessageSchema = z.object({
  type: z.literal(B_PROGRAM_MESSAGE_TYPES.render),
  detail: z.object({
    id: z.string(),
    target: z.string(),
    html: z.string(),
    match: SelectorMatchScehama.optional(),
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
  type: z.literal(B_PROGRAM_MESSAGE_TYPES.attrs),
  detail: z.object({
    id: z.string(),
    target: z.string(),
    match: SelectorMatchScehama.optional(),
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
  type: z.literal(B_PROGRAM_MESSAGE_TYPES.dispatch_custom_event),
  detail: z.object({
    id: z.string(),
    target: z.string(),
    event: BPEventSchema,
    bubbles: z.boolean().default(false),
    cancelable: z.boolean().default(true),
    composed: z.boolean().default(true),
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
  type: z.literal(B_PROGRAM_MESSAGE_TYPES.navigate),
  detail: z.object({
    id: z.string(),
    url: z.string(),
    replace: z.boolean().default(false),
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
