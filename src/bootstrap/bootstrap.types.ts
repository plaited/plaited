import type { z } from 'zod'
import type { AgentHandle, AgentModels, Factory, HeartbeatConfig } from '../agent.ts'
import type { AuthenticateConnection } from '../factories/server-factory/server-factory.types.ts'
import type {
  BootstrapInputSchema,
  BootstrapMemoryProviderSchema,
  BootstrapOutputSchema,
  BootstrapProfileSchema,
  BootstrapSandboxProviderSchema,
  BootstrapSyncProviderSchema,
} from './bootstrap.schemas.ts'

export type BootstrapProfile = z.infer<typeof BootstrapProfileSchema>
export type BootstrapMemoryProvider = z.infer<typeof BootstrapMemoryProviderSchema>
export type BootstrapSandboxProvider = z.infer<typeof BootstrapSandboxProviderSchema>
export type BootstrapSyncProvider = z.infer<typeof BootstrapSyncProviderSchema>
export type BootstrapInput = z.infer<typeof BootstrapInputSchema>
export type BootstrapOutput = z.infer<typeof BootstrapOutputSchema>

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
  factories?: Factory[]
  restrictedTriggers?: string[]
  heartbeat?: HeartbeatConfig
  cwd?: string
  workspace?: string
  autostartServer?: boolean
}

export type BootstrapRuntime = {
  agent: AgentHandle
  startServer: () => void
  stopServer: () => void
  reloadServer: () => void
}
