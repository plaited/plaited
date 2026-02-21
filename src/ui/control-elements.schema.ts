import { z } from 'zod'

import { ELEMENT_CALLBACKS } from './control-elements.constants.ts'

// ─── Element Callback Message Schemas ────────────────────────────────────────

export const OnAdoptedMessageSchema = z.object({
  type: z.literal(ELEMENT_CALLBACKS.on_adopted),
  detail: z.undefined().optional(),
})

/** @public */
export type OnAdoptedMessage = z.infer<typeof OnAdoptedMessageSchema>

export const OnAttributeChangedMessageSchema = z.object({
  type: z.literal(ELEMENT_CALLBACKS.on_attribute_changed),
  detail: z.object({
    name: z.string(),
    oldValue: z.string().nullable(),
    newValue: z.string().nullable(),
  }),
})

/** @public */
export type OnAttributeChangedMessage = z.infer<typeof OnAttributeChangedMessageSchema>

export const OnConnectedMessageSchema = z.object({
  type: z.literal(ELEMENT_CALLBACKS.on_connected),
  detail: z.undefined().optional(),
})

/** @public */
export type OnConnectedMessage = z.infer<typeof OnConnectedMessageSchema>

export const OnDisconnectedMessageSchema = z.object({
  type: z.literal(ELEMENT_CALLBACKS.on_disconnected),
  detail: z.undefined().optional(),
})

/** @public */
export type OnDisconnectedMessage = z.infer<typeof OnDisconnectedMessageSchema>

export const OnFormAssociatedMessageSchema = z.object({
  type: z.literal(ELEMENT_CALLBACKS.on_form_associated),
  detail: z.custom<HTMLFormElement>((val) => val instanceof HTMLFormElement),
})

/** @public */
export type OnFormAssociatedMessage = z.infer<typeof OnFormAssociatedMessageSchema>

export const OnFormDisabledMessageSchema = z.object({
  type: z.literal(ELEMENT_CALLBACKS.on_form_disabled),
  detail: z.boolean(),
})

/** @public */
export type OnFormDisabledMessage = z.infer<typeof OnFormDisabledMessageSchema>

export const OnFormResetMessageSchema = z.object({
  type: z.literal(ELEMENT_CALLBACKS.on_form_reset),
  detail: z.undefined().optional(),
})

/** @public */
export type OnFormResetMessage = z.infer<typeof OnFormResetMessageSchema>

export const OnFormStateRestoreMessageSchema = z.object({
  type: z.literal(ELEMENT_CALLBACKS.on_form_state_restore),
  detail: z.object({
    state: z.unknown(),
    reason: z.enum(['autocomplete', 'restore']),
  }),
})

/** @public */
export type OnFormStateRestoreMessage = z.infer<typeof OnFormStateRestoreMessageSchema>

// ─── Derived Handler Type ────────────────────────────────────────────────────

type ElementCallbackMessage =
  | OnAdoptedMessage
  | OnAttributeChangedMessage
  | OnConnectedMessage
  | OnDisconnectedMessage
  | OnFormAssociatedMessage
  | OnFormDisabledMessage
  | OnFormResetMessage
  | OnFormStateRestoreMessage

export type BehavioralElementCallbackDetails = {
  [M in ElementCallbackMessage as M['type']]: M['detail']
}
