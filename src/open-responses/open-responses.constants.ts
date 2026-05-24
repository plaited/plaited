import { keyMirror } from '../utils.ts'

/**
 * Behavioral event types for the Open Responses client protocol.
 *
 * @remarks
 * Mapping from SSE event type (dot notation) to behavioral event type (underscore):
 * `response.output_text.delta` → `response_output_text_delta`
 *
 * Events prefixed with `response_` originate from the provider's SSE stream.
 * `tool_result` is an internal event for the agent to submit tool output back.
 *
 * @public
 */
export const OPEN_RESPONSES_EVENTS = keyMirror(
  // Agent input commands
  'response_create',
  'tool_result',

  // SSE streaming events (converted from dot notation)
  'response_created',
  'response_in_progress',
  'response_output_item_added',
  'response_output_item_done',
  'response_content_part_added',
  'response_content_part_done',
  'response_output_text_delta',
  'response_output_text_done',
  'response_function_call_arguments_delta',
  'response_function_call_arguments_done',
  'response_completed',
  'response_failed',
  'response_incomplete',
  'response_refusal_delta',
  'response_refusal_done',
)
