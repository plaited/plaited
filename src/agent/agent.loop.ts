/**
 * createAgentLoop — 6-step BP-orchestrated agent pipeline.
 *
 * @remarks
 * Wires all standalone handler functions (simulate, evaluate, gate check,
 * context assembly, memory, snapshot) into a single `behavioral()` instance.
 *
 * Architecture principles (CLAUDE.md):
 * - Pipeline pass-through > conditional bypass (always create batchCompletion)
 * - Thin handlers, structural coordination
 * - Per-call dynamic threads (sim_guard_{id})
 * - Register once (all useFeedback handlers set at creation)
 * - Additive composition (constitution threads compose independently)
 *
 * @public
 */

import { join } from 'node:path'
import { behavioral } from '../behavioral/behavioral.ts'
import type { DefaultHandlers, Trigger } from '../behavioral/behavioral.types.ts'
import { bSync, bThread } from '../behavioral/behavioral.utils.ts'
import { UI_ADAPTER_LIFECYCLE_EVENTS } from '../events.ts'
import type { SessionMeta } from '../tools/hypergraph.utils.ts'
import { AGENT_EVENTS, RISK_TAG } from './agent.constants.ts'
import {
  type ContextContributor,
  createContextAssembler,
  createSessionSummaryContributor,
  historyContributor,
  planContributor,
  rejectionContributor,
  type SessionSummaryContributor,
  systemPromptContributor,
  toolsContributor,
  trimHistory,
} from './agent.context.ts'
import { evaluate } from './agent.evaluate.ts'
import type { ConstitutionFactory, GoalFactory } from './agent.factories.ts'
import { type ConstitutionPredicate, composedGateCheck } from './agent.gate.ts'
import { isEtcWrite, isForcePush, isGovernanceModification, isRmRf } from './agent.governance.ts'
import type { ToolDefinition } from './agent.schemas.ts'
import { simulate } from './agent.simulate.ts'
import type {
  AgentNode,
  ChatMessage,
  ConsolidateDetail,
  ContextReadyDetail,
  EvalApprovedDetail,
  EvalRejectedDetail,
  ExecuteDetail,
  GateApprovedDetail,
  GateRejectedDetail,
  Indexer,
  InferenceErrorDetail,
  MessageDetail,
  Model,
  ModelResponseDetail,
  SensorDeltaDetail,
  SensorFactory,
  SimulateRequestDetail,
  SimulationResultDetail,
  TaskDetail,
  ToolExecutor,
  ToolResultDetail,
} from './agent.types.ts'
import { mark, parseModelResponse, printTimings, toToolResult } from './agent.utils.ts'
import { createMemoryHandlers } from './memory-handlers.ts'
import { createHeartbeatTimer, createSensorBatchThread, createTickYieldThread } from './proactive.ts'
import { createSnapshotWriter } from './snapshot-writer.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Options for {@link createAgentLoop}.
 *
 * @public
 */
export type CreateAgentLoopOptions = {
  model: Model
  tools: ToolDefinition[]
  toolExecutor: ToolExecutor
  constitution?: ConstitutionFactory[]
  goals?: GoalFactory[]
  memoryPath: string
  sessionId?: string
  contextBudget?: number
  embedder?: Indexer
  systemPrompt?: string
  maxIterations?: number
  /** Opt-in proactive mode: heartbeat timer + sensor sweep */
  proactive?: {
    /** Heartbeat interval in ms (default: 900_000 = 15 min) */
    intervalMs?: number
    /** Sensor factories to run on each tick (default: []) */
    sensors?: SensorFactory[]
  }
}

// ============================================================================
// Pipeline event set — used by taskGate and sessionGate
// ============================================================================

const PIPELINE_EVENTS: Set<string> = new Set([
  AGENT_EVENTS.invoke_inference,
  AGENT_EVENTS.model_response,
  AGENT_EVENTS.context_ready,
  AGENT_EVENTS.gate_approved,
  AGENT_EVENTS.gate_rejected,
  AGENT_EVENTS.simulate_request,
  AGENT_EVENTS.simulation_result,
  AGENT_EVENTS.eval_approved,
  AGENT_EVENTS.eval_rejected,
  AGENT_EVENTS.execute,
  AGENT_EVENTS.tool_result,
  AGENT_EVENTS.save_plan,
  AGENT_EVENTS.plan_saved,
])

// ============================================================================
// Default constitution predicates — mirror MAC factory blocks at gate level
// ============================================================================

const DEFAULT_CONSTITUTION_PREDICATES: ConstitutionPredicate[] = [
  { name: 'noRmRf', check: isRmRf },
  { name: 'noEtcWrites', check: isEtcWrite },
  { name: 'noForcePush', check: isForcePush },
  { name: 'protectGovernance', check: isGovernanceModification },
]

// ============================================================================
// Completion event predicate — used by batchCompletion bThread
// ============================================================================

const isCompletionEvent = (e: { type: string }) =>
  e.type === AGENT_EVENTS.tool_result || e.type === AGENT_EVENTS.gate_rejected || e.type === AGENT_EVENTS.eval_rejected

// ============================================================================
// createAgentLoop
// ============================================================================

/**
 * Load session meta.jsonld if it exists on disk.
 *
 * @internal
 */
const loadSessionMeta = async (memoryPath: string, sessionId: string): Promise<SessionMeta | null> => {
  const metaPath = join(memoryPath, 'sessions', sessionId, 'meta.jsonld')
  const file = Bun.file(metaPath)
  if (!(await file.exists())) return null
  return (await file.json()) as SessionMeta
}

/**
 * Creates a BP-orchestrated agent loop implementing the 6-step pipeline.
 *
 * @remarks
 * The loop is: task → invoke_inference → model_response → context_ready
 * → gate → (simulate → evaluate) → execute → tool_result → (repeat) → message.
 *
 * All handlers are registered once at creation (principle 6). Per-task
 * coordination uses dynamic bThreads (maxIterations, batchCompletion,
 * sim_guard) that self-terminate via interrupt.
 *
 * Async because it loads the session's `meta.jsonld` (warm layer) at startup.
 *
 * @param options - Agent loop configuration
 * @returns {@link AgentNode} with restricted trigger, subscribe, snapshot, destroy
 *
 * @public
 */
export const createAgentLoop = async ({
  model,
  tools,
  toolExecutor,
  constitution = [],
  goals = [],
  memoryPath,
  sessionId = crypto.randomUUID(),
  contextBudget = 128_000,
  embedder,
  systemPrompt = 'You are a helpful assistant.',
  maxIterations = 50,
  proactive,
}: CreateAgentLoopOptions): Promise<AgentNode> => {
  // ── BP engine ───────────────────────────────────────────────────────────
  mark('createAgentLoop:start')
  const { bThreads, trigger, useFeedback, useSnapshot, useRestrictedTrigger } = behavioral()
  mark('bp-engine')

  // ── Shared state ────────────────────────────────────────────────────────
  const history: ChatMessage[] = []
  const priorRejections: string[] = []
  let currentGoal = ''
  const abortControllers = new Map<string, AbortController>()
  const INFERENCE_ABORT_KEY = '__inference__'
  const MAX_INFERENCE_RETRIES = 3
  let inferenceRetryCount = 0
  /** Tracks whether current pipeline cycle was triggered by a tick (proactive) or task (reactive) */
  let isProactiveCycle = false

  // ── Warm layer: load session meta for context orientation ──────────────
  const initialMeta = await loadSessionMeta(memoryPath, sessionId)
  const sessionSummary: SessionSummaryContributor = createSessionSummaryContributor(initialMeta)

  // ── Context assembler ───────────────────────────────────────────────────
  const contributors: ContextContributor[] = [
    systemPromptContributor(systemPrompt),
    rejectionContributor,
    sessionSummary,
    toolsContributor,
    planContributor,
    historyContributor,
  ]
  const assemble = createContextAssembler(contributors)

  // ── Memory handlers (registered once) ───────────────────────────────────
  mark('context-assembler')
  const memoryHandlers = createMemoryHandlers({
    trigger,
    memoryPath,
    sessionId,
    embedder,
  })

  // ── Snapshot writer ─────────────────────────────────────────────────────
  mark('memory-handlers')
  const snapshotWriter = createSnapshotWriter({
    sessionId,
    memoryPath,
    memoryHandlers,
  })
  useSnapshot(snapshotWriter)
  mark('snapshot-writer')

  // ── Structural bThreads ─────────────────────────────────────────────────

  bThreads.set({
    // Session gate: blocks everything until client connects
    sessionGate: bThread(
      [
        bSync({
          waitFor: UI_ADAPTER_LIFECYCLE_EVENTS.client_connected,
          block: (e) => PIPELINE_EVENTS.has(e.type) || e.type === AGENT_EVENTS.task,
        }),
        bSync({ waitFor: UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected }),
      ],
      true,
    ),

    // Task gate: blocks pipeline events between tasks (serial execution)
    // When proactive is enabled, also accepts tick events to start proactive cycles
    // Phase 2 blocks ticks to prevent concurrent cycles during active pipeline
    taskGate: bThread(
      [
        bSync({
          waitFor: proactive
            ? (e) => e.type === AGENT_EVENTS.task || e.type === AGENT_EVENTS.tick
            : AGENT_EVENTS.task,
          block: (e) => PIPELINE_EVENTS.has(e.type),
          interrupt: [UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected],
        }),
        bSync({
          waitFor: AGENT_EVENTS.message,
          interrupt: [UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected],
          ...(proactive ? { block: AGENT_EVENTS.tick } : {}),
        }),
      ],
      true,
    ),

    // Tick yield: ensures user tasks interrupt proactive cycles (only when proactive)
    ...(proactive
      ? { tickYield: createTickYieldThread() }
      : {}),
  })

  // ── Constitution bThreads ───────────────────────────────────────────────
  mark('structural-bthreads')
  for (const factory of constitution) {
    const { threads, handlers } = factory.create(trigger)
    if (threads) bThreads.set(threads)
    if (handlers) useFeedback(handlers)
  }

  // ── Goal bThreads ──────────────────────────────────────────────────────
  mark('constitution')
  for (const factory of goals) {
    const { threads, handlers } = factory.create(trigger)
    if (threads) bThreads.set(threads)
    if (handlers) useFeedback(handlers)
  }

  // ── Pipeline handlers (registered once — principle 6) ───────────────────
  mark('goals')

  useFeedback({
    // ── task ──────────────────────────────────────────────────────────────
    [AGENT_EVENTS.task](detail: unknown) {
      const { prompt } = detail as TaskDetail
      currentGoal = prompt
      isProactiveCycle = false

      // Add user message to history
      history.push({ role: 'user', content: prompt })

      // Per-task maxIterations bThread
      bThreads.set({
        maxIterations: bThread([
          ...Array.from({ length: maxIterations }, () =>
            bSync({ waitFor: AGENT_EVENTS.tool_result, interrupt: [AGENT_EVENTS.message] }),
          ),
          bSync({
            block: AGENT_EVENTS.execute,
            request: { type: AGENT_EVENTS.message, detail: { content: `Max iterations (${maxIterations}) reached` } },
            interrupt: [AGENT_EVENTS.message],
          }),
        ]),
      })

      // Trigger inference
      trigger({ type: AGENT_EVENTS.invoke_inference })
    },

    // ── tick (proactive heartbeat) ───────────────────────────────────────
    ...(proactive
      ? {
          async [AGENT_EVENTS.tick](_detail: unknown) {
            isProactiveCycle = true
            const sensors = proactive.sensors ?? []

            // Per-tick maxIterations (same safety limit as tasks)
            bThreads.set({
              maxIterations: bThread([
                ...Array.from({ length: maxIterations }, () =>
                  bSync({ waitFor: AGENT_EVENTS.tool_result, interrupt: [AGENT_EVENTS.message] }),
                ),
                bSync({
                  block: AGENT_EVENTS.execute,
                  request: {
                    type: AGENT_EVENTS.message,
                    detail: { content: `Max iterations (${maxIterations}) reached`, source: 'proactive' as const },
                  },
                  interrupt: [AGENT_EVENTS.message],
                }),
              ]),
            })

            if (sensors.length === 0) {
              // No sensors — go straight to inference, model decides what to do
              trigger({ type: AGENT_EVENTS.invoke_inference })
              return
            }

            // Run all sensors in parallel, collect non-null deltas
            const collectedDeltas: SensorDeltaDetail[] = []
            const signal = AbortSignal.timeout(30_000)

            await Promise.all(
              sensors.map(async (sensor) => {
                try {
                  const current = await sensor.read(signal)
                  const delta = sensor.diff(current, null)
                  if (delta !== null) {
                    collectedDeltas.push({ sensor: sensor.name, delta })
                  }
                } catch {
                  // Sensor errors are non-fatal — skip this sensor
                }
              }),
            )

            if (collectedDeltas.length === 0) {
              // No changes detected — invoke inference directly
              trigger({ type: AGENT_EVENTS.invoke_inference })
              return
            }

            // bThreads.set() BEFORE trigger() — sensorBatch must be
            // present when sensor_delta events are processed
            bThreads.set({
              sensorBatch: createSensorBatchThread(collectedDeltas.length, collectedDeltas),
            })

            for (const delta of collectedDeltas) {
              trigger({
                type: AGENT_EVENTS.sensor_delta,
                detail: delta,
              })
            }
            // sensorBatch thread requests sensor_sweep after all deltas arrive
          },

          // Sensor sweep complete — trigger inference with accumulated context
          [AGENT_EVENTS.sensor_sweep](_detail: unknown) {
            trigger({ type: AGENT_EVENTS.invoke_inference })
          },
        }
      : {}),

    // ── invoke_inference ──────────────────────────────────────────────────
    async [AGENT_EVENTS.invoke_inference]() {
      const controller = new AbortController()
      abortControllers.set(INFERENCE_ABORT_KEY, controller)
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)])

      // Assemble context
      const trimmedHistory = trimHistory(history, Math.floor(contextBudget * 0.6))
      const ctx = assemble(
        {
          history: trimmedHistory,
          activeTools: tools,
          constitution: [],
          priorRejections,
        },
        contextBudget,
      )

      // Consume model stream
      const accumulated: {
        thinking: string
        text: string
        toolCalls: Map<string, { id: string; name: string; arguments: string }>
      } = {
        thinking: '',
        text: '',
        toolCalls: new Map(),
      }

      try {
        for await (const delta of model.reason({ messages: ctx.messages, tools, temperature: 0, signal })) {
          if (signal.aborted) break

          if (delta.type === 'thinking_delta') {
            accumulated.thinking += delta.content
            trigger({ type: AGENT_EVENTS.thinking_delta, detail: { content: delta.content } })
          } else if (delta.type === 'text_delta') {
            accumulated.text += delta.content
            trigger({ type: AGENT_EVENTS.text_delta, detail: { content: delta.content } })
          } else if (delta.type === 'toolcall_delta') {
            const existing = accumulated.toolCalls.get(delta.id)
            if (existing) {
              if (delta.arguments) existing.arguments += delta.arguments
            } else {
              accumulated.toolCalls.set(delta.id, {
                id: delta.id,
                name: delta.name ?? '',
                arguments: delta.arguments ?? '',
              })
            }
          } else if (delta.type === 'done') {
            // Build response in OpenAI format for parseModelResponse
            const toolCallsArr = [...accumulated.toolCalls.values()].map((tc) => ({
              id: tc.id,
              function: { name: tc.name, arguments: tc.arguments },
            }))
            const response = {
              choices: [
                {
                  message: {
                    content: accumulated.text || null,
                    reasoning_content: accumulated.thinking || null,
                    tool_calls: toolCallsArr.length > 0 ? toolCallsArr : undefined,
                  },
                },
              ],
            }
            const parsed = parseModelResponse(response)
            const detail: ModelResponseDetail = { parsed, usage: delta.response.usage }
            abortControllers.delete(INFERENCE_ABORT_KEY)
            inferenceRetryCount = 0
            trigger({ type: AGENT_EVENTS.model_response, detail })
          } else if (delta.type === 'error') {
            abortControllers.delete(INFERENCE_ABORT_KEY)
            trigger({
              type: AGENT_EVENTS.inference_error,
              detail: { error: delta.error, retryable: false },
            })
          }
        }
      } catch (error) {
        abortControllers.delete(INFERENCE_ABORT_KEY)
        const msg = error instanceof Error ? error.message : String(error)
        trigger({ type: AGENT_EVENTS.inference_error, detail: { error: msg, retryable: true } })
      }
    },

    // ── model_response ───────────────────────────────────────────────────
    [AGENT_EVENTS.model_response](detail: unknown) {
      const { parsed } = detail as ModelResponseDetail

      // Add assistant message to history
      if (parsed.toolCalls.length > 0) {
        history.push({
          role: 'assistant',
          content: parsed.message,
          tool_calls: parsed.toolCalls.map((tc) => ({
            id: tc.id,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        })
      } else if (parsed.message) {
        history.push({ role: 'assistant', content: parsed.message })
      }

      if (parsed.toolCalls.length > 0) {
        // Batch completion MUST be set before triggers — BP trigger() is synchronous
        bThreads.set({
          batchCompletion: bThread([
            ...Array.from({ length: parsed.toolCalls.length }, () =>
              bSync({ waitFor: isCompletionEvent, interrupt: [AGENT_EVENTS.message] }),
            ),
            bSync({
              request: { type: AGENT_EVENTS.invoke_inference },
              interrupt: [AGENT_EVENTS.message],
            }),
          ]),
        })

        // Per tool call → context_ready
        for (const toolCall of parsed.toolCalls) {
          trigger({ type: AGENT_EVENTS.context_ready, detail: { toolCall } satisfies ContextReadyDetail })
        }
      } else if (parsed.message) {
        // Text-only response → message (task complete)
        trigger({
          type: AGENT_EVENTS.message,
          detail: {
            content: parsed.message,
            ...(isProactiveCycle && { source: 'proactive' as const }),
          } satisfies MessageDetail,
        })
      }
    },

    // ── context_ready ────────────────────────────────────────────────────
    [AGENT_EVENTS.context_ready](detail: unknown) {
      const { toolCall } = detail as ContextReadyDetail

      // Look up tags for this tool
      const toolDef = tools.find((t) => t.function.name === toolCall.name)
      const tags = toolDef?.tags ?? []

      const result = composedGateCheck({ toolCall, tags }, DEFAULT_CONSTITUTION_PREDICATES)

      if (result.route === 'rejected') {
        trigger({
          type: AGENT_EVENTS.gate_rejected,
          detail: {
            toolCall,
            decision: { approved: false, tags: tags as GateRejectedDetail['decision']['tags'], reason: result.reason },
          } satisfies GateRejectedDetail,
        })
      } else {
        // Both 'execute' and 'simulate' routes trigger gate_approved;
        // downstream gate_approved handler routes by tags
        trigger({
          type: AGENT_EVENTS.gate_approved,
          detail: { toolCall, tags } satisfies GateApprovedDetail,
        })
      }
    },

    // ── gate_approved ────────────────────────────────────────────────────
    [AGENT_EVENTS.gate_approved](detail: unknown) {
      const { toolCall, tags } = detail as GateApprovedDetail

      const tagSet = new Set(tags)
      // Workspace-only → execute directly (skip simulation)
      if (tagSet.size > 0 && [...tagSet].every((t) => t === RISK_TAG.workspace)) {
        trigger({
          type: AGENT_EVENTS.execute,
          detail: { toolCall, tags } satisfies ExecuteDetail,
        })
        return
      }

      // Any other tags (or empty/unknown) → simulate + evaluate
      bThreads.set({
        [`sim_guard_${toolCall.id}`]: bThread([
          bSync({
            block: (e) => e.type === AGENT_EVENTS.execute && e.detail?.toolCall?.id === toolCall.id,
            interrupt: [
              (e) => e.type === AGENT_EVENTS.simulation_result && e.detail?.toolCall?.id === toolCall.id,
              AGENT_EVENTS.message,
            ],
          }),
        ]),
      })
      trigger({
        type: AGENT_EVENTS.simulate_request,
        detail: { toolCall, tags } satisfies SimulateRequestDetail,
      })
    },

    // ── gate_rejected ────────────────────────────────────────────────────
    [AGENT_EVENTS.gate_rejected](detail: unknown) {
      const { toolCall, decision } = detail as GateRejectedDetail
      const reason = decision.reason ?? 'Rejected by gate'
      history.push({
        role: 'tool',
        content: JSON.stringify({ error: reason }),
        tool_call_id: toolCall.id,
      })
      priorRejections.push(`${toolCall.name}: ${reason}`)
    },

    // ── simulate_request ─────────────────────────────────────────────────
    async [AGENT_EVENTS.simulate_request](detail: unknown) {
      const { toolCall, tags } = detail as SimulateRequestDetail

      try {
        const result = await simulate({
          toolCall,
          history,
          model,
          signal: AbortSignal.timeout(30_000),
        })

        trigger({
          type: AGENT_EVENTS.simulation_result,
          detail: {
            toolCall,
            prediction: result.predictedOutput,
            tags,
          } satisfies SimulationResultDetail,
        })
      } catch (error) {
        // Simulation failed — reject the tool call
        trigger({
          type: AGENT_EVENTS.eval_rejected,
          detail: {
            toolCall,
            reason: `Simulation failed: ${error instanceof Error ? error.message : String(error)}`,
          } satisfies EvalRejectedDetail,
        })
      }
    },

    // ── simulation_result ────────────────────────────────────────────────
    async [AGENT_EVENTS.simulation_result](detail: unknown) {
      const { toolCall, prediction, tags } = detail as SimulationResultDetail

      try {
        const result = await evaluate({
          simulatedOutput: prediction,
          goal: currentGoal,
          model,
          signal: AbortSignal.timeout(30_000),
        })

        if (result.approved) {
          trigger({
            type: AGENT_EVENTS.eval_approved,
            detail: { toolCall, tags, score: result.score } satisfies EvalApprovedDetail,
          })
        } else {
          trigger({
            type: AGENT_EVENTS.eval_rejected,
            detail: {
              toolCall,
              reason: result.reason ?? 'Evaluation rejected',
              score: result.score,
            } satisfies EvalRejectedDetail,
          })
        }
      } catch (error) {
        trigger({
          type: AGENT_EVENTS.eval_rejected,
          detail: {
            toolCall,
            reason: `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
          } satisfies EvalRejectedDetail,
        })
      }
    },

    // ── eval_approved ────────────────────────────────────────────────────
    [AGENT_EVENTS.eval_approved](detail: unknown) {
      const { toolCall, tags } = detail as EvalApprovedDetail
      trigger({
        type: AGENT_EVENTS.execute,
        detail: { toolCall, tags } satisfies ExecuteDetail,
      })
    },

    // ── eval_rejected ────────────────────────────────────────────────────
    [AGENT_EVENTS.eval_rejected](detail: unknown) {
      const { toolCall, reason } = detail as EvalRejectedDetail
      history.push({
        role: 'tool',
        content: JSON.stringify({ error: `Eval rejected: ${reason}` }),
        tool_call_id: toolCall.id,
      })
      priorRejections.push(`${toolCall.name}: ${reason}`)
    },

    // ── execute ──────────────────────────────────────────────────────────
    async [AGENT_EVENTS.execute](detail: unknown) {
      const { toolCall } = detail as ExecuteDetail
      const controller = new AbortController()
      abortControllers.set(toolCall.id, controller)

      const start = Date.now()
      try {
        const output = await toolExecutor(toolCall, controller.signal)
        const duration = Date.now() - start
        const result = toToolResult(
          toolCall,
          { toolCallId: toolCall.id, name: toolCall.name, status: 'completed', output },
          duration,
        )

        history.push({
          role: 'tool',
          content: JSON.stringify(result.output ?? result.error ?? null),
          tool_call_id: toolCall.id,
        })

        trigger({
          type: AGENT_EVENTS.tool_result,
          detail: { result } satisfies ToolResultDetail,
        })
      } catch (error) {
        const duration = Date.now() - start
        const result = toToolResult(toolCall, error, duration)

        history.push({
          role: 'tool',
          content: JSON.stringify({ error: result.error }),
          tool_call_id: toolCall.id,
        })

        trigger({
          type: AGENT_EVENTS.tool_result,
          detail: { result } satisfies ToolResultDetail,
        })
      } finally {
        abortControllers.delete(toolCall.id)
      }
    },

    // ── inference_error ────────────────────────────────────────────────
    async [AGENT_EVENTS.inference_error](detail: unknown) {
      const { error, retryable } = detail as InferenceErrorDetail

      if (retryable && inferenceRetryCount < MAX_INFERENCE_RETRIES) {
        inferenceRetryCount++
        const delayMs = Math.min(1000 * 2 ** (inferenceRetryCount - 1), 16_000)
        await Bun.sleep(delayMs)
        trigger({ type: AGENT_EVENTS.invoke_inference })
      } else {
        inferenceRetryCount = 0
        trigger({
          type: AGENT_EVENTS.message,
          detail: {
            content: `Inference error: ${error}`,
            ...(isProactiveCycle && { source: 'proactive' as const }),
          } satisfies MessageDetail,
        })
      }
    },

    // ── message ──────────────────────────────────────────────────────────
    [AGENT_EVENTS.message](_detail: unknown) {
      // Clear rejections, retry state, and proactive flag for next cycle
      priorRejections.length = 0
      inferenceRetryCount = 0
      isProactiveCycle = false
    },

    // ── memory lifecycle ─────────────────────────────────────────────────
    ...memoryHandlers,
  })

  // ── Warm layer refresh (separate registration — cannot share key with memoryHandlers)
  useFeedback({
    async [AGENT_EVENTS.consolidate](detail: unknown) {
      const { sessionId: sid, memoryPath: mPath } = detail as ConsolidateDetail
      const updatedMeta = await loadSessionMeta(mPath, sid)
      if (updatedMeta) sessionSummary.updateMeta(updatedMeta)
    },
  })

  // ── Proactive heartbeat timer (opt-in) ──────────────────────────────────
  const heartbeatHandle = proactive
    ? createHeartbeatTimer({ trigger, intervalMs: proactive.intervalMs })
    : undefined
  mark('proactive')

  // ── Timing report ──────────────────────────────────────────────────────
  mark('handler-registration')
  printTimings()

  // ── Restricted trigger for external use ────────────────────────────────
  const restrictedTrigger = useRestrictedTrigger(...Object.values(AGENT_EVENTS).filter((e) => e !== AGENT_EVENTS.task))

  // Create a trigger that allows task + lifecycle events
  const publicTrigger: Trigger = (event) => {
    if (
      event.type === AGENT_EVENTS.task ||
      event.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_connected ||
      event.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected
    ) {
      trigger(event)
    } else {
      restrictedTrigger(event)
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────
  const disconnects: Array<() => void> = []

  return {
    trigger: publicTrigger,
    subscribe: (handlers: DefaultHandlers) => {
      const disconnect = useFeedback(handlers)
      disconnects.push(disconnect)
      return disconnect
    },
    snapshot: (listener) => {
      const disconnect = useSnapshot(listener)
      disconnects.push(disconnect)
      return disconnect
    },
    destroy: () => {
      heartbeatHandle?.destroy()
      for (const controller of abortControllers.values()) {
        controller.abort()
      }
      abortControllers.clear()
      for (const disconnect of disconnects) {
        disconnect()
      }
      disconnects.length = 0
    },
    ...(heartbeatHandle && { heartbeat: heartbeatHandle }),
  }
}
