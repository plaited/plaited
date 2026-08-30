import type { JsonObject } from '../main/behavioral.schemas.ts'
import type { AddHandler, AddThread, Trigger } from '../main/behavioral.types.ts'
import type {
  FunctionCallItem,
  InputItem,
  OpenResponsesRequest,
  OpenResponsesStreamEvent,
} from './open-responses.schemas.ts'
import type { Adapter } from './use-response.ts'

/**
 * The unscoped behavioral hooks the agent harness receives at registration time.
 * Each hook is already partially-applied with no space (root scope).
 */
export type AgentHooks = {
  useAddThread: AddThread
  useAddHandler: AddHandler
  useTrigger: Trigger
}

/**
 * Register the agent loop's threads and handlers against the given hooks + adapter.
 *
 * - **Loop thread**: coordinates the turn cycle — wait for prompt → request respond →
 *   wait for terminal event → loop. No `once`.
 * - **Respond handler**: assembles the full {@link OpenResponsesRequest} from the items
 *   store, calls `adapter.respond()`, and triggers each stream event **verbatim** as a
 *   b-event (spec event types in traces, zero `llm.*` vocabulary). After the stream
 *   completes, pending function-call items are dispatched as tool events.
 * - **Stop-condition thread** (once): on `response.completed` → requests `turn.end`.
 * - **Compaction thread**: gates the next `respond` behind a compaction cycle when
 *   `context.threshold` fires (detected by the respond handler when
 *   `usage.input_tokens >= adapter.contextWindow`).
 *
 * @param hooks - The behavioral program's unscoped hooks.
 * @param adapter - The provider adapter driving the model stream.
 */
export const registerAgentThreads = (hooks: AgentHooks, adapter: Adapter): void => {
  const { useAddThread, useAddHandler, useTrigger } = hooks

  // ----------------------------------------------------------------
  // Items store — handler-owned state
  // ----------------------------------------------------------------
  /** Accumulated conversation items sent as `input` on each request. */
  let items: InputItem[] = []
  /** The most recent user prompt, consumed by the respond handler. */
  let currentPrompt: string | null = null
  /** The last request assembled — used by the compaction handler to re-invoke compact. */
  let lastRequest: OpenResponsesRequest | undefined

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  /**
   * Strip the `type` field from a stream event, returning the remainder as `detail`.
   * The engine's `trigger` accepts `{ type: string, detail?: JsonObject }`.
   */
  const extractDetail = (event: OpenResponsesStreamEvent): JsonObject => {
    const { type: _type, ...rest } = event as unknown as Record<string, unknown>
    return rest as unknown as JsonObject
  }

  /**
   * Returns `true` when an event is one of the three terminal response events.
   */
  const isTerminalEvent = (event: { type: string }): boolean =>
    event.type === 'response.completed' || event.type === 'response.failed' || event.type === 'response.incomplete'

  /**
   * Extract token-usage from a terminal event, if present.
   */
  const getUsage = (
    event: OpenResponsesStreamEvent,
  ): { input_tokens: number; output_tokens: number; total_tokens: number } | undefined => {
    if (!isTerminalEvent(event)) return undefined
    const detail = extractDetail(event) as Record<string, unknown>
    return detail.usage as { input_tokens: number; output_tokens: number; total_tokens: number } | undefined
  }

  // ----------------------------------------------------------------
  // Handler: user.prompt — capture the prompt text
  // ----------------------------------------------------------------
  useAddHandler('user.prompt', ({ detail }) => {
    const { prompt } = (detail ?? {}) as { prompt: string }
    currentPrompt = prompt
  })

  // ----------------------------------------------------------------
  // Handler: respond — assemble request, stream events, dispatch tool calls,
  //            detect compaction threshold
  // ----------------------------------------------------------------
  useAddHandler('respond', async () => {
    if (!currentPrompt) return

    const request: OpenResponsesRequest = {
      model: { provider: adapter.provider, modelId: 'model' },
      input: [...items, { type: 'message', role: 'user', content: currentPrompt }],
      truncation: 'disabled',
    }
    currentPrompt = null // consumed

    // MINIMAL: single modelId placeholder. Upgrade path: derive from
    // adapter metadata or a dedicated model-selection handler.
    lastRequest = request

    const stream = await adapter.respond(request)
    const pendingCalls: Array<{ name: string; call_id: string; arguments: string }> = []

    for await (const event of stream) {
      // Trigger each stream event verbatim — spec event types in traces.
      useTrigger({ type: event.type, detail: extractDetail(event) })

      // Collect function_call items for later dispatch.
      if (
        event.type === 'response.output_item.done' &&
        'item' in event &&
        (event as unknown as { item: { type: string } }).item.type === 'function_call'
      ) {
        const item = (event as unknown as { item: FunctionCallItem }).item
        pendingCalls.push({
          name: item.name,
          call_id: item.call_id,
          arguments: item.arguments,
        })
      }

      // Check compaction threshold on terminal events.
      if (isTerminalEvent(event)) {
        const usage = getUsage(event)
        if (usage && adapter.contextWindow !== undefined && usage.input_tokens >= adapter.contextWindow) {
          useTrigger({ type: 'context.threshold', detail: { usage } })
        }
      }
    }

    // After stream completion, dispatch each pending function call as a tool event.
    // MINIMAL: sequential dispatch. Upgrade path: parallel tool dispatch with
    //   a thread that tracks outstanding call_ids.
    for (const call of pendingCalls) {
      useTrigger({ type: call.name, detail: { call_id: call.call_id, arguments: call.arguments } })
    }
  })

  // ----------------------------------------------------------------
  // Handler: tool.result — append to items store, continue the turn
  // ----------------------------------------------------------------
  //
  // Tool harnesses (wired per tool) produce `<tool name>_result` for trace
  // visibility AND `tool.result` for the items-store integration below.
  // This avoids the engine's exact-type matching limitation while keeping
  // spec event types in traces.
  //
  // MINIMAL: single generic handler. Upgrade path: per-tool handlers
  // registered via useTool (Phase 2) that can validate call_id matching
  // through detailSchema.
  useAddHandler('tool.result', ({ detail }) => {
    const { call_id, output } = (detail ?? {}) as { call_id: string; output: string }
    items.push({ type: 'function_call_output', call_id, output })
    // Continue the turn by re-triggering respond with the updated items.
    useTrigger({ type: 'respond' })
  })

  // ----------------------------------------------------------------
  // Handler: compaction.start — compact the conversation, reset items
  // ----------------------------------------------------------------
  useAddHandler('compaction.start', async () => {
    const req = lastRequest
    if (!req) return

    if (adapter.compact) {
      const compacted = await adapter.compact(req)
      items = [
        // MINIMAL: summary-based compaction — the adapter's compact result
        //   replaces the full history. Upgrade path: preserve selected messages
        //   alongside the compaction item per the Open Responses spec.
        { type: 'message', role: 'user', content: compacted.encrypted_content },
      ]
    } else {
      // Synthesize a minimal compaction: keep only the system prompt and last turn.
      // MINIMAL: naive truncation — keep first + last message. Upgrade path:
      //   content-aware summarization via a model call.
      const systemMessages = items.filter((item) => 'role' in item && item.role === 'system')
      const lastTurn = items.slice(-2).filter((item): item is InputItem & { role: string } => 'role' in item)
      items = [...systemMessages, ...lastTurn]
    }
    useTrigger({ type: 'compaction.done' })
  })

  // ----------------------------------------------------------------
  // Thread: turn loop (looping)
  //   Coordinates the prompt → respond → terminal cycle.
  // ----------------------------------------------------------------
  useAddThread({
    label: 'turn-loop',
    rules: [
      { waitFor: [{ type: 'user.prompt' }, { type: 'respond' }], interrupt: [{ type: 'cancel' }] },
      { request: { type: 'respond' }, interrupt: [{ type: 'cancel' }] },
      {
        waitFor: [{ type: 'response.completed' }, { type: 'response.failed' }, { type: 'response.incomplete' }],
        interrupt: [{ type: 'cancel' }],
      },
    ],
  })

  // ----------------------------------------------------------------
  // Thread: stop condition (once)
  //   On `response.completed` → request `turn.end` so the harness
  //   knows the turn is done. Failed / incomplete keep the loop alive.
  // ----------------------------------------------------------------
  useAddThread({
    label: 'stop-condition',
    once: true,
    rules: [{ waitFor: [{ type: 'response.completed' }] }, { request: { type: 'turn.end' } }],
  })

  // ----------------------------------------------------------------
  // Thread: compaction gate (looping)
  //   When `context.threshold` fires, block `respond` while compacting.
  //   The compaction handler calls adapter.compact (or synthesizes) and
  //   triggers `compaction.done` — which unblocks `respond`.
  // ----------------------------------------------------------------
  useAddThread({
    label: 'compaction-gate',
    rules: [
      { waitFor: [{ type: 'context.threshold' }] },
      { request: { type: 'compaction.start' } },
      { block: [{ type: 'respond' }], waitFor: [{ type: 'compaction.done' }] },
    ],
  })
}
