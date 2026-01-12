/**
 * Orchestrator for wiring world agent and adapter via signals.
 *
 * @remarks
 * Creates bidirectional signal communication between
 * a world agent and its protocol adapter.
 */

import type { Trigger } from '../main/behavioral.types.ts'
import { useSignal } from '../main.ts'

/**
 * Actor configuration for orchestration.
 */
type ActorConfig<TContext> = {
  /**
   * The useBehavioral factory function.
   * Called with context to create the actor.
   */
  factory: (ctx: TContext) => Promise<Trigger>

  /**
   * Context to pass to the factory (excluding outbound signal).
   */
  context: Omit<TContext, 'outbound'>
}

/**
 * Orchestrator configuration.
 */
type OrchestratorConfig<TAgentContext, TAdapterContext> = {
  agent: ActorConfig<TAgentContext>
  adapter: ActorConfig<TAdapterContext>
}

/**
 * Orchestrator result.
 */
type OrchestratorResult = {
  /**
   * Disconnect both agent and adapter.
   */
  disconnect: () => void
}

/**
 * Creates an orchestrator that wires agent and adapter via signals.
 *
 * @remarks
 * The orchestrator:
 * 1. Creates bidirectional signals
 * 2. Instantiates agent with outbound signal
 * 3. Instantiates adapter with outbound signal
 * 4. Wires signals to connect them
 * 5. Returns disconnect function
 *
 * Adapters own their transport event loop (stdio, HTTP).
 * No trigger is returned - adapters handle incoming messages internally.
 */
export const useOrchestrator = async <
  TAgentContext extends { outbound: unknown },
  TAdapterContext extends { outbound: unknown },
>({
  agent,
  adapter,
}: OrchestratorConfig<TAgentContext, TAdapterContext>): Promise<OrchestratorResult> => {
  // Create bidirectional signals
  const agentOut = useSignal<unknown>()
  const adapterOut = useSignal<unknown>()

  // Instantiate agent with outbound signal
  const agentTrigger = await agent.factory({
    ...agent.context,
    outbound: agentOut,
  } as TAgentContext)

  // Instantiate adapter with outbound signal
  const adapterTrigger = await adapter.factory({
    ...adapter.context,
    outbound: adapterOut,
  } as TAdapterContext)

  // Wire: agent events → adapter trigger
  agentOut.listen('agentEvent', adapterTrigger)

  // Wire: adapter events → agent trigger
  adapterOut.listen('adapterEvent', agentTrigger)

  return {
    disconnect() {
      agentTrigger({ type: 'disconnect' })
      adapterTrigger({ type: 'disconnect' })
    },
  }
}
