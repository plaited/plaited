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

export const FilteredReachabilityInputSchema = z.object({
  path: pathField,
  query: z.literal('reachability'),
  startVertices: z.array(z.string()).describe('Starting vertex @id URIs for reachability traversal'),
  vertexTypeFilter: z.array(z.string()).optional().describe('Only traverse vertices of these types (empty = all)'),
  hyperedgeTypeFilter: z.array(z.string()).optional().describe('Only traverse hyperedges of these types (empty = all)'),
  maxDepth: z.number().optional().describe('Maximum BFS depth (default: unlimited)'),
})

export const DeriveProvenanceInputSchema = z.object({
  path: pathField,
  query: z.literal('provenance'),
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
  FilteredReachabilityInputSchema,
  DeriveProvenanceInputSchema,
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

export const ReachabilityOutputSchema = z.object({
  vertices: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      depth: z.number(),
    }),
  ),
})

export const ProvenanceEdgeSchema = z.object({
  from: z.string().describe('Source decision @id URI'),
  to: z.string().describe('Target decision @id URI'),
  kind: z.enum(['thread_continuity', 'block_unblock', 'event_chain']).describe('Type of causal relationship'),
  via: z.string().describe('Thread or event that links the two decisions'),
})

export type ProvenanceEdge = z.infer<typeof ProvenanceEdgeSchema>

export const ProvenanceOutputSchema = z.object({
  edges: z.array(ProvenanceEdgeSchema),
})

export const SessionMetaSchema = z.object({
  '@id': z.string(),
  '@type': z.literal('Session'),
  summary: z.string(),
  embedding: z.array(z.number()).optional(),
  threadTypes: z.array(z.string()),
  outcomeEvents: z.array(z.string()),
  toolsUsed: z.array(z.string()),
  decisionCount: z.number(),
  commits: z.array(z.string()).optional(),
  timestamp: z.string(),
})
