import * as z from 'zod'

import { BPEventSchema } from '../../behavioral.ts'
import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../../bridge-events.ts'
import { isTypeOf } from '../../utils.ts'
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
 * Schema for render messages that insert or replace DOM content.
 *
 * @public
 */
export const RenderMessageSchema = z.object({
  type: z.literal(AGENT_TO_CONTROLLER_EVENTS.render),
  detail: z.object({
    target: z.string(),
    html: z.string(),
    swap: SwapModeSchema.optional(),
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
  detail: z.string().regex(/^\/(?!\/)[^\s\\]*\.js(?:[?#][^\s\\]*)?$/, 'Expected a site-root absolute JavaScript path'),
})

/** @public */
export type ImportModuleMessage = z.infer<typeof ImportModuleSchema>

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
  detail: BPEventSchema,
})

/** @public */
export type UiEventMessage = z.infer<typeof UiEventMessageSchema>

/**
 * Schema for controller runtime errors sent from a controller island to the server.
 *
 * @public
 */
export const ControllerErrorMessageSchema = z.object({
  type: z.literal(CONTROLLER_TO_AGENT_EVENTS.error),
  detail: z.string(),
})

/** @public */
export type ControllerErrorMessage = z.infer<typeof ControllerErrorMessageSchema>

/**
 * Discriminated union schema for all controller-to-server messages.
 *
 * @public
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [UiEventMessageSchema, ControllerErrorMessageSchema])

/** @public */
export type ClientMessage = z.infer<typeof ClientMessageSchema>
