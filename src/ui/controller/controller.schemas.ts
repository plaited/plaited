import * as z from 'zod'

import { BPEventSchema, JsonObjectSchema } from '../../behavioral.ts'
import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../../bridge-events.ts'
import { isTypeOf } from '../../utils.ts'
import {
  CUSTOM_ELEMENT_TAG_PATTERN,
  RESERVED_CUSTOM_ELEMENT_TAGS,
  SITE_ROOT_JAVASCRIPT_PATH_PATTERN,
} from '../render/template.constants.ts'
import type { CustomElementTag } from '../render/template.types.ts'
import { SWAP_MODES } from './controller.constants.ts'
import type { ControllerModuleContext, ControllerModuleDefault } from './controller.types.ts'
// ─── Server → Client Message Schemas ────────────────────────────────────────

/**
 * Schema for DOM insertion position values.
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
 * Schema for normalized custom element tag names.
 *
 * @public
 */
export const CustomElementTagSchema = z.custom<CustomElementTag>(
  (value) =>
    isTypeOf<string>(value, 'string') &&
    CUSTOM_ELEMENT_TAG_PATTERN.test(value) &&
    !RESERVED_CUSTOM_ELEMENT_TAGS.has(value),
  'Expected a valid custom element tag',
)

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
    stylesheets: z.array(z.string()),
    swap: SwapModeSchema.optional(),
    registry: z.array(CustomElementTagSchema),
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
 * Schema for module import messages sent from server.
 *
 * @remarks
 * The detail stays constrained to site-root absolute JavaScript paths so
 * browser `import()` does not accept arbitrary remote URLs. Query strings and
 * hash fragments are allowed for cache keys and module identity changes.
 *
 * @public
 */
export const ImportModuleSchema = z.object({
  type: z.literal(AGENT_TO_CONTROLLER_EVENTS.import),
  detail: z.string().regex(SITE_ROOT_JAVASCRIPT_PATH_PATTERN, 'Expected a site-root absolute JavaScript path'),
})

/** @public */
export type ImportModuleMessage = z.infer<typeof ImportModuleSchema>

/**
 * Schema for controller disconnect messages sent from server.
 *
 * @public
 */
export const DisconnectMessageSchema = z.object({
  type: z.literal(AGENT_TO_CONTROLLER_EVENTS.disconnect),
  detail: JsonObjectSchema.optional(),
})

/** @public */
export type DisconnectMessage = z.infer<typeof DisconnectMessageSchema>

export const ServerMessageDetailSchema = z.union([ImportModuleSchema.shape.detail, JsonObjectSchema])

/** @public */
export type ServerMessageDetail = z.infer<typeof ServerMessageDetailSchema>

/**
 * Schema for raw server message envelopes before event-specific parsing.
 *
 * @public
 */
export const ServerMessageEnvelopeSchema = z.object({
  type: z.string(),
  detail: ServerMessageDetailSchema.optional(),
})

/** @public */
export type ServerMessageEnvelope = z.infer<typeof ServerMessageEnvelopeSchema>

/**
 * Discriminated union schema for all server-to-controller messages.
 *
 * @public
 */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  ImportModuleSchema,
  RenderMessageSchema,
  AttrsMessageSchema,
  DisconnectMessageSchema,
])

/** @public */
export type ServerMessage = z.infer<typeof ServerMessageSchema>

/**
 * Schema for imported controller module default exports.
 *
 * @remarks
 * The runtime check only verifies that the default export is callable. The
 * function receives a typed {@link ControllerModuleContext} at invocation time.
 *
 * @public
 */
export const ControllerModuleDefaultSchema = z.custom<ControllerModuleDefault>(
  (value) => isTypeOf(value, 'function') || isTypeOf(value, 'asyncfunction'),
  'Expected imported module default export to be a function',
)

/**
 * Schema for BP events sent from a controller island to the server.
 *
 * @public
 */
export const UiEventMessageSchema = z.object({
  type: z.literal(CONTROLLER_TO_AGENT_EVENTS.ui_event),
  detail: BPEventSchema.superRefine((event, ctx) => {
    if (event.type !== CONTROLLER_TO_AGENT_EVENTS.import_invoked) return
    const result = z
      .object({
        path: ImportModuleSchema.shape.detail,
      })
      .safeParse(event.detail)
    if (result.success) return
    for (const issue of result.error.issues) {
      ctx.addIssue({
        ...issue,
        path: ['detail', ...issue.path],
      })
    }
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
 * Schema for the serializable detail payload carried by controller `error` messages.
 *
 * @public
 */
export const ControllerErrorDetailSchema = z.object({
  message: z.string(),
  kind: z.string().optional(),
  context: JsonObjectSchema.optional(),
})

/** @public */
export type ControllerErrorDetail = z.infer<typeof ControllerErrorDetailSchema>

/**
 * Schema for controller runtime errors sent from a controller island to the server.
 *
 * @public
 */
export const ControllerErrorMessageSchema = z.object({
  type: z.literal(CONTROLLER_TO_AGENT_EVENTS.error),
  detail: ControllerErrorDetailSchema,
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
