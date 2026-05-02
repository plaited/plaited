import { behavioral } from '../behavioral.ts'
import { WORKER_PATH } from '../worker.ts'

export const createAgentRuntime = () => {
  const runtime = behavioral()
  const worker = new Worker(WORKER_PATH)

  return {
    runtime,
    worker,
  }
}
