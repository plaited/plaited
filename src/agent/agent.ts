import { behavioral } from '../behavioral/behavioral.ts'
import { bSync, bThread } from '../behavioral/behavioral.utils.ts'
import { AGENT_EVENTS, RISK_CLASS, TOOL_STATUS } from './agent.constants.ts'
import type { AgentPlan, AgentToolCall, TrajectoryStep } from './agent.schemas.ts'
import { AgentConfigSchema } from './agent.schemas.ts'
import type { AgentEventDetails, AgentLoop, ChatMessage, InferenceCall, ToolExecutor } from './agent.types.ts'
import { buildContextMessages, createTrajectoryRecorder, parseModelResponse } from './agent.utils.ts'

const SAVE_PLAN_TOOL = 'save_plan'

/**
 * Creates an agent loop wired on `behavioral()` implementing the 6-step cycle:
 * Context → Reason → Gate → Simulate → Evaluate → Execute.
 *
 * @remarks
 * - **Gate** is stubbed to approve-all with `read_only` risk class
 * - **Simulate/Evaluate** events are defined but not handled (deferred)
 * - **maxIterations** safety is a bThread that blocks `execute` after the limit
 * - **Multi-tool** is deferred — only the first tool call per response is processed
 *
 * @param options.config - Agent configuration (model, baseUrl, tools, etc.)
 * @param options.inferenceCall - Testing seam for model inference
 * @param options.toolExecutor - Testing seam for tool execution
 * @returns An `AgentLoop` with `run(prompt)` and `destroy()` methods
 *
 * @public
 */
export const createAgentLoop = ({
  config: rawConfig,
  inferenceCall,
  toolExecutor,
}: {
  config: {
    model: string
    baseUrl: string
    apiKey?: string
    tools?: Record<string, unknown>[]
    systemPrompt?: string
    maxIterations?: number
    temperature?: number
  }
  inferenceCall: InferenceCall
  toolExecutor: ToolExecutor
}): AgentLoop => {
  // Parse config to apply defaults (maxIterations: 50, temperature: 0)
  const { model, tools, systemPrompt, maxIterations, temperature } = AgentConfigSchema.parse(rawConfig)

  const { bThreads, trigger, useFeedback } = behavioral<AgentEventDetails>()
  const recorder = createTrajectoryRecorder()

  let done = false
  let resolveRun: ((value: { output: string; trajectory: TrajectoryStep[] }) => void) | null = null

  // Conversation history in OpenAI chat format
  const history: ChatMessage[] = []
  let currentPlan: AgentPlan | null = null
  let rejections: Array<{ toolCall: AgentToolCall; reason: string }> = []

  // ---------------------------------------------------------------------------
  // Helper: call inference with current context
  // ---------------------------------------------------------------------------
  const callInference = () =>
    inferenceCall({
      model,
      messages: buildContextMessages({
        systemPrompt,
        history,
        plan: currentPlan ? { goal: currentPlan.goal, steps: currentPlan.steps } : undefined,
        rejections: rejections.length ? rejections : undefined,
      }),
      tools,
      temperature,
    })

  // ---------------------------------------------------------------------------
  // Helper: handle inference error by resolving with error message
  // ---------------------------------------------------------------------------
  const handleInferenceError = (error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error)
    trigger({ type: AGENT_EVENTS.message, detail: { content: `Error: ${msg}` } })
  }

  // ---------------------------------------------------------------------------
  // maxIterations bThread — constitution pattern safety net
  //
  // Counts tool_result events. After `maxIterations` tool results, blocks all
  // further `execute` events and requests a termination message in a single
  // synchronization point. The behavioral engine selects the message (since
  // execute is blocked), which resolves the run() promise.
  // ---------------------------------------------------------------------------
  bThreads.set({
    maxIterations: bThread([
      ...Array.from({ length: maxIterations }, () => bSync({ waitFor: AGENT_EVENTS.tool_result })),
      bSync({
        block: AGENT_EVENTS.execute,
        request: {
          type: AGENT_EVENTS.message,
          detail: { content: `Max iterations (${maxIterations}) reached` },
        },
      }),
    ]),
  })

  // ---------------------------------------------------------------------------
  // Feedback handlers — the async handlers ARE the loop
  // ---------------------------------------------------------------------------
  const disconnectFeedback = useFeedback({
    // Step 1: Context — receive task, build context, invoke inference
    [AGENT_EVENTS.task]: async (detail) => {
      if (done) return
      history.push({ role: 'user', content: detail.prompt })
      try {
        const response = await callInference()
        if (done) return
        trigger({ type: AGENT_EVENTS.model_response, detail: { parsed: parseModelResponse(response), raw: response } })
      } catch (error) {
        if (done) return
        handleInferenceError(error)
      }
    },

    // Step 2: Reason — parse model output, route to action/plan/message
    [AGENT_EVENTS.model_response]: (detail) => {
      if (done) return
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

      // Route: first tool call only (multi-tool deferred)
      const firstToolCall = parsed.toolCalls[0]
      if (firstToolCall) {
        if (firstToolCall.name === SAVE_PLAN_TOOL) {
          const plan = firstToolCall.arguments as unknown as AgentPlan
          // Add synthetic tool result for save_plan to keep history balanced
          history.push({
            role: 'tool',
            content: JSON.stringify({ saved: true, goal: plan.goal }),
            tool_call_id: firstToolCall.id,
          })
          trigger({ type: AGENT_EVENTS.save_plan, detail: { plan } })
        } else {
          trigger({ type: AGENT_EVENTS.proposed_action, detail: { toolCall: firstToolCall } })
        }
      } else if (parsed.message) {
        trigger({ type: AGENT_EVENTS.message, detail: { content: parsed.message } })
      } else {
        // Empty response — terminate with empty output
        trigger({ type: AGENT_EVENTS.message, detail: { content: '' } })
      }
    },

    // Step 3: Gate — evaluate proposed tool call (stub: approve all)
    [AGENT_EVENTS.proposed_action]: (detail) => {
      if (done) return
      const decision = { approved: true, riskClass: RISK_CLASS.read_only }
      trigger({ type: AGENT_EVENTS.gate_approved, detail: { toolCall: detail.toolCall, decision } })
    },

    [AGENT_EVENTS.gate_approved]: (detail) => {
      if (done) return
      trigger({
        type: AGENT_EVENTS.execute,
        detail: { toolCall: detail.toolCall, riskClass: detail.decision.riskClass ?? RISK_CLASS.read_only },
      })
    },

    [AGENT_EVENTS.gate_rejected]: async (detail) => {
      if (done) return
      rejections.push({ toolCall: detail.toolCall, reason: detail.decision.reason ?? 'Rejected' })
      try {
        const response = await callInference()
        if (done) return
        trigger({ type: AGENT_EVENTS.model_response, detail: { parsed: parseModelResponse(response), raw: response } })
      } catch (error) {
        if (done) return
        handleInferenceError(error)
      }
    },

    // Step 6: Execute — run the tool, record trajectory
    [AGENT_EVENTS.execute]: async (detail) => {
      if (done) return
      const startTime = Date.now()
      try {
        const result = await toolExecutor(detail.toolCall)
        if (done) return
        const duration = Date.now() - startTime
        recorder.addToolCall({
          name: detail.toolCall.name,
          status: result.status,
          input: detail.toolCall.arguments,
          output: result.output ?? result.error,
          duration,
        })
        history.push({
          role: 'tool',
          content:
            typeof result.output === 'string' ? result.output : JSON.stringify(result.output ?? result.error ?? ''),
          tool_call_id: result.toolCallId,
        })
        trigger({ type: AGENT_EVENTS.tool_result, detail: { result } })
      } catch (error) {
        if (done) return
        const duration = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : String(error)
        recorder.addToolCall({
          name: detail.toolCall.name,
          status: TOOL_STATUS.failed,
          input: detail.toolCall.arguments,
          output: errorMsg,
          duration,
        })
        history.push({
          role: 'tool',
          content: JSON.stringify({ error: errorMsg }),
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

    // After tool result: re-invoke inference for next step
    [AGENT_EVENTS.tool_result]: async () => {
      if (done) return
      rejections = []
      try {
        const response = await callInference()
        if (done) return
        trigger({ type: AGENT_EVENTS.model_response, detail: { parsed: parseModelResponse(response), raw: response } })
      } catch (error) {
        if (done) return
        handleInferenceError(error)
      }
    },

    // Plan management
    [AGENT_EVENTS.save_plan]: (detail) => {
      if (done) return
      currentPlan = detail.plan
      recorder.addPlan(detail.plan.steps)
      trigger({ type: AGENT_EVENTS.plan_saved, detail: { plan: detail.plan } })
    },

    [AGENT_EVENTS.plan_saved]: async () => {
      if (done) return
      try {
        const response = await callInference()
        if (done) return
        trigger({ type: AGENT_EVENTS.model_response, detail: { parsed: parseModelResponse(response), raw: response } })
      } catch (error) {
        if (done) return
        handleInferenceError(error)
      }
    },

    // Terminal: resolve run() promise
    [AGENT_EVENTS.message]: (detail) => {
      if (done) return
      done = true
      recorder.addMessage(detail.content)
      resolveRun?.({ output: detail.content, trajectory: recorder.getSteps() })
    },

    // Stub handlers for deferred events (required by Handlers<AgentEventDetails> type)
    [AGENT_EVENTS.context_ready]: () => {},
    [AGENT_EVENTS.simulate_request]: () => {},
    [AGENT_EVENTS.simulation_result]: () => {},
    [AGENT_EVENTS.eval_approved]: () => {},
    [AGENT_EVENTS.eval_rejected]: () => {},
    [AGENT_EVENTS.loop_complete]: () => {},
  })

  return {
    run: (prompt) => {
      recorder.reset()
      history.length = 0
      currentPlan = null
      rejections = []
      done = false

      return new Promise((resolve) => {
        resolveRun = resolve
        trigger({ type: AGENT_EVENTS.task, detail: { prompt } })
      })
    },
    destroy: () => {
      done = true
      disconnectFeedback()
      resolveRun?.({ output: '', trajectory: recorder.getSteps() })
      resolveRun = null
    },
  }
}
