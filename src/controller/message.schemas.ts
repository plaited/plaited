import * as z from 'zod'
import { BPEventSchema } from '../behavioral/behavioral.schemas.ts'
import { CONTROLLER_TO_SERVER_EVENTS, PAGE_EVENTS } from './message.constants.ts'

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

/**
 * Schema for success acknowledgements sent from a controller island to the
 * server, keyed by the originating command id.
 *
 * @public
 */
export const SuccessMessageSchema = z.object({
  type: z.literal(CONTROLLER_TO_SERVER_EVENTS.success),
  detail: z.object({
    id: z.string(),
    timeStamp: z.number(),
  }),
})

/** @public */
export type SuccessMessage = z.output<typeof SuccessMessageSchema>

/**
 * Schema for page snapshots sent from the controller to the server, capturing
 * the serialized DOM and adopted style sheets at a page lifecycle event.
 *
 * @public
 */
export const PageSnapshotSchema = z.object({
  type: z.literal(CONTROLLER_TO_SERVER_EVENTS.snapshot),
  detail: z.object({
    timeStamp: z.number(),
    type: z.enum(Object.values(PAGE_EVENTS)),
    serializedHTML: z.string(),
    adoptedStyleSheets: z.array(z.string()),
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
