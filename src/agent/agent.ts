import { behavioral } from '../behavioral/behavioral.ts'
import { bSync, bThread } from '../behavioral/behavioral.utils.ts'
import { createConstitution } from '../tools/constitution/constitution.ts'
import type { ConstitutionRule } from '../tools/constitution/constitution.types.ts'
import { checkSymbolicGate } from '../tools/evaluate/evaluate.ts'
import type { MemoryDb } from '../tools/memory/memory.types.ts'
import { AGENT_EVENTS, RISK_CLASS } from './agent.constants.ts'
import type { AgentPlan, AgentToolCall, ToolDefinition, TrajectoryStep } from './agent.schemas.ts'
import { AgentConfigSchema } from './agent.schemas.ts'
import type {
  AgentLoop,
  ChatMessage,
  DiagnosticEntry,
  Evaluate,
  GateCheck,
  InferenceCall,
  Simulate,
  ToolExecutor,
} from './agent.types.ts'
import { buildContextMessages, createTrajectoryRecorder, parseModelResponse, toToolResult } from './agent.utils.ts'

// ---------------------------------------------------------------------------
// TASK_EVENTS: the set of events blocked by taskGate between tasks.
// 'task' and 'message' are excluded — they are the gate transition events.
// ---------------------------------------------------------------------------
const TASK_EVENTS = new Set<string>([
  AGENT_EVENTS.invoke_inference,
  AGENT_EVENTS.model_response,
  AGENT_EVENTS.gate_rejected,
  AGENT_EVENTS.gate_read_only,
  AGENT_EVENTS.gate_side_effects,
  AGENT_EVENTS.gate_high_ambiguity,
  AGENT_EVENTS.simulate_request,
  AGENT_EVENTS.simulation_result,
  AGENT_EVENTS.eval_approved,
  AGENT_EVENTS.eval_rejected,
  AGENT_EVENTS.execute,
  AGENT_EVENTS.tool_result,
  AGENT_EVENTS.save_plan,
  AGENT_EVENTS.plan_saved,
  AGENT_EVENTS.context_ready,
  AGENT_EVENTS.loop_complete,
])

/**
 * Creates an agent loop wired on `behavioral()` implementing the 6-step cycle:
 * Context → Reason → Gate → Simulate → Evaluate → Execute.
 *
 * @remarks
 * - **Gate** uses provided `gateCheck` or defaults to approve-all with `read_only` risk class
 * - **Simulate** (optional) runs Dreamer prediction on non-read-only calls; skipped when not provided
 * - **Evaluate** (optional) runs Judge scoring on simulated calls; skipped when not provided
 * - **taskGate** bThread blocks task-related events between tasks, replacing the `done` flag
 * - **maxIterations** safety is a per-task bThread that blocks `execute` after the limit
 * - **sim_guard_{id}** per-call bThread blocks `execute` while simulation is pending, interrupted by `simulation_result`
 * - **safety_{id}** per-call bThread blocks `execute` for dangerous predictions, interrupted by resolution
 * - **batchCompletion** bThread waits for N completion events then re-invokes inference
 * - **Observer** layer (second `useFeedback`) handles all persistence when `memory` is provided
 * - **Event-type routing** dispatches gate-approved calls to risk-class-specific events
 *
 * @param options.config - Agent configuration (model, baseUrl, tools, etc.)
 * @param options.inferenceCall - Testing seam for model inference
 * @param options.toolExecutor - Testing seam for tool execution
 * @param options.constitution - Optional constitution rules (dual-layer: bThreads + imperative gateCheck)
 * @param options.gateCheck - Optional gate evaluation function (defaults to approve-all)
 * @param options.simulate - Optional Dreamer simulation function
 * @param options.evaluate - Optional Judge evaluation function
 * @param options.patterns - Optional custom patterns for symbolic safety net bThread
 * @param options.memory - Optional SQLite memory database for session/message persistence
 * @returns An `AgentLoop` with `run(prompt)` and `destroy()` methods
 *
 * @public
 */
export const createAgentLoop = ({
  config: rawConfig,
  inferenceCall,
  toolExecutor,
  constitution,
  gateCheck,
  simulate,
  evaluate,
  patterns,
  memory,
}: {
  config: {
    model: string
    baseUrl: string
    tools?: ToolDefinition[]
    systemPrompt?: string
    maxIterations?: number
    temperature?: number
  }
  inferenceCall: InferenceCall
  toolExecutor: ToolExecutor
  constitution?: ConstitutionRule[]
  gateCheck?: GateCheck
  simulate?: Simulate
  evaluate?: Evaluate
  patterns?: RegExp[]
  memory?: MemoryDb
}): AgentLoop => {
  // Parse config to apply defaults (maxIterations: 50, temperature: 0)
  const { model, tools, systemPrompt, maxIterations, temperature } = AgentConfigSchema.parse(rawConfig)

  const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()
  const recorder = createTrajectoryRecorder()

  // Build constitution if provided — dual-layer: bThreads + imperative gateCheck
  const constitutionResult = constitution?.length ? createConstitution(constitution) : null

  // Compose: constitution gateCheck → custom gateCheck (short-circuit on rejection)
  const composedGateCheck: GateCheck | undefined = (() => {
    if (constitutionResult && gateCheck) {
      return (toolCall: AgentToolCall) => {
        const decision = constitutionResult.gateCheck(toolCall)
        if (!decision.approved) return decision
        return gateCheck(toolCall)
      }
    }
    return constitutionResult?.gateCheck ?? gateCheck
  })()

  let resolveRun: ((value: { output: string; trajectory: TrajectoryStep[] }) => void) | null = null

  // Conversation history in OpenAI chat format
  const history: ChatMessage[] = []
  let currentPlan: AgentPlan | null = null
  let sessionId: string | null = null

  // In-memory diagnostic buffer for non-selection snapshot messages
  const diagnostics: DiagnosticEntry[] = []
  const MAX_DIAGNOSTICS = 50

  // ---------------------------------------------------------------------------
  // Helper: call inference with current context
  // ---------------------------------------------------------------------------
  const callInference = () => {
    const eventLog = sessionId && memory ? memory.getEventLog(sessionId) : undefined

    return inferenceCall({
      model,
      messages: buildContextMessages({
        systemPrompt,
        history,
        plan: currentPlan ? { goal: currentPlan.goal, steps: currentPlan.steps } : undefined,
        eventLog: eventLog?.length ? eventLog : undefined,
        diagnostics: diagnostics.length ? [...diagnostics] : undefined,
      }),
      tools,
      temperature,
    })
  }

  // ---------------------------------------------------------------------------
  // Helper: handle inference error by resolving with error message
  // ---------------------------------------------------------------------------
  const handleInferenceError = (error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error)
    trigger({ type: AGENT_EVENTS.message, detail: { content: `Error: ${msg}` } })
  }

  // ---------------------------------------------------------------------------
  // bThreads — taskGate + simulation coordination + symbolic safety net
  // ---------------------------------------------------------------------------
  bThreads.set({
    // Phase-transition thread: blocks task-related events between tasks
    taskGate: bThread(
      [
        bSync({
          waitFor: AGENT_EVENTS.task,
          block: (event) => TASK_EVENTS.has(event.type),
        }),
        bSync({ waitFor: AGENT_EVENTS.message }),
      ],
      true,
    ),

    // Constitution bThreads — additive safety rules (defense-in-depth)
    ...constitutionResult?.threads,
  })

  // Risk class → gate event mapping (context_ready handler produces one of these)
  const GATE_EVENTS: Record<string, string> = {
    [RISK_CLASS.read_only]: AGENT_EVENTS.gate_read_only,
    [RISK_CLASS.side_effects]: AGENT_EVENTS.gate_side_effects,
    [RISK_CLASS.high_ambiguity]: AGENT_EVENTS.gate_high_ambiguity,
  }

  // Per-call dynamic threads for simulation coordination:
  // - sim_guard_{id}: blocks execute while simulation is pending, interrupted by simulation_result
  // - Both block and interrupt use predicate listeners scoped to the specific tool call ID
  // - Observable via snapshot: SelectionBid.blockedBy / SelectionBid.interrupts
  const triggerSimulate = (toolCall: AgentToolCall, riskClass: string) => {
    const id = toolCall.id

    // Per-call simulation guard: blocks execute until simulation completes
    bThreads.set({
      [`sim_guard_${id}`]: bThread([
        bSync({
          block: (e) => e.type === AGENT_EVENTS.execute && e.detail?.toolCall?.id === id,
          interrupt: [(e) => e.type === AGENT_EVENTS.simulation_result && e.detail?.toolCall?.id === id],
        }),
      ]),
    })

    trigger({
      type: AGENT_EVENTS.simulate_request,
      detail: { toolCall, riskClass },
    })
  }

  // ---------------------------------------------------------------------------
  // Feedback handlers — the async handlers ARE the loop
  // ---------------------------------------------------------------------------
  const disconnectFeedback = useFeedback({
    // Step 1: Context — receive task, add per-task maxIterations, invoke inference
    [AGENT_EVENTS.task]: (detail) => {
      bThreads.set({
        maxIterations: bThread([
          ...Array.from({ length: maxIterations }, () =>
            bSync({ waitFor: AGENT_EVENTS.tool_result, interrupt: [AGENT_EVENTS.message] }),
          ),
          bSync({
            block: AGENT_EVENTS.execute,
            request: {
              type: AGENT_EVENTS.message,
              detail: { content: `Max iterations (${maxIterations}) reached` },
            },
            interrupt: [AGENT_EVENTS.message],
          }),
        ]),
      })
      history.push({ role: 'user', content: detail.prompt })
      trigger({ type: AGENT_EVENTS.invoke_inference })
    },

    // Centralized async inference invocation
    [AGENT_EVENTS.invoke_inference]: async () => {
      try {
        const response = await callInference()
        trigger({
          type: AGENT_EVENTS.model_response,
          detail: { parsed: parseModelResponse(response), raw: response },
        })
      } catch (error) {
        handleInferenceError(error)
      }
    },

    // Step 2: Reason — transform model output, dispatch per-tool-call events
    [AGENT_EVENTS.model_response]: (detail) => {
      const { parsed } = detail

      // Record thinking in trajectory
      if (parsed.thinking) recorder.addThought(parsed.thinking)

      // Append assistant turn to conversation history
      const assistantMsg: ChatMessage = { role: 'assistant', content: parsed.message }
      if (parsed.toolCalls.length) {
        assistantMsg.tool_calls = parsed.toolCalls.map((tc: AgentToolCall) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }))
      }
      history.push(assistantMsg)

      // Separate save_plan calls from action calls
      const savePlanCalls: AgentToolCall[] = []
      const actionCalls: AgentToolCall[] = []
      for (const tc of parsed.toolCalls) {
        tc.name === AGENT_EVENTS.save_plan ? savePlanCalls.push(tc) : actionCalls.push(tc)
      }

      // Handle save_plan calls (synthetic tool results — not action pipeline)
      for (const tc of savePlanCalls) {
        const plan = tc.arguments as unknown as AgentPlan
        history.push({
          role: 'tool',
          content: JSON.stringify({ saved: true, goal: plan.goal }),
          tool_call_id: tc.id,
        })
        trigger({ type: AGENT_EVENTS.save_plan, detail: { plan, toolCallId: tc.id } })
      }

      // Per-tool-call dispatch: generate bThreads, THEN trigger events
      if (actionCalls.length > 0) {
        const isCompletion = (e: { type: string }) =>
          e.type === AGENT_EVENTS.tool_result ||
          e.type === AGENT_EVENTS.gate_rejected ||
          e.type === AGENT_EVENTS.eval_rejected

        bThreads.set({
          batchCompletion: bThread([
            ...Array.from({ length: actionCalls.length }, () =>
              bSync({ waitFor: isCompletion, interrupt: [AGENT_EVENTS.message] }),
            ),
            bSync({
              request: { type: AGENT_EVENTS.invoke_inference },
              interrupt: [AGENT_EVENTS.message],
            }),
          ]),
        })

        // Each tool call becomes an independent scenario
        for (const tc of actionCalls) {
          trigger({ type: AGENT_EVENTS.context_ready, detail: { toolCall: tc } })
        }
      } else if (savePlanCalls.length === 0) {
        trigger({ type: AGENT_EVENTS.message, detail: { content: parsed.message ?? '' } })
      }
      // If only save_plan calls, plan_saved handler will re-invoke inference
    },

    // Step 3: Gate — per-tool-call gate sensor, produces risk-class event
    [AGENT_EVENTS.context_ready]: (detail) => {
      const { toolCall } = detail
      const decision = composedGateCheck?.(toolCall) ?? { approved: true, riskClass: RISK_CLASS.read_only }
      if (!decision.approved) {
        trigger({ type: AGENT_EVENTS.gate_rejected, detail: { toolCall, decision } })
        return
      }
      const riskClass = decision.riskClass ?? RISK_CLASS.read_only
      trigger({
        type: GATE_EVENTS[riskClass] ?? AGENT_EVENTS.gate_high_ambiguity,
        detail: { toolCall },
      })
    },

    // Gate results — one handler per risk class, each does one thing
    [AGENT_EVENTS.gate_read_only]: (detail) => {
      trigger({ type: AGENT_EVENTS.execute, detail: { toolCall: detail.toolCall, riskClass: RISK_CLASS.read_only } })
    },
    [AGENT_EVENTS.gate_side_effects]: (detail) => {
      triggerSimulate(detail.toolCall, RISK_CLASS.side_effects)
    },
    [AGENT_EVENTS.gate_high_ambiguity]: (detail) => {
      triggerSimulate(detail.toolCall, RISK_CLASS.high_ambiguity)
    },

    // Gate rejected: record rejection and check completion
    [AGENT_EVENTS.gate_rejected]: (detail) => {
      const reason = detail.decision.reason ?? 'Rejected'
      const rejectContent = JSON.stringify({ error: `Rejected: ${reason}` })
      // Add synthetic tool result to history so the model sees the rejection
      history.push({
        role: 'tool',
        content: rejectContent,
        tool_call_id: detail.toolCall.id,
      })
    },

    // Step 4: Simulate — call Dreamer prediction (single-path sensor pattern)
    // sim_guard_{id} bThread blocks execute until simulation_result interrupts it
    [AGENT_EVENTS.simulate_request]: async (detail) => {
      const { toolCall, riskClass } = detail
      const prediction = (await simulate?.({ toolCall, history, plan: currentPlan }).catch(() => '')) ?? ''

      // Defense-in-depth: safety_{id} blocks execute on dangerous prediction
      // The handler-level check in eval_approved produces the workflow event (eval_rejected)
      // The bThread blocks execute as defense-in-depth (blocked events don't produce workflow events)
      if (prediction && checkSymbolicGate(prediction, patterns).blocked) {
        bThreads.set({
          [`safety_${toolCall.id}`]: bThread([
            bSync({
              block: (e) => e.type === AGENT_EVENTS.execute && e.detail?.toolCall?.id === toolCall.id,
              interrupt: [
                (e) =>
                  (e.type === AGENT_EVENTS.eval_rejected && e.detail?.toolCall?.id === toolCall.id) ||
                  (e.type === AGENT_EVENTS.tool_result && e.detail?.result?.toolCallId === toolCall.id),
              ],
            }),
          ]),
        })
      }

      trigger({ type: AGENT_EVENTS.simulation_result, detail: { toolCall, prediction, riskClass } })
    },

    // Step 5: Evaluate — call Judge scoring (single-path sensor pattern)
    // safety_{id} bThread handles dangerous predictions via request + block
    [AGENT_EVENTS.simulation_result]: async (detail) => {
      const { toolCall, riskClass } = detail
      const approved = { approved: true } as { approved: boolean; reason?: string; score?: number }
      const decision =
        (await evaluate?.({
          toolCall,
          prediction: detail.prediction,
          riskClass,
          history,
          goal: currentPlan?.goal,
        }).catch(() => approved)) ?? approved

      if (decision.approved) {
        trigger({
          type: AGENT_EVENTS.eval_approved,
          detail: { toolCall, riskClass, score: decision.score, prediction: detail.prediction },
        })
      } else {
        trigger({
          type: AGENT_EVENTS.eval_rejected,
          detail: { toolCall, reason: decision.reason ?? 'Evaluation rejected', score: decision.score },
        })
      }
    },

    // Eval approved → symbolic safety check → execute
    // Three-layer: handler produces workflow event (eval_rejected for batchCompletion),
    // safety_{id} bThread blocks execute (defense-in-depth)
    [AGENT_EVENTS.eval_approved]: (detail) => {
      if (detail.prediction) {
        const symbolic = checkSymbolicGate(detail.prediction, patterns)
        if (symbolic.blocked) {
          trigger({
            type: AGENT_EVENTS.eval_rejected,
            detail: { toolCall: detail.toolCall, reason: symbolic.reason ?? 'Dangerous prediction', score: 0 },
          })
          return
        }
      }
      trigger({
        type: AGENT_EVENTS.execute,
        detail: { toolCall: detail.toolCall, riskClass: detail.riskClass },
      })
    },

    // Eval rejected → synthetic tool result (mirrors gate_rejected)
    [AGENT_EVENTS.eval_rejected]: (detail) => {
      const reason = detail.reason ?? 'Evaluation rejected'
      const evalContent = JSON.stringify({ error: `Eval rejected: ${reason}` })
      history.push({
        role: 'tool',
        content: evalContent,
        tool_call_id: detail.toolCall.id,
      })
    },

    // Step 6: Execute — run the tool, record trajectory
    [AGENT_EVENTS.execute]: async (detail) => {
      const startTime = Date.now()
      let result: Awaited<ReturnType<typeof toolExecutor>>
      try {
        result = await toolExecutor(detail.toolCall)
      } catch (error) {
        result = toToolResult(detail.toolCall, error, Date.now() - startTime)
      }
      if (!result.duration) result = { ...result, duration: Date.now() - startTime }

      recorder.addToolCall({
        name: detail.toolCall.name,
        status: result.status,
        input: detail.toolCall.arguments,
        output: result.output ?? result.error,
        duration: result.duration,
      })
      const content =
        result.output !== undefined
          ? typeof result.output === 'string'
            ? result.output
            : JSON.stringify(result.output)
          : JSON.stringify({ error: result.error ?? '' })
      history.push({ role: 'tool', content, tool_call_id: result.toolCallId })
      trigger({ type: AGENT_EVENTS.tool_result, detail: { result } })
    },

    // Plan management
    [AGENT_EVENTS.save_plan]: (detail) => {
      currentPlan = detail.plan
      recorder.addPlan(detail.plan.steps)
      trigger({ type: AGENT_EVENTS.plan_saved, detail: { plan: detail.plan } })
    },

    [AGENT_EVENTS.plan_saved]: () => {
      trigger({ type: AGENT_EVENTS.invoke_inference })
    },

    // Terminal: resolve run() promise
    [AGENT_EVENTS.message]: (detail) => {
      recorder.addMessage(detail.content)
      resolveRun?.({ output: detail.content, trajectory: recorder.getSteps() })
    },
  })

  // ---------------------------------------------------------------------------
  // Observer: persistence layer (registered per-run when memory exists)
  // ---------------------------------------------------------------------------
  let disconnectObserver: (() => void) | null = null

  // ---------------------------------------------------------------------------
  // Snapshot listener: persist selections to SQLite, capture diagnostics in-memory
  // ---------------------------------------------------------------------------
  const disconnectSnapshot = useSnapshot((snapshot) => {
    if (!sessionId) return

    switch (snapshot.kind) {
      case 'selection':
        if (memory) {
          for (const bid of snapshot.bids) {
            memory.saveEventLog({
              sessionId: sessionId!,
              eventType: bid.type,
              thread: bid.thread,
              selected: bid.selected,
              trigger: bid.trigger,
              priority: bid.priority,
              blockedBy: bid.blockedBy,
              interrupts: bid.interrupts,
              detail: bid.detail,
            })
          }
        }
        break
      case 'feedback_error':
        if (diagnostics.length >= MAX_DIAGNOSTICS) diagnostics.shift()
        diagnostics.push({
          kind: 'feedback_error',
          type: snapshot.type,
          detail: snapshot.detail,
          error: snapshot.error,
          timestamp: Date.now(),
        })
        break
      case 'restricted_trigger_error':
        if (diagnostics.length >= MAX_DIAGNOSTICS) diagnostics.shift()
        diagnostics.push({
          kind: 'restricted_trigger_error',
          type: snapshot.type,
          detail: snapshot.detail,
          error: snapshot.error,
          timestamp: Date.now(),
        })
        break
      case 'bthreads_warning':
        if (diagnostics.length >= MAX_DIAGNOSTICS) diagnostics.shift()
        diagnostics.push({
          kind: 'bthreads_warning',
          thread: snapshot.thread,
          warning: snapshot.warning,
          timestamp: Date.now(),
        })
        break
    }
  })

  return {
    run: (prompt) => {
      recorder.reset()
      history.length = 0
      currentPlan = null
      diagnostics.length = 0
      sessionId = memory?.createSession(prompt) ?? null

      // Register observer per-run when memory exists (sessionId guaranteed non-null)
      if (memory && sessionId) {
        disconnectObserver?.()
        disconnectObserver = useFeedback({
          [AGENT_EVENTS.task]: (detail) => {
            memory.saveMessage({ sessionId: sessionId!, role: 'user', content: detail.prompt })
          },
          [AGENT_EVENTS.model_response]: (detail) => {
            const { parsed } = detail
            const toolCalls = parsed.toolCalls.length
              ? parsed.toolCalls.map((tc: AgentToolCall) => ({
                  id: tc.id,
                  type: 'function',
                  function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
                }))
              : undefined
            memory.saveMessage({
              sessionId: sessionId!,
              role: 'assistant',
              content: parsed.message,
              toolCalls: toolCalls as unknown[] | undefined,
            })
          },
          [AGENT_EVENTS.save_plan]: (detail) => {
            const planContent = JSON.stringify({ saved: true, goal: detail.plan.goal })
            memory.saveMessage({
              sessionId: sessionId!,
              role: 'tool',
              content: planContent,
              toolCallId: detail.toolCallId,
            })
          },
          [AGENT_EVENTS.gate_rejected]: (detail) => {
            const reason = detail.decision.reason ?? 'Rejected'
            const rejectContent = JSON.stringify({ error: `Rejected: ${reason}` })
            memory.saveMessage({
              sessionId: sessionId!,
              role: 'tool',
              content: rejectContent,
              toolCallId: detail.toolCall.id,
            })
          },
          [AGENT_EVENTS.eval_rejected]: (detail) => {
            const reason = detail.reason ?? 'Evaluation rejected'
            const evalContent = JSON.stringify({ error: `Eval rejected: ${reason}` })
            memory.saveMessage({
              sessionId: sessionId!,
              role: 'tool',
              content: evalContent,
              toolCallId: detail.toolCall.id,
            })
          },
          [AGENT_EVENTS.tool_result]: (detail) => {
            const result = detail.result
            const content =
              result.output !== undefined
                ? typeof result.output === 'string'
                  ? result.output
                  : JSON.stringify(result.output ?? result.error ?? '')
                : JSON.stringify({ error: result.error ?? '' })
            memory.saveMessage({ sessionId: sessionId!, role: 'tool', content, toolCallId: result.toolCallId })
          },
          [AGENT_EVENTS.message]: (detail) => {
            memory.saveMessage({ sessionId: sessionId!, role: 'assistant', content: detail.content })
            memory.completeSession(sessionId!, detail.content)
          },
        })
      }

      return new Promise((resolve) => {
        resolveRun = resolve
        trigger({ type: AGENT_EVENTS.task, detail: { prompt } })
      })
    },
    destroy: () => {
      disconnectFeedback()
      disconnectObserver?.()
      disconnectSnapshot()
      resolveRun?.({ output: '', trajectory: recorder.getSteps() })
      resolveRun = null
    },
  }
}
