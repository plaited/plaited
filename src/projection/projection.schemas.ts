import * as z from 'zod'

import { AttrsMessageSchema, RenderMessageSchema, ServerMessageSchema } from '../ui.ts'
import { UI_PROJECTION_EVENTS } from './projection.constants.ts'

/**
 * Identifies the upstream content that shaped a UI projection request.
 *
 * @remarks
 * Projection events carry these optional references so replay consumers can
 * correlate a topic version with the model refs or content hashes that
 * produced it.
 *
 * @public
 */
export const UiProjectionInputsSchema = z.object({
  refs: z.array(z.string()).optional(),
  hashes: z.array(z.string()).optional(),
})

/**
 * Upstream refs and hashes associated with a projected topic version.
 *
 * @public
 */
export type UiProjectionInputs = z.output<typeof UiProjectionInputsSchema>

const UiProjectionDetailSchema = z.object({
  topic: z.string().min(1),
  version: z.number().int().positive(),
  inputs: UiProjectionInputsSchema.optional(),
})

/**
 * Controller messages that can be preserved as intended projection state.
 *
 * @remarks
 * The projection journal stores render and attrs messages for reconnect. Other
 * server messages can still appear in sent or error events, but they are not
 * replayed as the desired controller state.
 *
 * @public
 */
export const UiProjectionControllerMessageSchema = z.discriminatedUnion('type', [
  RenderMessageSchema,
  AttrsMessageSchema,
])

/**
 * Render or attrs controller message retained for reconnect replay.
 *
 * @public
 */
export type UiProjectionControllerMessage = z.output<typeof UiProjectionControllerMessageSchema>

/**
 * Records that a render controller message is now intended for a topic version.
 *
 * @public
 */
export const UiRenderRequestedEventSchema = z.object({
  type: z.literal(UI_PROJECTION_EVENTS.ui_render_requested),
  detail: UiProjectionDetailSchema.extend({
    controllerMessage: RenderMessageSchema,
  }),
})

/**
 * Event payload for a desired render update in the projection journal.
 *
 * @public
 */
export type UiRenderRequestedEvent = z.output<typeof UiRenderRequestedEventSchema>

/**
 * Records that an attrs controller message is now intended for a topic version.
 *
 * @public
 */
export const UiAttrsRequestedEventSchema = z.object({
  type: z.literal(UI_PROJECTION_EVENTS.ui_attrs_requested),
  detail: UiProjectionDetailSchema.extend({
    controllerMessage: AttrsMessageSchema,
  }),
})

/**
 * Event payload for a desired attrs update in the projection journal.
 *
 * @public
 */
export type UiAttrsRequestedEvent = z.output<typeof UiAttrsRequestedEventSchema>

/**
 * Records a controller message that was delivered for a topic version.
 *
 * @public
 */
export const UiControllerMessageSentEventSchema = z.object({
  type: z.literal(UI_PROJECTION_EVENTS.ui_controller_message_sent),
  detail: UiProjectionDetailSchema.extend({
    controllerMessage: ServerMessageSchema,
  }),
})

/**
 * Event payload for the latest successfully delivered controller message.
 *
 * @public
 */
export type UiControllerMessageSentEvent = z.output<typeof UiControllerMessageSentEventSchema>

/**
 * Records a controller message delivery failure for a topic version.
 *
 * @public
 */
export const UiControllerMessageErrorEventSchema = z.object({
  type: z.literal(UI_PROJECTION_EVENTS.ui_controller_message_error),
  detail: UiProjectionDetailSchema.extend({
    controllerMessage: ServerMessageSchema,
    error: z.string(),
  }),
})

/**
 * Event payload for the latest controller message delivery error.
 *
 * @public
 */
export type UiControllerMessageErrorEvent = z.output<typeof UiControllerMessageErrorEventSchema>

/**
 * Records that a server-rendered page is requested for a topic version.
 *
 * @public
 */
export const UiPageRenderRequestedEventSchema = z.object({
  type: z.literal(UI_PROJECTION_EVENTS.ui_page_render_requested),
  detail: UiProjectionDetailSchema,
})

/**
 * Event payload for a desired page render update.
 *
 * @public
 */
export type UiPageRenderRequestedEvent = z.output<typeof UiPageRenderRequestedEventSchema>

/**
 * Records the server-rendered HTML produced for a topic version.
 *
 * @public
 */
export const UiPageRenderedEventSchema = z.object({
  type: z.literal(UI_PROJECTION_EVENTS.ui_page_rendered),
  detail: UiProjectionDetailSchema.extend({
    html: z.string(),
  }),
})

/**
 * Event payload for the latest rendered page HTML for a topic.
 *
 * @public
 */
export type UiPageRenderedEvent = z.output<typeof UiPageRenderedEventSchema>

/**
 * Replayable event union accepted by the UI projection reducer.
 *
 * @public
 */
export const UiProjectionEventSchema = z.discriminatedUnion('type', [
  UiRenderRequestedEventSchema,
  UiAttrsRequestedEventSchema,
  UiControllerMessageSentEventSchema,
  UiControllerMessageErrorEventSchema,
  UiPageRenderRequestedEventSchema,
  UiPageRenderedEventSchema,
])

/**
 * Projection journal event for intended, delivered, failed, or rendered UI state.
 *
 * @public
 */
export type UiProjectionEvent = z.output<typeof UiProjectionEventSchema>

/**
 * Per-topic projection state reconstructed from replayed projection events.
 *
 * @remarks
 * The state keeps the current requested version, reconnectable controller
 * messages, optional source inputs, latest page HTML, and the latest delivery
 * outcome for diagnostics.
 *
 * @public
 */
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

/**
 * Replayed UI state for a single controller topic.
 *
 * @public
 */
export type TopicViewState = z.output<typeof TopicViewStateSchema>

/**
 * Root UI projection state indexed by topic.
 *
 * @public
 */
export const UiProjectionStateSchema = z.object({
  topicViewState: z.record(z.string(), TopicViewStateSchema),
})

/**
 * Replayed projection journal state for all tracked topics.
 *
 * @public
 */
export type UiProjectionState = z.output<typeof UiProjectionStateSchema>
