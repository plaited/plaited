import type { SpawnAgentOptions, SpawnedAgentHandle } from './agent.types.ts'
import { createAgent } from './create-agent.ts'

/**
 * Spawns an agent from the minimal core contract and optionally attaches a
 * snapshot listener on behalf of the caller.
 *
 * @public
 */
export const spawnAgent = async ({ id, onSnapshot, ...options }: SpawnAgentOptions): Promise<SpawnedAgentHandle> => {
  const agent = await createAgent({ id, ...options })
  const disconnectSnapshot = onSnapshot ? agent.useSnapshot(onSnapshot) : undefined

  return {
    id,
    ...agent,
    ...(disconnectSnapshot ? { disconnectSnapshot } : {}),
  }
}
