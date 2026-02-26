import { behavioral } from '../behavioral/behavioral.ts'
import { bSync, bThread } from '../behavioral/behavioral.utils.ts'
import { createConstitution } from '../tools/constitution/constitution.ts'
import type { ConstitutionRule } from '../tools/constitution/constitution.types.ts'
import { checkSymbolicGate } from '../tools/evaluate/evaluate.ts'
import type { MemoryDb } from '../tools/memory/memory.types.ts'
import { AGENT_EVENTS, RISK_CLASS, TOOL_STATUS } from './agent.constants.ts'
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
import { buildContextMessages, createTrajectoryRecorder, parseModelResponse } from './agent.utils.ts'

// ---------------------------------------------------------------------------
// TASK_EVENTS: the set of events blocked by taskGate between tasks.
// 'task' and 'message' are excluded — they are the gate transition events.
// ---------------------------------------------------------------------------
const TASK_EVENTS = new Set<string>([
  AGENT_EVENTS.invoke_inference,
  AGENT_EVENTS.model_response,
  AGENT_EVENTS.proposed_action,
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

  // Shared state for handler-level symbolic safety check (eval_approved)
  const simulationPredictions = new Map<string, string>()

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

  // Risk class → gate event mapping (proposed_action produces one of these directly)
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
      simulationPredictions.clear()
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

    // Step 2: Reason — parse model output, dispatch all tool calls in parallel
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
        if (tc.name === AGENT_EVENTS.save_plan) {
          savePlanCalls.push(tc)
        } else {
          actionCalls.push(tc)
        }
      }

      // Handle save_plan calls immediately (synthetic tool results)
      for (const tc of savePlanCalls) {
        const plan = tc.arguments as unknown as AgentPlan
        const planContent = JSON.stringify({ saved: true, goal: plan.goal })
        history.push({
          role: 'tool',
          content: planContent,
          tool_call_id: tc.id,
        })
        trigger({ type: AGENT_EVENTS.save_plan, detail: { plan, toolCallId: tc.id } })
      }

      // Dispatch all action calls at once (parallel processing)
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
        for (const tc of actionCalls) {
          trigger({ type: AGENT_EVENTS.proposed_action, detail: { toolCall: tc } })
        }
      } else if (savePlanCalls.length === 0) {
        // No tool calls at all — route by message content
        if (parsed.message) {
          trigger({ type: AGENT_EVENTS.message, detail: { content: parsed.message } })
        } else {
          trigger({ type: AGENT_EVENTS.message, detail: { content: '' } })
        }
      }
      // If only save_plan calls, plan_saved handler will re-invoke inference
    },

    // Step 3: Gate — evaluate proposed tool call, produce risk-class event directly
    [AGENT_EVENTS.proposed_action]: (detail) => {
      const decision = composedGateCheck?.(detail.toolCall) ?? { approved: true, riskClass: RISK_CLASS.read_only }
      if (!decision.approved) {
        trigger({ type: AGENT_EVENTS.gate_rejected, detail: { toolCall: detail.toolCall, decision } })
        return
      }
      const riskClass = decision.riskClass ?? RISK_CLASS.read_only
      trigger({
        type: GATE_EVENTS[riskClass] ?? AGENT_EVENTS.gate_high_ambiguity,
        detail: { toolCall: detail.toolCall },
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

    // Step 4: Simulate — call Dreamer prediction or pass through
    // sim_guard_{id} bThread blocks execute until simulation_result interrupts it
    [AGENT_EVENTS.simulate_request]: async (detail) => {
      const { riskClass } = detail

      // No simulate seam → pass through to evaluation pipeline
      if (!simulate) {
        trigger({
          type: AGENT_EVENTS.simulation_result,
          detail: { toolCall: detail.toolCall, prediction: '', riskClass },
        })
        return
      }

      try {
        const prediction = await simulate({ toolCall: detail.toolCall, history, plan: currentPlan })
        simulationPredictions.set(detail.toolCall.id, prediction)

        // If dangerous, add per-call safety thread (defense-in-depth alongside eval_approved handler)
        if (checkSymbolicGate(prediction, patterns).blocked) {
          const tcId = detail.toolCall.id
          bThreads.set({
            [`safety_${tcId}`]: bThread([
              bSync({
                block: (e) => e.type === AGENT_EVENTS.execute && e.detail?.toolCall?.id === tcId,
                interrupt: [
                  (e) =>
                    (e.type === AGENT_EVENTS.eval_rejected && e.detail?.toolCall?.id === tcId) ||
                    (e.type === AGENT_EVENTS.tool_result && e.detail?.result?.toolCallId === tcId),
                ],
              }),
            ]),
          })
        }

        trigger({
          type: AGENT_EVENTS.simulation_result,
          detail: { toolCall: detail.toolCall, prediction, riskClass },
        })
      } catch {
        // Fail-open: simulation error → pass through with empty prediction
        trigger({
          type: AGENT_EVENTS.simulation_result,
          detail: { toolCall: detail.toolCall, prediction: '', riskClass },
        })
      }
    },

    // Step 5: Evaluate — call Judge scoring or pass through
    // Note: symbolic safety net is handled by the symbolicSafetyNet bThread
    // which blocks dangerous `execute` events — no duplicate check needed here.
    [AGENT_EVENTS.simulation_result]: async (detail) => {
      const { toolCall, riskClass } = detail

      // No evaluate seam → approve
      if (!evaluate) {
        trigger({ type: AGENT_EVENTS.eval_approved, detail: { toolCall, riskClass } })
        return
      }

      try {
        const decision = await evaluate({
          toolCall,
          prediction: detail.prediction,
          riskClass,
          history,
          goal: currentPlan?.goal,
        })
        if (decision.approved) {
          trigger({ type: AGENT_EVENTS.eval_approved, detail: { toolCall, riskClass, score: decision.score } })
        } else {
          trigger({
            type: AGENT_EVENTS.eval_rejected,
            detail: { toolCall, reason: decision.reason ?? 'Evaluation rejected', score: decision.score },
          })
        }
      } catch {
        // Fail-open: evaluation error → approve
        trigger({ type: AGENT_EVENTS.eval_approved, detail: { toolCall, riskClass } })
      }
    },

    // Eval approved → symbolic safety check → execute
    // Dual-layer: handler routes rejection for model feedback,
    // symbolicSafetyNet bThread blocks as defense-in-depth
    [AGENT_EVENTS.eval_approved]: (detail) => {
      const prediction = simulationPredictions.get(detail.toolCall.id)
      if (prediction) {
        const symbolic = checkSymbolicGate(prediction, patterns)
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
      try {
        const result = await toolExecutor(detail.toolCall)
        const duration = Date.now() - startTime
        recorder.addToolCall({
          name: detail.toolCall.name,
          status: result.status,
          input: detail.toolCall.arguments,
          output: result.output ?? result.error,
          duration,
        })
        const toolContent =
          typeof result.output === 'string' ? result.output : JSON.stringify(result.output ?? result.error ?? '')
        history.push({
          role: 'tool',
          content: toolContent,
          tool_call_id: result.toolCallId,
        })
        trigger({ type: AGENT_EVENTS.tool_result, detail: { result } })
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : String(error)
        recorder.addToolCall({
          name: detail.toolCall.name,
          status: TOOL_STATUS.failed,
          input: detail.toolCall.arguments,
          output: errorMsg,
          duration,
        })
        const errorContent = JSON.stringify({ error: errorMsg })
        history.push({
          role: 'tool',
          content: errorContent,
          tool_call_id: detail.toolCall.id,
        })
        trigger({
          type: AGENT_EVENTS.tool_result,
          detail: {
            result: {
              toolCallId: detail.toolCall.id,
              name: detail.toolCall.name,
              status: TOOL_STATUS.failed,
              error: errorMsg,
              duration,
            },
          },
        })
      }
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
  // Observer: persistence layer (only when memory exists)
  // ---------------------------------------------------------------------------
  let disconnectObserver: (() => void) | null = null

  if (memory) {
    disconnectObserver = useFeedback({
      [AGENT_EVENTS.task]: (detail) => {
        if (!sessionId) return
        memory.saveMessage({ sessionId, role: 'user', content: detail.prompt })
      },
      [AGENT_EVENTS.model_response]: (detail) => {
        if (!sessionId) return
        const { parsed } = detail
        const toolCalls = parsed.toolCalls.length
          ? parsed.toolCalls.map((tc: AgentToolCall) => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            }))
          : undefined
        memory.saveMessage({
          sessionId,
          role: 'assistant',
          content: parsed.message,
          toolCalls: toolCalls as unknown[] | undefined,
        })
      },
      [AGENT_EVENTS.save_plan]: (detail) => {
        if (!sessionId) return
        const planContent = JSON.stringify({ saved: true, goal: detail.plan.goal })
        memory.saveMessage({ sessionId, role: 'tool', content: planContent, toolCallId: detail.toolCallId })
      },
      [AGENT_EVENTS.gate_rejected]: (detail) => {
        if (!sessionId) return
        const reason = detail.decision.reason ?? 'Rejected'
        const rejectContent = JSON.stringify({ error: `Rejected: ${reason}` })
        memory.saveMessage({ sessionId, role: 'tool', content: rejectContent, toolCallId: detail.toolCall.id })
      },
      [AGENT_EVENTS.eval_rejected]: (detail) => {
        if (!sessionId) return
        const reason = detail.reason ?? 'Evaluation rejected'
        const evalContent = JSON.stringify({ error: `Eval rejected: ${reason}` })
        memory.saveMessage({ sessionId, role: 'tool', content: evalContent, toolCallId: detail.toolCall.id })
      },
      [AGENT_EVENTS.tool_result]: (detail) => {
        if (!sessionId) return
        const result = detail.result
        const content =
          result.output !== undefined
            ? typeof result.output === 'string'
              ? result.output
              : JSON.stringify(result.output ?? result.error ?? '')
            : JSON.stringify({ error: result.error ?? '' })
        memory.saveMessage({ sessionId, role: 'tool', content, toolCallId: result.toolCallId })
      },
      [AGENT_EVENTS.message]: (detail) => {
        if (!sessionId) return
        memory.saveMessage({ sessionId, role: 'assistant', content: detail.content })
        memory.completeSession(sessionId, detail.content)
      },
    })
  }

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
      simulationPredictions.clear()
      diagnostics.length = 0
      sessionId = memory?.createSession(prompt) ?? null

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
