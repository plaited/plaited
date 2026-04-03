import type { z } from 'zod'
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
