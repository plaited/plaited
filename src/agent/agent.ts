import { behavioral } from '../behavioral/behavioral.ts'
import { bSync, bThread } from '../behavioral/behavioral.utils.ts'
import { AGENT_EVENTS, RISK_CLASS, TOOL_STATUS } from './agent.constants.ts'
import { createConstitution } from './agent.constitution.ts'
import type { ConstitutionRule } from './agent.constitution.types.ts'
import { checkSymbolicGate } from './agent.evaluate.ts'
import type { MemoryDb } from './agent.memory.types.ts'
import type { AgentPlan, AgentToolCall, ToolDefinition, TrajectoryStep } from './agent.schemas.ts'
import { AgentConfigSchema } from './agent.schemas.ts'
import type {
  AgentEventDetails,
  AgentLoop,
  ChatMessage,
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
 * - **simulationGuard** bThread blocks `execute` while a tool call is being simulated
 * - **symbolicSafetyNet** bThread blocks `execute` if stored prediction matches dangerous patterns
 * - **Multi-tool** dispatches all tool calls in parallel; counter-based completion re-invokes inference
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

  const { bThreads, trigger, useFeedback, useSnapshot } = behavioral<AgentEventDetails>()
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
  let rejections: Array<{ toolCall: AgentToolCall; reason: string }> = []
  let sessionId: string | null = null

  // ---------------------------------------------------------------------------
  // Parallel multi-tool: counter-based completion model
  // ---------------------------------------------------------------------------
  let pendingToolCallCount = 0

  // Shared state for bThread predicates (simulation coordination)
  const simulatingIds = new Set<string>()
  const simulationPredictions = new Map<string, string>()

  // ---------------------------------------------------------------------------
  // Helper: decrement counter and re-invoke inference when all calls complete
  // ---------------------------------------------------------------------------
  const onToolComplete = () => {
    pendingToolCallCount--
    if (pendingToolCallCount <= 0) {
      pendingToolCallCount = 0
      simulatingIds.clear()
      simulationPredictions.clear()
      rejections = []
      trigger({ type: AGENT_EVENTS.invoke_inference })
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: call inference with current context
  // ---------------------------------------------------------------------------
  const callInference = () => {
    const eventLog = sessionId && memory ? memory.getEventLog(sessionId).filter((e) => e.blocked_by) : undefined

    return inferenceCall({
      model,
      messages: buildContextMessages({
        systemPrompt,
        history,
        plan: currentPlan ? { goal: currentPlan.goal, steps: currentPlan.steps } : undefined,
        rejections: rejections.length ? rejections : undefined,
        eventLog: eventLog?.length ? eventLog : undefined,
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

    // Blocks execute for any tool call that has a pending simulation
    simulationGuard: bThread(
      [
        bSync({
          block: (event) => {
            if (event.type !== AGENT_EVENTS.execute) return false
            return simulatingIds.has(event.detail?.toolCall?.id)
          },
        }),
      ],
      true,
    ),

    // Blocks execute if the stored prediction matches dangerous patterns
    symbolicSafetyNet: bThread(
      [
        bSync({
          block: (event) => {
            if (event.type !== AGENT_EVENTS.execute) return false
            const prediction = simulationPredictions.get(event.detail?.toolCall?.id)
            if (!prediction) return false
            return checkSymbolicGate(prediction, patterns).blocked
          },
        }),
      ],
      true,
    ),

    // Constitution bThreads — additive safety rules (defense-in-depth)
    ...constitutionResult?.threads,
  })

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
      if (sessionId && memory) {
        memory.saveMessage({ sessionId, role: 'user', content: detail.prompt })
      }
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

    // Step 2: Reason — parse model output, dispatch all tool calls in parallel
    [AGENT_EVENTS.model_response]: (detail) => {
      const { parsed } = detail

      // Record thinking in trajectory
      if (parsed.thinking) recorder.addThought(parsed.thinking)

      // Append assistant turn to conversation history
      const assistantMsg: ChatMessage = { role: 'assistant', content: parsed.message }
      if (parsed.toolCalls.length) {
        assistantMsg.tool_calls = parsed.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }))
      }
      history.push(assistantMsg)
      if (sessionId && memory) {
        memory.saveMessage({
          sessionId,
          role: 'assistant',
          content: parsed.message,
          toolCalls: assistantMsg.tool_calls as unknown[] | undefined,
        })
      }

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
        if (sessionId && memory) {
          memory.saveMessage({ sessionId, role: 'tool', content: planContent, toolCallId: tc.id })
        }
        trigger({ type: AGENT_EVENTS.save_plan, detail: { plan } })
      }

      // Dispatch all action calls at once (parallel processing)
      if (actionCalls.length > 0) {
        pendingToolCallCount = actionCalls.length
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

    // Step 3: Gate — evaluate proposed tool call (constitution + custom gateCheck)
    [AGENT_EVENTS.proposed_action]: (detail) => {
      const decision = composedGateCheck?.(detail.toolCall) ?? { approved: true, riskClass: RISK_CLASS.read_only }
      if (decision.approved) {
        trigger({ type: AGENT_EVENTS.gate_approved, detail: { toolCall: detail.toolCall, decision } })
      } else {
        trigger({ type: AGENT_EVENTS.gate_rejected, detail: { toolCall: detail.toolCall, decision } })
      }
    },

    // Gate approved: route by risk class — read_only executes, others simulate
    [AGENT_EVENTS.gate_approved]: (detail) => {
      const riskClass = detail.decision.riskClass ?? RISK_CLASS.read_only

      // read_only OR no simulate seam → execute directly (Wave 1 path)
      if (riskClass === RISK_CLASS.read_only || !simulate) {
        trigger({ type: AGENT_EVENTS.execute, detail: { toolCall: detail.toolCall, riskClass } })
      } else {
        // Non-read-only with simulate → route to simulation
        simulatingIds.add(detail.toolCall.id)
        trigger({
          type: AGENT_EVENTS.simulate_request,
          detail: { toolCall: detail.toolCall, decision: detail.decision },
        })
      }
    },

    // Gate rejected: record rejection and check completion
    [AGENT_EVENTS.gate_rejected]: (detail) => {
      const reason = detail.decision.reason ?? 'Rejected'
      rejections.push({ toolCall: detail.toolCall, reason })
      const rejectContent = JSON.stringify({ error: `Rejected: ${reason}` })
      // Add synthetic tool result to history so the model sees the rejection
      history.push({
        role: 'tool',
        content: rejectContent,
        tool_call_id: detail.toolCall.id,
      })
      if (sessionId && memory) {
        memory.saveMessage({ sessionId, role: 'tool', content: rejectContent, toolCallId: detail.toolCall.id })
      }
      onToolComplete()
    },

    // Step 4: Simulate — spawn Dreamer prediction
    [AGENT_EVENTS.simulate_request]: async (detail) => {
      const riskClass = detail.decision.riskClass ?? RISK_CLASS.side_effects
      try {
        const prediction = await simulate!({ toolCall: detail.toolCall, history, plan: currentPlan })
        simulatingIds.delete(detail.toolCall.id)
        simulationPredictions.set(detail.toolCall.id, prediction)
        trigger({
          type: AGENT_EVENTS.simulation_result,
          detail: { toolCall: detail.toolCall, prediction, riskClass },
        })
      } catch {
        // Fail-open: simulation error → execute directly (gate already approved)
        simulatingIds.delete(detail.toolCall.id)
        trigger({
          type: AGENT_EVENTS.execute,
          detail: { toolCall: detail.toolCall, riskClass },
        })
      }
    },

    // Step 5: Evaluate — run Judge on simulation result
    [AGENT_EVENTS.simulation_result]: async (detail) => {
      const { toolCall, prediction, riskClass } = detail

      // 5a: Symbolic gate check (deterministic, fast)
      const symbolicResult = checkSymbolicGate(prediction, patterns)
      if (symbolicResult.blocked) {
        trigger({
          type: AGENT_EVENTS.eval_rejected,
          detail: { toolCall, reason: symbolicResult.reason ?? 'Dangerous prediction' },
        })
        return
      }

      // If no evaluate seam → approve
      if (!evaluate) {
        trigger({ type: AGENT_EVENTS.eval_approved, detail: { toolCall, riskClass } })
        return
      }

      // 5b: Neural scorer for high_ambiguity with goal
      try {
        const decision = await evaluate({
          toolCall,
          prediction,
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
        // Fail-open: evaluation error → approve (gate already approved, simulation passed symbolic)
        trigger({ type: AGENT_EVENTS.eval_approved, detail: { toolCall, riskClass } })
      }
    },

    // Eval approved → execute
    [AGENT_EVENTS.eval_approved]: (detail) => {
      trigger({
        type: AGENT_EVENTS.execute,
        detail: { toolCall: detail.toolCall, riskClass: detail.riskClass },
      })
    },

    // Eval rejected → synthetic tool result (mirrors gate_rejected)
    [AGENT_EVENTS.eval_rejected]: (detail) => {
      const reason = detail.reason ?? 'Evaluation rejected'
      rejections.push({ toolCall: detail.toolCall, reason })
      const evalContent = JSON.stringify({ error: `Eval rejected: ${reason}` })
      history.push({
        role: 'tool',
        content: evalContent,
        tool_call_id: detail.toolCall.id,
      })
      if (sessionId && memory) {
        memory.saveMessage({ sessionId, role: 'tool', content: evalContent, toolCallId: detail.toolCall.id })
      }
      // Clean up simulation state
      simulationPredictions.delete(detail.toolCall.id)
      onToolComplete()
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
        if (sessionId && memory) {
          memory.saveMessage({ sessionId, role: 'tool', content: toolContent, toolCallId: result.toolCallId })
        }
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
        if (sessionId && memory) {
          memory.saveMessage({ sessionId, role: 'tool', content: errorContent, toolCallId: detail.toolCall.id })
        }
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

    // After tool result: clean up and check completion
    [AGENT_EVENTS.tool_result]: (detail) => {
      simulationPredictions.delete(detail.result.toolCallId)
      onToolComplete()
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
      if (sessionId && memory) {
        memory.saveMessage({ sessionId, role: 'assistant', content: detail.content })
        memory.completeSession(sessionId, detail.content)
      }
      resolveRun?.({ output: detail.content, trajectory: recorder.getSteps() })
    },

    // Stub handlers for events without explicit logic
    [AGENT_EVENTS.context_ready]: () => {},
    [AGENT_EVENTS.loop_complete]: () => {},
  })

  // ---------------------------------------------------------------------------
  // Snapshot listener: log every BP selection decision to SQLite
  // ---------------------------------------------------------------------------
  let disconnectSnapshot: (() => void) | null = null

  if (memory) {
    disconnectSnapshot = useSnapshot((snapshot) => {
      if (snapshot.kind !== 'selection') return
      if (!sessionId) return
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
    })
  }

  return {
    run: (prompt) => {
      recorder.reset()
      history.length = 0
      currentPlan = null
      rejections = []
      pendingToolCallCount = 0
      simulatingIds.clear()
      simulationPredictions.clear()
      sessionId = memory?.createSession(prompt) ?? null

      return new Promise((resolve) => {
        resolveRun = resolve
        trigger({ type: AGENT_EVENTS.task, detail: { prompt } })
      })
    },
    destroy: () => {
      disconnectFeedback()
      disconnectSnapshot?.()
      resolveRun?.({ output: '', trajectory: recorder.getSteps() })
      resolveRun = null
    },
  }
}
