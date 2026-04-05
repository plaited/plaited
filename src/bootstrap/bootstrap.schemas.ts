import * as z from 'zod'

export const BootstrapProfileSchema = z.enum(['local-first', 'offline-private', 'hosted-node'])

export const BootstrapMemoryProviderSchema = z.enum(['agentfs', 'jsonl-sqlite'])

export const BootstrapSandboxProviderSchema = z.enum(['boxer', 'none'])

export const BootstrapSyncProviderSchema = z.enum(['turso', 'none'])

export const BootstrapInputSchema = z.object({
  targetDir: z.string().default('.').describe('Target directory for bootstrap output'),
  name: z.string().default('plaited-agent').describe('Logical name for the bootstrapped agent'),
  profile: BootstrapProfileSchema.default('local-first').describe('Deployment profile'),
  primaryBaseUrl: z.url().optional().describe('OpenAI-compatible base URL for the primary model'),
  primaryModel: z.string().optional().describe('Primary model identifier'),
  visionBaseUrl: z.url().optional().describe('Optional OpenAI-compatible base URL for vision'),
  visionModel: z.string().optional().describe('Optional vision model identifier'),
  ttsBaseUrl: z.url().optional().describe('Optional OpenAI-compatible base URL for speech output'),
  ttsModel: z.string().optional().describe('Optional speech output model identifier'),
  memoryProvider: BootstrapMemoryProviderSchema.default('agentfs').describe('Durable memory substrate'),
  sandboxProvider: BootstrapSandboxProviderSchema.default('boxer').describe('Execution sandbox provider'),
  syncProvider: BootstrapSyncProviderSchema.default('none').describe('Optional sync provider'),
  serverPort: z.number().int().nonnegative().default(0).describe('Initial port for the server-factory lane'),
  serverAllowedOrigins: z.array(z.string()).optional().describe('Optional allowed origins for the server-factory lane'),
  serverCsp: z
    .union([z.string(), z.literal(false)])
    .optional()
    .describe('Optional CSP override for the server-factory lane'),
  overwrite: z.boolean().default(false).describe('Allow overwriting existing bootstrap files'),
})

export const BootstrapOutputSchema = z.object({
  name: z.string(),
  targetDir: z.string(),
  profile: BootstrapProfileSchema,
  createdPaths: z.array(z.string()),
  configPath: z.string(),
  nextSteps: z.array(z.string()),
})
