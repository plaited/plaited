/**
 * Orchestrator worker entry point — child process for a single project.
 *
 * @remarks
 * IPC protocol:
 * - Parent sends `init` → worker creates agent node, subscribes for results, sends `ready`
 * - Parent sends `task` → worker triggers client_connected + task, sends `result` or `error` on `message`
 * - Parent sends `shutdown` → worker destroys node and exits
 *
 * Unlike `agent.simulate-worker.ts` (one-shot), this worker handles
 * multiple sequential tasks within a single long-lived process.
 *
 * @internal
 */

import { createToolExecutor } from '../tools/crud/crud.ts'
import { AGENT_EVENTS } from './agent.constants.ts'
import type { WorkerInboundMessage } from './agent.orchestrator.types.ts'
import { createAgentLoop } from './agent.ts'
import type { AgentNode } from './agent.types.ts'
import { createInferenceCall, createTrajectoryRecorder } from './agent.utils.ts'

let node: AgentNode | null = null
let currentTaskId: string | null = null

process.on('message', (message: unknown) => {
  const msg = message as WorkerInboundMessage

  if (msg.type === 'init') {
    const inferenceCall = createInferenceCall(msg.config.agentConfig.baseUrl)
    const toolExecutor = createToolExecutor({ workspace: msg.config.workspace })
    node = createAgentLoop({
      config: msg.config.agentConfig,
      inferenceCall,
      toolExecutor,
    })

    // Subscribe once for results — adapter pattern
    const recorder = createTrajectoryRecorder()
    node.subscribe({
      [AGENT_EVENTS.client_connected]: () => {
        recorder.reset()
      },
      [AGENT_EVENTS.model_response]: (detail) => {
        if (detail.parsed.thinking) recorder.addThought(detail.parsed.thinking)
      },
      [AGENT_EVENTS.tool_result]: (detail) => {
        recorder.addToolCall({
          name: detail.result.name,
          status: detail.result.status,
          output: detail.result.output ?? detail.result.error,
          duration: detail.result.duration,
        })
      },
      [AGENT_EVENTS.save_plan]: (detail) => {
        recorder.addPlan(detail.plan.steps)
      },
      [AGENT_EVENTS.message]: (detail) => {
        recorder.addMessage(detail.content)
        process.send!({
          type: 'result',
          taskId: currentTaskId!,
          output: detail.content,
          trajectory: recorder.getSteps(),
        })
        node!.trigger({ type: AGENT_EVENTS.disconnected })
      },
    })

    process.send!({ type: 'ready' })
    return
  }

  if (msg.type === 'task') {
    if (!node) {
      process.send!({ type: 'error', taskId: msg.taskId, error: 'Worker not initialized' })
      return
    }
    currentTaskId = msg.taskId
    node.trigger({ type: AGENT_EVENTS.client_connected })
    node.trigger({ type: AGENT_EVENTS.task, detail: { prompt: msg.prompt } })
    return
  }

  if (msg.type === 'shutdown') {
    node?.destroy()
    process.exit(0)
  }
})
