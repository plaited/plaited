import * as z from 'zod'

/**
 * Zod schema for bootstrap deployment profiles.
 *
 * @public
 */
export const BootstrapProfileSchema = z.enum(['local-first', 'offline-private', 'hosted-node'])

/**
 * Zod schema for supported durable memory providers.
 *
 * @public
 */
export const BootstrapMemoryProviderSchema = z.enum(['agentfs', 'jsonl-sqlite'])

/**
 * Zod schema for supported sandbox providers.
 *
 * @public
 */
export const BootstrapSandboxProviderSchema = z.enum(['boxer', 'none'])

/**
 * Zod schema for supported sync providers.
 *
 * @public
 */
export const BootstrapSyncProviderSchema = z.enum(['turso', 'none'])

/**
 * Zod schema for bootstrap command input.
 *
 * @public
 */
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
  serverPort: z.number().int().nonnegative().default(0).describe('Initial port for the server-module lane'),
  serverAllowedOrigins: z.array(z.string()).optional().describe('Optional allowed origins for the server-module lane'),
  serverCsp: z
    .union([z.string(), z.literal(false)])
    .optional()
    .describe('Optional CSP override for the server-module lane'),
  overwrite: z.boolean().default(false).describe('Allow overwriting existing bootstrap files'),
})

/**
 * Zod schema for bootstrap command output.
 *
 * @public
 */
export const BootstrapOutputSchema = z.object({
  name: z.string(),
  targetDir: z.string(),
  profile: BootstrapProfileSchema,
  createdPaths: z.array(z.string()),
  configPath: z.string(),
  nextSteps: z.array(z.string()),
})
