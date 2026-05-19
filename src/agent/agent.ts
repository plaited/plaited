import { behavioral } from '../behavioral.ts'
// biome-ignore lint/correctness/noUnusedImports: WIP checkpoint
import { WORKER_PATH } from '../worker.ts'

// biome-ignore lint/correctness/noUnusedVariables: WIP checkpoint
const { addHandler, addThread, reportSnapshot, trigger, useSnapshot } = behavioral()

// export const createAgentRuntime = () => {

//   const worker = new Worker(WORKER_PATH)

//   return {
//     runtime,
//     worker,
//   }
// }
