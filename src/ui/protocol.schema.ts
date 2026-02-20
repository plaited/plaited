import { z } from 'zod'

import { type BPEvent, isBPEvent } from '../main.ts'

/**
 * Schema for validating BPEvent objects.
 * Uses the framework's `isBPEvent` type guard for runtime validation.
 *
 * @public
 */
export const BPEventSchema = z.custom<BPEvent>(isBPEvent)

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
export const SwapModeSchema = z.enum(['innerHTML', 'outerHTML', 'beforebegin', 'afterbegin', 'beforeend', 'afterend'])

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
  type: z.literal('render'),
  detail: z.object({
    target: z.string(),
    html: z.string(),
    swap: SwapModeSchema.optional(),
  }),
})

/** @public */
export type RenderMessage = z.infer<typeof RenderMessageSchema>
/** @public */
export type RenderDetail = RenderMessage['detail']

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
  type: z.literal('attrs'),
  detail: z.object({
    target: z.string(),
    attr: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]).nullable()),
  }),
})

/** @public */
export type AttrsMessage = z.infer<typeof AttrsMessageSchema>
/** @public */
export type AttrsDetail = AttrsMessage['detail']

/**
 * Schema for stream messages that append content incrementally
 *
 * @remarks
 * Used for streaming responses (e.g. LLM output) where content
 * arrives in chunks and is appended to the target element.
 *
 * @public
 */
export const StreamMessageSchema = z.object({
  type: z.literal('stream'),
  detail: z.object({
    target: z.string(),
    content: z.string(),
  }),
})

/** @public */
export type StreamMessage = z.infer<typeof StreamMessageSchema>
/** @public */
export type StreamDetail = StreamMessage['detail']

/**
 * Schema for CSS property values in design tokens
 * @internal
 */
const CSSValueSchema = z.union([z.string(), z.number()])

/**
 * Schema for a single design token definition
 * @internal
 */
const TokenDefinitionSchema = z.object({
  value: CSSValueSchema,
  description: z.string().optional(),
})

/**
 * Schema for design token categories (colors, spacing, etc.)
 * @internal
 */
const TokenCategorySchema = z.record(z.string(), TokenDefinitionSchema)

/**
 * Schema for the complete design token collection
 *
 * @remarks
 * Validates the structure of design tokens passed to createTokens.
 * Each top-level key is a category (colors, spacing, typography),
 * and each category contains named tokens with values.
 *
 * @public
 */
export const DesignTokensSchema = z.record(z.string(), TokenCategorySchema)

/**
 * Schema for CSS custom property declarations
 * @internal
 */
const CSSCustomPropertySchema = z.record(z.string().regex(/^--[\w-]+$/), CSSValueSchema)

/**
 * Schema for the output of createTokens
 *
 * @remarks
 * Validates the transformed token output containing CSS custom properties
 * and a stylesheet string.
 *
 * @public
 */
export const TokenOutputSchema = z.object({
  properties: CSSCustomPropertySchema,
  stylesheet: z.string(),
})

// ─── Element Protocol Schemas ───────────────────────────────────────────────

/**
 * Schema for trigger detail payloads
 *
 * @remarks
 * Trigger details can be arbitrary structured data. We validate
 * the envelope shape but allow flexible payloads.
 *
 * @public
 */
export const TriggerDetailSchema = z.record(z.string(), z.unknown()).optional()

/**
 * Schema for a trigger message sent between elements
 *
 * @remarks
 * Triggers are the communication primitive in the plaited UI protocol.
 * Each trigger has a type identifier and optional detail payload.
 *
 * @public
 */
export const TriggerMessageSchema = z.object({
  type: z.string().min(1),
  detail: TriggerDetailSchema,
})

/**
 * Schema for element query bindings (p-target selectors)
 *
 * @remarks
 * Validates the binding map returned by useTemplate's query method.
 * Keys are binding identifiers, values are arrays of bound elements.
 *
 * @internal
 */
// export const QueryBindingsSchema = z.record(z.string(), z.array(z.instanceof(Element)))

/**
 * Schema for shadow DOM configuration options
 *
 * @remarks
 * Validates the shadowDom options passed to DeclarativeElement.define().
 * Extends standard ShadowRootInit with plaited-specific options.
 *
 * @public
 */
export const ShadowDomOptionsSchema = z
  .object({
    mode: z.enum(['open', 'closed']).default('open'),
    delegatesFocus: z.boolean().default(false),
    slotAssignment: z.enum(['named', 'manual']).default('named'),
  })
  .partial()

/**
 * Schema for observed attribute declarations
 *
 * @remarks
 * Validates the observedAttributes configuration. Each entry maps
 * an attribute name to its expected type for automatic coercion.
 *
 * @public
 */
export const ObservedAttributeSchema = z.record(z.string(), z.enum(['string', 'number', 'boolean', 'json']))

/**
 * Schema for element definition options passed to DeclarativeElement.define()
 *
 * @remarks
 * Validates the complete configuration object for defining a custom element.
 * This is the primary public API schema for the UI layer.
 *
 * @public
 */
export const ElementDefinitionSchema = z.object({
  tag: z.string().regex(/^[a-z][\w]*-[\w-]+$/, 'Custom element tag must contain a hyphen and start with lowercase'),
  shadowDom: ShadowDomOptionsSchema.optional(),
  observedAttributes: ObservedAttributeSchema.optional(),
  formAssociated: z.boolean().optional(),
  publicEvents: z.array(z.string().min(1)).optional(),
})

// ─── Style Tracker Schemas ──────────────────────────────────────────────────

/**
 * Schema for style tracker adoptedStyleSheets management
 *
 * @remarks
 * Validates the style registry used by createStyleTracker to
 * deduplicate and manage CSSStyleSheet instances across elements.
 *
 * @internal
 */
export const StyleRegistrySchema = z.map(z.string(), z.instanceof(CSSStyleSheet))

/**
 * Schema for the discriminated union of all server-to-client messages
 *
 * @remarks
 * Discriminated on the `type` field for efficient runtime narrowing.
 *
 * @public
 */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  RenderMessageSchema,
  AttrsMessageSchema,
  StreamMessageSchema,
])

/** @public */
export type ServerMessage = z.infer<typeof ServerMessageSchema>

// ─── Client → Server Message Schemas ────────────────────────────────────────

/**
 * Schema for user action messages dispatched from UI interactions
 *
 * @remarks
 * Sent when a user interacts with an element that has a bound p-trigger action.
 * The `action` field identifies the handler; `domEvent` names the DOM event that fired.
 *
 * @public
 */
export const UserActionMessageSchema = z.object({
  type: z.literal('userAction'),
  detail: z.object({
    action: z.string(),
    domEvent: z.string(),
  }),
})

/** @public */
export type UserActionMessage = z.infer<typeof UserActionMessageSchema>

/**
 * Schema for rendered acknowledgement messages
 *
 * @remarks
 * Sent by the client after a render message has been applied to the DOM,
 * confirming that the target element is now visible. The detail is the
 * target string identifier.
 *
 * @public
 */
export const RenderedMessageSchema = z.object({
  type: z.literal('rendered'),
  detail: z.string(),
})

/** @public */
export type RenderedMessage = z.infer<typeof RenderedMessageSchema>

/**
 * Schema for input value messages from form elements
 *
 * @remarks
 * Sent when a text input, textarea, or similar form element changes.
 * The `source` field identifies the originating element.
 *
 * @public
 */
export const InputMessageSchema = z.object({
  type: z.literal('input'),
  detail: z.object({
    value: z.string(),
    source: z.string(),
  }),
})

/** @public */
export type InputMessage = z.infer<typeof InputMessageSchema>

/**
 * Schema for confirmation messages (boolean responses)
 *
 * @remarks
 * Sent when a user responds to a confirmation dialog or toggle.
 * The `source` field identifies the originating element.
 *
 * @public
 */
export const ConfirmedMessageSchema = z.object({
  type: z.literal('confirmed'),
  detail: z.object({
    value: z.boolean(),
    source: z.string(),
  }),
})

/** @public */
export type ConfirmedMessage = z.infer<typeof ConfirmedMessageSchema>

/**
 * Schema for the discriminated union of all client-to-server messages
 *
 * @remarks
 * Discriminated on the `type` field for efficient runtime narrowing.
 *
 * @public
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  UserActionMessageSchema,
  RenderedMessageSchema,
  InputMessageSchema,
  ConfirmedMessageSchema,
])

/** @public */
export type ClientMessage = z.infer<typeof ClientMessageSchema>
