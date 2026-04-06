import type { z } from 'zod'
import type { AgentHandle, AgentModels, Module, HeartbeatConfig } from '../agent.ts'
import type { AuthenticateConnection } from '../modules/server-module/server-module.types.ts'
import type {
  BootstrapInputSchema,
  BootstrapMemoryProviderSchema,
  BootstrapOutputSchema,
  BootstrapProfileSchema,
  BootstrapSandboxProviderSchema,
  BootstrapSyncProviderSchema,
} from './bootstrap.schemas.ts'

/** @public */
export type BootstrapProfile = z.infer<typeof BootstrapProfileSchema>
/** @public */
export type BootstrapMemoryProvider = z.infer<typeof BootstrapMemoryProviderSchema>
/** @public */
export type BootstrapSandboxProvider = z.infer<typeof BootstrapSandboxProviderSchema>
/** @public */
export type BootstrapSyncProvider = z.infer<typeof BootstrapSyncProviderSchema>
/** @public */
export type BootstrapInput = z.infer<typeof BootstrapInputSchema>
/** @public */
export type BootstrapOutput = z.infer<typeof BootstrapOutputSchema>

/**
 * Runtime input used to bootstrap and start a local Plaited agent instance.
 *
 * @public
 */
export type BootstrapRuntimeInput = BootstrapInput & {
  models: AgentModels
  authenticateConnection: AuthenticateConnection
  routes?: Bun.Serve.Routes<
    {
      connectionId: string
      source: string
      principalId?: string
      deviceId?: string
      capabilities?: string[]
    },
    string
  >
  modules?: Module[]
  restrictedTriggers?: string[]
  heartbeat?: HeartbeatConfig
  cwd?: string
  workspace?: string
  autostartServer?: boolean
}

/**
 * Runtime handles returned by `createBootstrappedAgent`.
 *
 * @public
 */
export type BootstrapRuntime = {
  agent: AgentHandle
  startServer: () => void
  stopServer: () => void
  reloadServer: () => void
}
