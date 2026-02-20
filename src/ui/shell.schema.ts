import { z } from 'zod'

import { type BPEvent, isBPEvent } from '../main.ts'
import { SHELL_EVENTS, SWAP_MODES } from './shell.constants.ts'

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
  type: z.literal(SHELL_EVENTS.render),
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
  type: z.literal(SHELL_EVENTS.attrs),
  detail: z.object({
    target: z.string(),
    attr: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]).nullable()),
  }),
})

/** @public */
export type AttrsMessage = z.infer<typeof AttrsMessageSchema>

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
  type: z.literal(SHELL_EVENTS.stream),
  detail: z.object({
    target: z.string(),
    content: z.string(),
  }),
})

/** @public */
export type StreamMessage = z.infer<typeof StreamMessageSchema>

export const UserActionMessageSchema = z.object({
  type: z.literal(SHELL_EVENTS.user_action),
  detail: z.string(),
})

/** @public */
export type UserActionMessage = z.infer<typeof UserActionMessageSchema>

export const RenderedMessageSchema = z.object({
  type: z.literal(SHELL_EVENTS.rendered),
  detail: z.string(),
})

/** @public */
export type RenderedMessage = z.infer<typeof RenderedMessageSchema>

export const DisconnectMessageSchema = z.object({
  type: z.literal(SHELL_EVENTS.disconnect),
  detail: z.undefined(),
})

/** @public */
export type DisconnectMessage = z.infer<typeof DisconnectMessageSchema>

type ShellMessage =
  | RenderMessage
  | AttrsMessage
  | StreamMessage
  | UserActionMessage
  | RenderedMessage
  | DisconnectMessage

export type ShellHandlers = {
  [M in ShellMessage as M['type']]: M['detail']
}
