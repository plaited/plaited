import * as z from 'zod'

import { AttrsMessageSchema, RenderMessageSchema, ServerMessageSchema } from '../controller/controller.schemas.ts'

/** @public */
export const UiProjectionInputsSchema = z.object({
  refs: z.array(z.string()).optional(),
  hashes: z.array(z.string()).optional(),
})

/** @public */
export type UiProjectionInputs = z.output<typeof UiProjectionInputsSchema>

const UiProjectionDetailSchema = z.object({
  topic: z.string().min(1),
  version: z.number().int().positive(),
  inputs: UiProjectionInputsSchema.optional(),
})

/** @public */
export const UiProjectionControllerMessageSchema = z.discriminatedUnion('type', [
  RenderMessageSchema,
  AttrsMessageSchema,
])

/** @public */
export type UiProjectionControllerMessage = z.output<typeof UiProjectionControllerMessageSchema>

/** @public */
export const UiRenderRequestedEventSchema = z.object({
  type: z.literal('ui.render_requested'),
  detail: UiProjectionDetailSchema.extend({
    controllerMessage: RenderMessageSchema,
  }),
})

/** @public */
export type UiRenderRequestedEvent = z.output<typeof UiRenderRequestedEventSchema>

/** @public */
export const UiAttrsRequestedEventSchema = z.object({
  type: z.literal('ui.attrs_requested'),
  detail: UiProjectionDetailSchema.extend({
    controllerMessage: AttrsMessageSchema,
  }),
})

/** @public */
export type UiAttrsRequestedEvent = z.output<typeof UiAttrsRequestedEventSchema>

/** @public */
export const UiControllerMessageSentEventSchema = z.object({
  type: z.literal('ui.controller_message_sent'),
  detail: UiProjectionDetailSchema.extend({
    controllerMessage: ServerMessageSchema,
  }),
})

/** @public */
export type UiControllerMessageSentEvent = z.output<typeof UiControllerMessageSentEventSchema>

/** @public */
export const UiControllerMessageErrorEventSchema = z.object({
  type: z.literal('ui.controller_message_error'),
  detail: UiProjectionDetailSchema.extend({
    controllerMessage: ServerMessageSchema,
    error: z.string(),
  }),
})

/** @public */
export type UiControllerMessageErrorEvent = z.output<typeof UiControllerMessageErrorEventSchema>

/** @public */
export const UiPageRenderRequestedEventSchema = z.object({
  type: z.literal('ui.page_render_requested'),
  detail: UiProjectionDetailSchema,
})

/** @public */
export type UiPageRenderRequestedEvent = z.output<typeof UiPageRenderRequestedEventSchema>

/** @public */
export const UiPageRenderedEventSchema = z.object({
  type: z.literal('ui.page_rendered'),
  detail: UiProjectionDetailSchema.extend({
    html: z.string(),
  }),
})

/** @public */
export type UiPageRenderedEvent = z.output<typeof UiPageRenderedEventSchema>

/** @public */
export const UiProjectionEventSchema = z.discriminatedUnion('type', [
  UiRenderRequestedEventSchema,
  UiAttrsRequestedEventSchema,
  UiControllerMessageSentEventSchema,
  UiControllerMessageErrorEventSchema,
  UiPageRenderRequestedEventSchema,
  UiPageRenderedEventSchema,
])

/** @public */
export type UiProjectionEvent = z.output<typeof UiProjectionEventSchema>

/** @public */
export const TopicViewStateSchema = z.object({
  topic: z.string().min(1),
  version: z.number().int().nonnegative(),
  intended: z.object({
    controllerMessages: z.array(UiProjectionControllerMessageSchema),
  }),
  inputs: UiProjectionInputsSchema.optional(),
  page: z
    .object({
      version: z.number().int().positive(),
      html: z.string(),
    })
    .optional(),
  lastSent: z
    .object({
      version: z.number().int().positive(),
      controllerMessage: ServerMessageSchema,
    })
    .optional(),
  lastError: z
    .object({
      version: z.number().int().positive(),
      controllerMessage: ServerMessageSchema,
      error: z.string(),
    })
    .optional(),
})

/** @public */
export type TopicViewState = z.output<typeof TopicViewStateSchema>

/** @public */
export const UiProjectionStateSchema = z.object({
  topicViewState: z.record(z.string(), TopicViewStateSchema),
})

/** @public */
export type UiProjectionState = z.output<typeof UiProjectionStateSchema>
