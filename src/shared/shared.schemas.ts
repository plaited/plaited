import * as z from 'zod'

import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS, SWAP_MODES } from './shared.constants.ts'

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
  type: z.literal(AGENT_TO_CONTROLLER_EVENTS.render),
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
    registry: z.array(z.string()),
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
    id: z.string(),
    target: z.string(),
    attr: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]).nullable()),
  }),
})

/** @public */
export type AttrsMessage = z.infer<typeof AttrsMessageSchema>

/**
 * Discriminated union schema for all server-to-controller messages.
 *
 * @public
 */
export const ServerMessageSchema = z.discriminatedUnion('type', [RenderMessageSchema, AttrsMessageSchema])

/** @public */
export type ServerMessage = z.infer<typeof ServerMessageSchema>

/**
 * Schema for BP events sent from a controller island to the server.
 *
 * @public
 */
export const UiEventMessageSchema = z.object({
  type: z.literal(CONTROLLER_TO_AGENT_EVENTS.ui_event),
  detail: z.object({
    event: BPEventSchema,
  }),
})

/** @public */
export type UiEventMessage = z.infer<typeof UiEventMessageSchema>

const FormSubmitFieldValueSchema = z.union([z.string(), z.array(z.string())])

/**
 * Schema for form submissions emitted directly by controller islands.
 *
 * @public
 */
export const FormSubmitMessageSchema = z.object({
  type: z.literal(CONTROLLER_TO_AGENT_EVENTS.form_submit),
  detail: z.object({
    id: z.string().nullable(),
    action: z.string().nullable(),
    method: z.string(),
    data: z.record(z.string(), FormSubmitFieldValueSchema),
  }),
})

/** @public */
export type FormSubmitMessage = z.infer<typeof FormSubmitMessageSchema>

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
export const ControllerErrorMessageSchema = z.object({
  type: z.literal(CONTROLLER_TO_AGENT_EVENTS.error),
  detail: z.object({
    message: z.string(),
    description: z.string().optional(),
    context: JsonObjectSchema.optional(),
  }),
})

/** @public */
export type ControllerErrorMessage = z.infer<typeof ControllerErrorMessageSchema>

/**
 * Discriminated union schema for all controller-to-server messages.
 *
 * @public
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  UiEventMessageSchema,
  FormSubmitMessageSchema,
  ControllerErrorMessageSchema,
])

/** @public */
export type ClientMessage = z.infer<typeof ClientMessageSchema>
