import { AGENT_CORE_EVENTS, AGENT_EVENTS } from '../agent/agent.constants.ts'
import type { ModelDelta, ModelResponseDetail } from '../agent/agent.types.ts'
import { parseModelResponse } from '../agent/openai-compat.ts'
import type { InferenceFactoryCreator } from './factories.types.ts'

const DEFAULT_TIMEOUT_MS = 120_000
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_INITIAL_RETRY_DELAY_MS = 1_000
const INFERENCE_ABORT_KEY = '__inference__'
const INFERENCE_EVENTS = {
  thinking_delta: 'factory_inference_thinking_delta',
  text_delta: 'factory_inference_text_delta',
  toolcall_delta: 'factory_inference_toolcall_delta',
  done: 'factory_inference_done',
  error: 'factory_inference_error',
} as const

type InferenceRunState = {
  thinking: string
  text: string
  toolCalls: Map<string, { id: string; name: string; arguments: string }>
}

const createInferenceRunState = (): InferenceRunState => ({
  thinking: '',
  text: '',
  toolCalls: new Map<string, { id: string; name: string; arguments: string }>(),
})

const createParsedModelResponse = (state: InferenceRunState) =>
  parseModelResponse({
    choices: [
      {
        message: {
          content: state.text || null,
          reasoning_content: state.thinking || null,
          tool_calls:
            state.toolCalls.size > 0
              ? [...state.toolCalls.values()].map((toolCall) => ({
                  id: toolCall.id,
                  function: {
                    name: toolCall.name,
                    arguments: toolCall.arguments,
                  },
                }))
              : undefined,
        },
      },
    ],
  })

const applyToolCallDelta = ({
  state,
  detail,
}: {
  state: InferenceRunState
  detail: Extract<ModelDelta, { type: 'toolcall_delta' }>
}) => {
  const existing = state.toolCalls.get(detail.id)
  if (!existing) {
    state.toolCalls.set(detail.id, {
      id: detail.id,
      name: detail.name ?? '',
      arguments: detail.arguments ?? '',
    })
    return
  }

  if (detail.arguments) {
    existing.arguments += detail.arguments
  }
}

const triggerInferenceLifecycleEvent = ({
  trigger,
  delta,
}: {
  trigger: (event: { type: string; detail?: unknown }) => void
  delta: ModelDelta
}) => {
  if (delta.type === 'thinking_delta') {
    trigger({
      type: INFERENCE_EVENTS.thinking_delta,
      detail: delta,
    })
    return
  }

  if (delta.type === 'text_delta') {
    trigger({
      type: INFERENCE_EVENTS.text_delta,
      detail: delta,
    })
    return
  }

  if (delta.type === 'toolcall_delta') {
    trigger({
      type: INFERENCE_EVENTS.toolcall_delta,
      detail: delta,
    })
    return
  }

  if (delta.type === 'done') {
    trigger({
      type: INFERENCE_EVENTS.done,
      detail: delta,
    })
    return
  }

  trigger({
    type: INFERENCE_EVENTS.error,
    detail: delta,
  })
}

/**
 * Creates the first default inference factory promoted out of the legacy loop.
 *
 * @remarks
 * This factory exposes the inference lifecycle through explicit intermediate
 * events instead of packing the full control flow into one handler.
 *
 * @public
 */
export const createInferenceFactory: InferenceFactoryCreator = ({
  model,
  tools = [],
  buildContext,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  temperature = 0,
  maxRetries = DEFAULT_MAX_RETRIES,
  initialRetryDelayMs = DEFAULT_INITIAL_RETRY_DELAY_MS,
}) => {
  let inferenceRetryCount = 0
  let currentRun = createInferenceRunState()
  const abortControllers = new Map<string, AbortController>()

  return ({ trigger }) => ({
    handlers: {
      async [AGENT_EVENTS.invoke_inference]() {
        const controller = new AbortController()
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)])
        abortControllers.set(INFERENCE_ABORT_KEY, controller)
        currentRun = createInferenceRunState()

        try {
          const { messages } = buildContext()
          for await (const delta of model.reason({ messages, tools, temperature, signal })) {
            if (signal.aborted) {
              break
            }

            triggerInferenceLifecycleEvent({
              trigger,
              delta,
            })
          }
        } catch (error) {
          trigger({
            type: INFERENCE_EVENTS.error,
            detail: {
              type: 'error',
              error: error instanceof Error ? error.message : String(error),
            } satisfies Extract<ModelDelta, { type: 'error' }>,
          })
        } finally {
          abortControllers.delete(INFERENCE_ABORT_KEY)
        }
      },

      [INFERENCE_EVENTS.thinking_delta](detail: unknown) {
        const delta = detail as Extract<ModelDelta, { type: 'thinking_delta' }>
        currentRun.thinking += delta.content
        trigger({ type: AGENT_EVENTS.thinking_delta, detail: { content: delta.content } })
      },

      [INFERENCE_EVENTS.text_delta](detail: unknown) {
        const delta = detail as Extract<ModelDelta, { type: 'text_delta' }>
        currentRun.text += delta.content
        trigger({ type: AGENT_EVENTS.text_delta, detail: { content: delta.content } })
      },

      [INFERENCE_EVENTS.toolcall_delta](detail: unknown) {
        applyToolCallDelta({
          state: currentRun,
          detail: detail as Extract<ModelDelta, { type: 'toolcall_delta' }>,
        })
      },

      [INFERENCE_EVENTS.done](detail: unknown) {
        const delta = detail as Extract<ModelDelta, { type: 'done' }>
        inferenceRetryCount = 0
        const parsed = createParsedModelResponse(currentRun)
        const responseDetail: ModelResponseDetail = {
          parsed,
          usage: delta.response.usage,
        }
        trigger({ type: AGENT_EVENTS.model_response, detail: responseDetail })
      },

      [INFERENCE_EVENTS.error](detail: unknown) {
        const delta = detail as Extract<ModelDelta, { type: 'error' }>
        trigger({
          type: AGENT_EVENTS.inference_error,
          detail: { error: delta.error, retryable: false },
        })
      },

      async [AGENT_EVENTS.inference_error](detail: unknown) {
        const { error, retryable } = detail as { error: string; retryable: boolean }

        if (retryable && inferenceRetryCount < maxRetries) {
          inferenceRetryCount++
          const delayMs = Math.min(initialRetryDelayMs * 2 ** (inferenceRetryCount - 1), 16_000)
          await Bun.sleep(delayMs)
          trigger({ type: AGENT_EVENTS.invoke_inference })
          return
        }

        inferenceRetryCount = 0
        trigger({
          type: AGENT_EVENTS.message,
          detail: { content: `Inference error: ${error}` },
        })
      },

      [AGENT_CORE_EVENTS.agent_disconnect]() {
        for (const controller of abortControllers.values()) {
          controller.abort()
        }
        abortControllers.clear()
      },
    },
  })
}
