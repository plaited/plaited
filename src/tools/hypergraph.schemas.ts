import * as z from 'zod'

// ============================================================================
// Shared Fields
// ============================================================================

const pathField = z.string().describe('Path to directory containing .jsonld files')

// ============================================================================
// Per-Query Input Schemas
// ============================================================================

export const CausalChainInputSchema = z.object({
  path: pathField,
  query: z.literal('causal-chain'),
  from: z.string().describe('Source vertex @id URI'),
  to: z.string().describe('Target vertex @id URI'),
})

export const CoOccurrenceInputSchema = z.object({
  path: pathField,
  query: z.literal('co-occurrence'),
  vertex: z.string().describe('Vertex @id URI to find co-occurring hyperedges for'),
})

export const CheckCyclesInputSchema = z.object({
  path: pathField,
  query: z.literal('check-cycles'),
})

export const MatchInputSchema = z.object({
  path: pathField,
  query: z.literal('match'),
  pattern: z.object({
    sequence: z.array(z.string()).describe('Ordered sequence of @type values to match against hyperedges'),
  }),
})

export const SimilarInputSchema = z.object({
  path: pathField,
  query: z.literal('similar'),
  embedding: z.array(z.number()).describe('Query embedding vector (Float32)'),
  topK: z.number().optional().describe('Number of top results to return (default: 5)'),
})

// ============================================================================
// Discriminated Union Input Schema
// ============================================================================

export const HypergraphQuerySchema = z.discriminatedUnion('query', [
  CausalChainInputSchema,
  CoOccurrenceInputSchema,
  CheckCyclesInputSchema,
  MatchInputSchema,
  SimilarInputSchema,
])

export type HypergraphQuery = z.infer<typeof HypergraphQuerySchema>

// ============================================================================
// Output Schemas
// ============================================================================

export const HyperedgeOutputSchema = z.object({
  id: z.string(),
  type: z.string(),
  vertices: z.array(z.string()),
})

export type HyperedgeOutput = z.infer<typeof HyperedgeOutputSchema>

export const CausalChainOutputSchema = z.object({
  chain: z.array(z.string()).describe('Ordered @id URIs of hyperedges forming the path'),
})

export const CoOccurrenceOutputSchema = z.object({
  hyperedges: z.array(HyperedgeOutputSchema),
})

export const CheckCyclesOutputSchema = z.object({
  cycles: z.array(z.array(z.string())).describe('Each cycle is a list of vertex @id URIs'),
})

export const MatchOutputSchema = z.object({
  matches: z.array(z.array(HyperedgeOutputSchema)),
})

export const SimilarOutputSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      score: z.number(),
    }),
  ),
})
