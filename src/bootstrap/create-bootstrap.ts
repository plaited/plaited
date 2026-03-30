import type { BootstrapHandle, CreateBootstrapOptions } from './bootstrap.types.ts'

/**
 * Bootstraps a Plaited node around its initial agent, server wiring, and
 * installed default behavior.
 *
 * @remarks
 * This is the setup/install boundary, not the agent runtime substrate.
 * It currently delegates to the existing node startup path while the deeper
 * agent/runtime refactor is in flight.
 *
 * @public
 */
export const createBootstrap = async (options: CreateBootstrapOptions): Promise<BootstrapHandle> => {
  void options
  throw new Error('Bootstrap is being rewritten to replace the removed modnet path.')
}
