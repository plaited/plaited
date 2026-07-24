import * as z from 'zod'
import { BPEventSchema } from '../behavioral/behavioral.schemas.ts'
import { B_PROGRAM_MESSAGE_TYPES, PAGE_EVENTS, SWAP_MODES, UI_MESSAGE_TYPES } from './message.constants.ts'

/**
 * Schema for BP events sent from a controller island to the server.
 *
 * @public
 */
export const UiEventMessageSchema = z.object({
  type: z.literal(UI_MESSAGE_TYPES.ui_event),
  detail: z.object({
    event: BPEventSchema,
    timeStamp: z.number(),
  }),
})

/** @public */
export type UiEventMessage = z.output<typeof UiEventMessageSchema>

const FormSubmitFieldValueSchema = z.union([z.string(), z.array(z.string())])

/**
 * Schema for form submissions emitted directly by controller islands.
 *
 * @public
 */
export const FormSubmitMessageSchema = z.object({
  type: z.literal(UI_MESSAGE_TYPES.form_submit),
  detail: z.object({
    name: z.string().nullable(),
    timeStamp: z.number(),
    action: z.string().nullable(),
    data: z.record(z.string(), FormSubmitFieldValueSchema),
  }),
})

/** @public */
export type FormSubmitMessage = z.output<typeof FormSubmitMessageSchema>

/**
 * Schema for controller runtime errors sent from a controller island to the server.
 *
 * @remarks
 * `description` provides a human-readable category string for agent consumers
 * (e.g. "CSSStyleSheet replacement or adoption failed") rather than a terse
 * category literal, since these messages flow back to agent runtimes that benefit
 * from richer context.
 *
 * @public
 */
export const ErrorMessageSchema = z.object({
  type: z.literal(UI_MESSAGE_TYPES.error),
  detail: z.object({
    timeStamp: z.number(),
    id: z.string().optional(),
    name: z.string(),
    error: z.string().optional(),
    stack: z.string().optional(),
  }),
})

/** @public */
export type ErrorMessage = z.output<typeof ErrorMessageSchema>

/**
 * Schema for success acknowledgements sent from a controller island to the
 * server, keyed by the originating command id.
 *
 * @public
 */
export const SuccessMessageSchema = z.object({
  type: z.literal(UI_MESSAGE_TYPES.success),
  detail: z.object({
    id: z.string(),
    timeStamp: z.number(),
  }),
})

/** @public */
export type SuccessMessage = z.output<typeof SuccessMessageSchema>

/**
 * Schema for page snapshots sent from the controller to the server, capturing
 * the serialized DOM at a page lifecycle event.
 *
 * @public
 */
export const PageSnapshotSchema = z.object({
  type: z.literal(UI_MESSAGE_TYPES.snapshot),
  detail: z.object({
    timeStamp: z.number(),
    type: z.enum(Object.values(PAGE_EVENTS)),
    serializedHTML: z.string(),
  }),
})

/** @public */
export type PageSnapshot = z.output<typeof PageSnapshotSchema>
/**
 * Discriminated union schema for all controller-to-server messages.
 *
 * @public
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  UiEventMessageSchema,
  FormSubmitMessageSchema,
  ErrorMessageSchema,
  SuccessMessageSchema,
  PageSnapshotSchema,
])

/** @public */
export type ClientMessage = z.output<typeof ClientMessageSchema>

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
