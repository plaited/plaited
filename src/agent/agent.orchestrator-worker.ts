/**
 * Orchestrator worker entry point — child process for a single project.
 *
 * @remarks
 * IPC protocol:
 * - Parent sends `init` → worker creates agent loop, sends `ready`
 * - Parent sends `task` → worker runs prompt, sends `result` or `error`
 * - Parent sends `shutdown` → worker destroys loop and exits
 *
 * Unlike `agent.simulate-worker.ts` (one-shot), this worker handles
 * multiple sequential tasks within a single long-lived process.
 *
 * @internal
 */

import { createToolExecutor } from '../tools/crud/crud.ts'
import type { WorkerInboundMessage } from './agent.orchestrator.types.ts'
import { createAgentLoop } from './agent.ts'
import type { AgentLoop } from './agent.types.ts'
import { createInferenceCall } from './agent.utils.ts'

let loop: AgentLoop | null = null

process.on('message', async (message: unknown) => {
  const msg = message as WorkerInboundMessage

  if (msg.type === 'init') {
    const inferenceCall = createInferenceCall(msg.config.agentConfig.baseUrl)
    const toolExecutor = createToolExecutor({ workspace: msg.config.workspace })
    loop = createAgentLoop({
      config: msg.config.agentConfig,
      inferenceCall,
      toolExecutor,
    })
    process.send!({ type: 'ready' })
    return
  }

  if (msg.type === 'task') {
    if (!loop) {
      process.send!({ type: 'error', taskId: msg.taskId, error: 'Worker not initialized' })
      return
    }
    try {
      const result = await loop.run(msg.prompt)
      process.send!({ type: 'result', taskId: msg.taskId, output: result.output, trajectory: result.trajectory })
    } catch (error) {
      process.send!({
        type: 'error',
        taskId: msg.taskId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return
  }

  if (msg.type === 'shutdown') {
    loop?.destroy()
    process.exit(0)
  }
})
