import * as z from 'zod'

import {
  CONTROLLER_TO_SERVER_EVENTS,
  PAGE_EVENTS,
  SERVER_TO_CONTROLLER_EVENTS,
  SWAP_MODES,
} from './shared.constants.ts'

/** @public */
export const JsonObjectSchema = z.object({}).catchall(z.json())

/** @public */
export type JsonObject = z.output<typeof JsonObjectSchema>

/**
 * Schema for validating BPEvent objects.
 * Uses a JSON-Schema-exportable object shape for runtime validation.
 *
 * @public
 */
export const BPEventSchema = z.object({
  type: z.string(),
  detail: JsonObjectSchema.optional(),
  topic: z.string().optional(),
})

/** @public */
export type BPEvent = z.output<typeof BPEventSchema>

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

export type DispatchCustomEventMessage = z.output<typeof DispatchCustomEventMessageSchema>

/**
 * Discriminated union schema for all server-to-controller messages.
 *
 * @public
 */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  RenderMessageSchema,
  AttrsMessageSchema,
  DispatchCustomEventMessageSchema,
])

/** @public */
export type ServerMessage = z.output<typeof ServerMessageSchema>

/**
 * Schema for BP events sent from a controller island to the server.
 *
 * @public
 */
export const UiEventMessageSchema = z.object({
  type: z.literal(CONTROLLER_TO_SERVER_EVENTS.ui_event),
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
  type: z.literal(CONTROLLER_TO_SERVER_EVENTS.form_submit),
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
  type: z.literal(CONTROLLER_TO_SERVER_EVENTS.error),
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

export const SuccessMessageSchema = z.object({
  type: z.literal(CONTROLLER_TO_SERVER_EVENTS.success),
  detail: z.object({
    id: z.string(),
    timeStamp: z.number(),
  }),
})

/** @public */
export type SuccessMessage = z.output<typeof SuccessMessageSchema>

export const PageSnapshotSchema = z.object({
  type: z.literal(CONTROLLER_TO_SERVER_EVENTS.snapshot),
  detail: z.object({
    timeStamp: z.number(),
    type: z.enum(Object.values(PAGE_EVENTS)),
    serializedHTML: z.string(),
    adoptedStyleSheets: z.array(z.string()),
  }),
})

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
