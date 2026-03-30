/**
 * Hypergraph search tool — loads JSON-LD files, builds an in-memory
 * incidence structure, and runs graph algorithms via WebAssembly.
 *
 * @remarks
 * Domain-agnostic: knows nothing about `.memory/` conventions, sessions,
 * or agent loop structure. Handlers pass the right paths.
 *
 * Two layers:
 * - **TS layer** (this file) — JSON-LD loader, index builder, WASM bridge
 * - **AS layer** (`graph-algorithms/`) — BFS, DFS, cosine similarity in WASM
 *
 * Write side composes `writeFile` from `crud.ts` in agent loop handlers
 * (useSnapshot, ingest_skill, ingest_rules, consolidate). Not this tool's concern.
 *
 * @public
 */

import { resolve } from 'node:path'
import * as z from 'zod'
import { RISK_TAG } from '../agent/agent.constants.ts'
import type { ToolDefinition } from '../agent/agent.schemas.ts'
import type { ToolHandler } from '../agent/agent.types.ts'
import { parseCli } from './cli.utils.ts'
import {
  type CausalChainOutputSchema,
  type CheckCyclesOutputSchema,
  type CoOccurrenceOutputSchema,
  HypergraphQuerySchema,
  type MatchOutputSchema,
  type ProvenanceOutputSchema,
  type ReachabilityOutputSchema,
  type SimilarOutputSchema,
} from './hypergraph.schemas.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * In-memory incidence structure built from JSON-LD documents.
 *
 * @remarks
 * Maps `@id` URIs to integer indices. CSR (Compressed Sparse Row) format
 * for efficient graph traversal in WASM.
 *
 * @internal
 */
export type HypergraphIndex = {
  vertexIds: string[]
  vertexMap: Map<string, number>
  /** Vertex @type parallel to vertexIds ('' if unknown) */
  vertexTypes: string[]
  /** Unique non-empty vertex type names, sorted */
  vertexTypeSet: string[]
  hyperedgeIds: string[]
  hyperedgeMap: Map<string, number>
  hyperedgeTypes: string[]
  typeSet: string[]
  /** CSR: vertex → hyperedge incidence */
  offsets: Int32Array
  neighbors: Int32Array
  /** CSR: hyperedge → vertex incidence (transposed) */
  heOffsets: Int32Array
  heNeighbors: Int32Array
  /** Directed adjacency from blockedBy relationships */
  dirOffsets: Int32Array
  dirNeighbors: Int32Array
  /** Embeddings from documents with an `embedding` field */
  embeddingDocs: string[]
  embeddings: Float32Array
  dims: number
}

/**
 * Typed exports from the hypergraph WASM module.
 *
 * @internal
 */
type WasmExports = {
  memory: WebAssembly.Memory
  __new: (size: number, id: number) => number
  __pin: (ptr: number) => number
  __unpin: (ptr: number) => void
  __collect: () => void
  staticArrayI32Id: () => number
  staticArrayF32Id: () => number
  causalChain: (
    numV: number,
    numHE: number,
    vOffsets: number,
    vNeighbors: number,
    heOffsets: number,
    heNeighbors: number,
    from: number,
    to: number,
  ) => number
  coOccurrence: (vOffsets: number, vNeighbors: number, vertex: number) => number
  checkCycles: (numV: number, dirOffsets: number, dirNeighbors: number) => number
  matchPattern: (numHE: number, types: number, pattern: number, patternLen: number) => number
  similar: (numDocs: number, dims: number, embeddings: number, query: number, topK: number) => number
  filteredReachability: (
    numV: number,
    numHE: number,
    vOffsets: number,
    vNeighbors: number,
    heOffsets: number,
    heNeighbors: number,
    vertexMask: number,
    hyperedgeMask: number,
    startVertices: number,
    numStarts: number,
    maxDepth: number,
  ) => number
}

/**
 * Cached WASM instance with pre-resolved runtime type IDs.
 *
 * @remarks
 * Bundling the type IDs with the exports eliminates nullable cache
 * variables and their associated non-null assertions.
 *
 * @internal
 */
type WasmInstance = {
  exports: WasmExports
  i32Id: number
  f32Id: number
}

/**
 * A single entry from the `similar` query WASM result.
 *
 * @internal
 */
type SimilarEntry = { docIdx: number; score: number }

// ============================================================================
// JSON-LD Loading
// ============================================================================

/**
 * Discover and parse all `.jsonld` files in a directory.
 *
 * @internal
 */
export const loadJsonLd = async (dirPath: string): Promise<Record<string, unknown>[]> => {
  const glob = new Bun.Glob('**/*.jsonld')
  const docs: Record<string, unknown>[] = []
  for await (const path of glob.scan({ cwd: dirPath, onlyFiles: true })) {
    const text = await Bun.file(resolve(dirPath, path)).text()
    docs.push(JSON.parse(text) as Record<string, unknown>)
  }
  // Sort by @id for deterministic hyperedge ordering across filesystems
  docs.sort((a, b) => {
    const aId = (a['@id'] as string) ?? ''
    const bId = (b['@id'] as string) ?? ''
    return aId.localeCompare(bId)
  })
  return docs
}

// ============================================================================
// Index Building
// ============================================================================

/**
 * Extract vertex ID references from a JSON-LD document.
 *
 * @remarks
 * Walks known JSON-LD fields to find `@id` URI references that become
 * vertices in the hypergraph. Extracts directed edges from `blockedBy`
 * (bid blocking) and `requires` (skill dependency chains).
 *
 * Handles nested `references` and `blocks` arrays inside `provides`/`requires`
 * items — these contain `@id` URIs for events that threads reference or block.
 *
 * @internal
 */
const extractVertices = (
  doc: Record<string, unknown>,
): {
  vertices: Array<{ id: string; type?: string }>
  directedEdges: Array<[string, string]>
} => {
  const vertices: Array<{ id: string; type?: string }> = []
  const directedEdges: Array<[string, string]> = []

  // Document itself is a vertex
  const docId = doc['@id'] as string | undefined
  if (docId) vertices.push({ id: docId })

  // Bids (SelectionDecision documents)
  const bids = doc.bids as Array<Record<string, unknown>> | undefined
  if (Array.isArray(bids)) {
    for (const bid of bids) {
      if (typeof bid.thread === 'string') vertices.push({ id: bid.thread })
      // Handle both JSON-LD `event` field and raw schema `type` field
      const eventRef = bid.event ?? bid.type
      if (typeof eventRef === 'string') vertices.push({ id: eventRef as string })
      if (typeof bid.blockedBy === 'string') {
        vertices.push({ id: bid.blockedBy })
        if (typeof bid.thread === 'string') {
          directedEdges.push([bid.thread, bid.blockedBy])
        }
      }
      if (typeof bid.interrupts === 'string') vertices.push({ id: bid.interrupts })
    }
  }

  // Skill/rule subgraphs: provides/requires/rules arrays of objects with @id
  for (const field of ['provides', 'requires', 'rules'] as const) {
    const items = doc[field]
    if (Array.isArray(items)) {
      for (const item of items) {
        if (typeof item === 'object' && item !== null && '@id' in item) {
          const rec = item as Record<string, unknown>
          const itemId = rec['@id'] as string
          const itemType = rec['@type'] as string | undefined
          vertices.push({ id: itemId, type: itemType })

          // requires creates directed edge: doc → required item (dependency chain)
          if (field === 'requires' && docId) {
            directedEdges.push([docId, itemId])
          }

          // Walk nested references and blocks arrays (thread vertices reference events)
          for (const nested of ['references', 'blocks'] as const) {
            const refs = rec[nested]
            if (Array.isArray(refs)) {
              for (const ref of refs) {
                if (typeof ref === 'string') vertices.push({ id: ref })
              }
            }
          }
        }
      }
    }
  }

  return { vertices, directedEdges }
}

/**
 * Build CSR (Compressed Sparse Row) arrays from an adjacency list.
 *
 * @remarks
 * Uses `for...of` over adjacency entries to avoid indexed array access
 * that returns `T | undefined` under `noUncheckedIndexedAccess`.
 *
 * @internal
 */
const buildCsr = (
  numNodes: number,
  adjacency: Map<number, number[]>,
): { offsets: Int32Array; neighbors: Int32Array } => {
  const offsets = new Int32Array(numNodes + 1)
  let totalNeighbors = 0
  for (let i = 0; i < numNodes; i++) {
    const adj = adjacency.get(i)
    offsets[i] = totalNeighbors
    totalNeighbors += adj ? adj.length : 0
  }
  offsets[numNodes] = totalNeighbors

  const neighbors = new Int32Array(totalNeighbors)
  let pos = 0
  for (let i = 0; i < numNodes; i++) {
    const adj = adjacency.get(i)
    if (adj) {
      for (const neighbor of adj) {
        neighbors[pos] = neighbor
        pos++
      }
    }
  }
  return { offsets, neighbors }
}

/**
 * Build the in-memory hypergraph index from parsed JSON-LD documents.
 *
 * @public
 */
export const buildIndex = (
  docs: Record<string, unknown>[],
  provenanceEdges?: Array<[string, string]>,
): HypergraphIndex => {
  const vertexMap = new Map<string, number>()
  const hyperedgeMap = new Map<string, number>()
  const vertexIds: string[] = []
  const vertexTypes: string[] = []
  const hyperedgeIds: string[] = []
  const hyperedgeTypes: string[] = []
  const typeSetMap = new Map<string, number>()
  const typeSet: string[] = []

  // Adjacency lists for CSR construction
  const vertexToHyperedges = new Map<number, number[]>()
  const hyperedgeToVertices = new Map<number, number[]>()
  const directedAdj = new Map<number, number[]>()

  // Embedding collection
  const embeddingDocs: string[] = []
  const embeddingArrays: number[][] = []
  let dims = 0

  const getVertexIdx = (id: string, type?: string): number => {
    let idx = vertexMap.get(id)
    if (idx === undefined) {
      idx = vertexIds.length
      vertexMap.set(id, idx)
      vertexIds.push(id)
      vertexTypes.push(type ?? '')
    } else if (type && vertexTypes[idx] === '') {
      // Upgrade: vertex was registered typeless, now has a type
      vertexTypes[idx] = type
    }
    return idx
  }

  for (const doc of docs) {
    const docId = doc['@id'] as string | undefined
    const docType = doc['@type'] as string | undefined
    if (!docId) continue

    // Register as hyperedge if it has a type (decision, skill, rule, etc.)
    let heIdx: number | undefined
    if (docType) {
      heIdx = hyperedgeIds.length
      hyperedgeMap.set(docId, heIdx)
      hyperedgeIds.push(docId)
      hyperedgeTypes.push(docType)
      if (!typeSetMap.has(docType)) {
        typeSetMap.set(docType, typeSet.length)
        typeSet.push(docType)
      }
    }

    // Extract vertices and directed edges
    const { vertices, directedEdges } = extractVertices(doc)

    // Register all vertices (even from docs without @type like Session metadata)
    // Deduplicate per-doc: same vertex appearing in multiple bids of one doc
    // should only create one adjacency entry per (vertex, hyperedge) pair
    const seenVertices = new Set<number>()
    for (const v of vertices) {
      const vIdx = getVertexIdx(v.id, v.type)

      // Link vertex to hyperedge only if this doc is a hyperedge (and not already linked)
      if (heIdx !== undefined && !seenVertices.has(vIdx)) {
        seenVertices.add(vIdx)

        // vertex → hyperedge
        const vAdj = vertexToHyperedges.get(vIdx)
        if (vAdj) vAdj.push(heIdx)
        else vertexToHyperedges.set(vIdx, [heIdx])

        // hyperedge → vertex
        const heAdj = hyperedgeToVertices.get(heIdx)
        if (heAdj) heAdj.push(vIdx)
        else hyperedgeToVertices.set(heIdx, [vIdx])
      }
    }

    // Directed edges (from blockedBy and requires)
    // Deduplicate: same (from, to) pair should only appear once
    const seenEdges = new Set<string>()
    for (const [fromId, toId] of directedEdges) {
      const edgeKey = `${fromId}\0${toId}`
      if (seenEdges.has(edgeKey)) continue
      seenEdges.add(edgeKey)
      const fromIdx = getVertexIdx(fromId)
      const toIdx = getVertexIdx(toId)
      const adj = directedAdj.get(fromIdx)
      if (adj) adj.push(toIdx)
      else directedAdj.set(fromIdx, [toIdx])
    }

    // Embeddings
    const embedding = doc.embedding
    if (Array.isArray(embedding) && embedding.length > 0 && typeof embedding[0] === 'number') {
      embeddingDocs.push(docId)
      embeddingArrays.push(embedding as number[])
      if (dims === 0) dims = embedding.length
    }
  }

  // Append provenance edges to directed adjacency
  if (provenanceEdges) {
    for (const [fromId, toId] of provenanceEdges) {
      const fromIdx = getVertexIdx(fromId)
      const toIdx = getVertexIdx(toId)
      const adj = directedAdj.get(fromIdx)
      if (adj) adj.push(toIdx)
      else directedAdj.set(fromIdx, [toIdx])
    }
  }

  // Build CSR arrays
  const { offsets, neighbors } = buildCsr(vertexIds.length, vertexToHyperedges)
  const { offsets: heOffsets, neighbors: heNeighbors } = buildCsr(hyperedgeIds.length, hyperedgeToVertices)
  const { offsets: dirOffsets, neighbors: dirNeighbors } = buildCsr(vertexIds.length, directedAdj)

  // Flatten embeddings into row-major Float32Array
  const embeddings = new Float32Array(embeddingArrays.length * dims)
  let embIdx = 0
  for (const arr of embeddingArrays) {
    embeddings.set(arr, embIdx * dims)
    embIdx++
  }

  // Build vertexTypeSet from unique non-empty vertex types, sorted
  const vtSet = new Set<string>()
  for (const vt of vertexTypes) {
    if (vt !== '') vtSet.add(vt)
  }
  const vertexTypeSet = [...vtSet].sort()

  return {
    vertexIds,
    vertexMap,
    vertexTypes,
    vertexTypeSet,
    hyperedgeIds,
    hyperedgeMap,
    hyperedgeTypes,
    typeSet,
    offsets,
    neighbors,
    heOffsets,
    heNeighbors,
    dirOffsets,
    dirNeighbors,
    embeddingDocs,
    embeddings,
    dims,
  }
}

// ============================================================================
// WASM Bridge
// ============================================================================

const WASM_PATH = resolve(import.meta.dir, 'hypergraph.wasm')

let cachedInstance: WasmInstance | null = null

/**
 * Load and cache the hypergraph WASM module.
 *
 * @internal
 */
const loadWasm = async (): Promise<WasmInstance> => {
  if (cachedInstance) return cachedInstance

  const wasmBytes = await Bun.file(WASM_PATH).arrayBuffer()
  const { instance } = await WebAssembly.instantiate(wasmBytes, {
    env: {
      abort: (_msg: number, _file: number, line: number, col: number) => {
        throw new Error(`WASM abort at ${line}:${col}`)
      },
    },
  })
  const exports = instance.exports as unknown as WasmExports
  cachedInstance = {
    exports,
    i32Id: exports.staticArrayI32Id(),
    f32Id: exports.staticArrayF32Id(),
  }
  return cachedInstance
}

// ---- Array helpers: lower (JS → WASM) ----

/**
 * AS object header layout: mmInfo + gcInfo + gcInfo2 + rtId + rtSize = 20 bytes.
 * The pointer returned by AS points to the data; header is at negative offsets.
 * rtSize (byte length of data) is at ptr - 4.
 */
const HEADER_RTSIZE_OFFSET = 4

/**
 * Allocate a `StaticArray<i32>` in WASM memory and copy data into it.
 *
 * @internal
 */
const lowerI32Array = (inst: WasmInstance, data: Int32Array): number => {
  const ptr = inst.exports.__new(data.byteLength, inst.i32Id)
  inst.exports.__pin(ptr)
  new Int32Array(inst.exports.memory.buffer, ptr, data.length).set(data)
  return ptr
}

/**
 * Allocate a `StaticArray<f32>` in WASM memory and copy data into it.
 *
 * @internal
 */
const lowerF32Array = (inst: WasmInstance, data: Float32Array): number => {
  const ptr = inst.exports.__new(data.byteLength, inst.f32Id)
  inst.exports.__pin(ptr)
  new Float32Array(inst.exports.memory.buffer, ptr, data.length).set(data)
  return ptr
}

// ---- Typed decoders: lift WASM results via DataView ----

/**
 * Decode a `[count, idx1, idx2, ...]` i32 result from WASM memory.
 *
 * @remarks
 * Reads directly via `DataView.getInt32()` which returns `number`,
 * avoiding TypedArray bracket access that yields `number | undefined`
 * under `noUncheckedIndexedAccess`. WebAssembly memory is little-endian.
 *
 * @internal
 */
const decodeIndexList = (wasm: WasmExports, ptr: number): number[] => {
  const view = new DataView(wasm.memory.buffer)
  const byteLen = view.getUint32(ptr - HEADER_RTSIZE_OFFSET, true)
  if (byteLen < 4) return []
  const count = view.getInt32(ptr, true)
  const indices: number[] = []
  for (let i = 0; i < count; i++) {
    indices.push(view.getInt32(ptr + (i + 1) * 4, true))
  }
  return indices
}

/**
 * Decode a `[numCycles, len1, v1a, v1b, ..., len2, ...]` i32 result.
 *
 * @internal
 */
const decodeCycles = (wasm: WasmExports, ptr: number): number[][] => {
  const view = new DataView(wasm.memory.buffer)
  const byteLen = view.getUint32(ptr - HEADER_RTSIZE_OFFSET, true)
  if (byteLen < 4) return []
  const numCycles = view.getInt32(ptr, true)
  const cycles: number[][] = []
  let offset = 1
  for (let i = 0; i < numCycles; i++) {
    const cycleLen = view.getInt32(ptr + offset * 4, true)
    offset++
    const cycle: number[] = []
    for (let j = 0; j < cycleLen; j++) {
      cycle.push(view.getInt32(ptr + offset * 4, true))
      offset++
    }
    cycles.push(cycle)
  }
  return cycles
}

/**
 * Decode a `[actualK, docIdx1, score1, docIdx2, score2, ...]` f32 result.
 *
 * @internal
 */
const decodeSimilar = (wasm: WasmExports, ptr: number): SimilarEntry[] => {
  const view = new DataView(wasm.memory.buffer)
  const byteLen = view.getUint32(ptr - HEADER_RTSIZE_OFFSET, true)
  if (byteLen < 4) return []
  const actualK = Math.round(view.getFloat32(ptr, true))
  const entries: SimilarEntry[] = []
  for (let i = 0; i < actualK; i++) {
    const docIdx = Math.round(view.getFloat32(ptr + (1 + i * 2) * 4, true))
    const score = view.getFloat32(ptr + (2 + i * 2) * 4, true)
    entries.push({ docIdx, score })
  }
  return entries
}

/**
 * Decode a `[count, vIdx1, depth1, vIdx2, depth2, ...]` i32 pair result.
 *
 * @internal
 */
const decodeReachability = (wasm: WasmExports, ptr: number): Array<{ vIdx: number; depth: number }> => {
  const view = new DataView(wasm.memory.buffer)
  const byteLen = view.getUint32(ptr - HEADER_RTSIZE_OFFSET, true)
  if (byteLen < 4) return []
  const count = view.getInt32(ptr, true)
  const entries: Array<{ vIdx: number; depth: number }> = []
  for (let i = 0; i < count; i++) {
    const vIdx = view.getInt32(ptr + (1 + i * 2) * 4, true)
    const depth = view.getInt32(ptr + (2 + i * 2) * 4, true)
    entries.push({ vIdx, depth })
  }
  return entries
}

/**
 * Unpin all pointers in a list (cleanup after WASM call).
 *
 * @internal
 */
const unpinAll = (wasm: WasmExports, ptrs: number[]): void => {
  for (const ptr of ptrs) wasm.__unpin(ptr)
}

// ============================================================================
// Index Accessors — runtime bounds checking with type narrowing
// ============================================================================

/**
 * Look up a vertex `@id` by index, throwing on out-of-bounds.
 *
 * @remarks
 * Narrows `string | undefined` to `string` via the guard clause,
 * eliminating the need for non-null assertions on array access.
 *
 * @internal
 */
const getVertexId = (index: HypergraphIndex, vIdx: number): string => {
  const id = index.vertexIds[vIdx]
  if (id === undefined) throw new Error(`Invalid vertex index: ${vIdx}`)
  return id
}

/**
 * Look up a hyperedge `@id` and `@type` by index, throwing on out-of-bounds.
 *
 * @internal
 */
const getHyperedgeInfo = (index: HypergraphIndex, heIdx: number): { id: string; type: string } => {
  const id = index.hyperedgeIds[heIdx]
  const type = index.hyperedgeTypes[heIdx]
  if (id === undefined || type === undefined) throw new Error(`Invalid hyperedge index: ${heIdx}`)
  return { id, type }
}

/**
 * Look up an embedding document `@id` by index, throwing on out-of-bounds.
 *
 * @internal
 */
const getEmbeddingDocId = (index: HypergraphIndex, docIdx: number): string => {
  const id = index.embeddingDocs[docIdx]
  if (id === undefined) throw new Error(`Invalid embedding doc index: ${docIdx}`)
  return id
}

/**
 * Collect all vertex `@id` URIs belonging to a hyperedge via CSR lookup.
 *
 * @remarks
 * Uses `DataView` for CSR TypedArray reads to avoid `noUncheckedIndexedAccess`
 * returning `number | undefined` on bracket access. Int32Array uses platform
 * endianness (little-endian on all Bun-supported platforms).
 *
 * @internal
 */
const getHyperedgeVertices = (index: HypergraphIndex, heIdx: number): string[] => {
  const offsetView = new DataView(index.heOffsets.buffer)
  const neighborView = new DataView(index.heNeighbors.buffer)
  const start = offsetView.getInt32(heIdx * 4, true)
  const end = offsetView.getInt32((heIdx + 1) * 4, true)
  const vertices: string[] = []
  for (let i = start; i < end; i++) {
    const vIdx = neighborView.getInt32(i * 4, true)
    vertices.push(getVertexId(index, vIdx))
  }
  return vertices
}

// ============================================================================
// Query Implementations
// ============================================================================

const queryCausalChain = (
  index: HypergraphIndex,
  inst: WasmInstance,
  from: string,
  to: string,
): z.infer<typeof CausalChainOutputSchema> => {
  const fromIdx = index.vertexMap.get(from)
  const toIdx = index.vertexMap.get(to)
  if (fromIdx === undefined || toIdx === undefined) return { chain: [] }

  const { exports: wasm } = inst
  const pVOff = lowerI32Array(inst, index.offsets)
  const pVNbr = lowerI32Array(inst, index.neighbors)
  const pHEOff = lowerI32Array(inst, index.heOffsets)
  const pHENbr = lowerI32Array(inst, index.heNeighbors)

  const resultPtr = wasm.__pin(
    wasm.causalChain(index.vertexIds.length, index.hyperedgeIds.length, pVOff, pVNbr, pHEOff, pHENbr, fromIdx, toIdx),
  )
  const hyperedgeIndices = decodeIndexList(wasm, resultPtr)
  unpinAll(wasm, [pVOff, pVNbr, pHEOff, pHENbr, resultPtr])

  const chain = hyperedgeIndices.map((heIdx) => getHyperedgeInfo(index, heIdx).id)
  return { chain }
}

const queryCoOccurrence = (
  index: HypergraphIndex,
  inst: WasmInstance,
  vertex: string,
): z.infer<typeof CoOccurrenceOutputSchema> => {
  const vIdx = index.vertexMap.get(vertex)
  if (vIdx === undefined) return { hyperedges: [] }

  const { exports: wasm } = inst
  const pVOff = lowerI32Array(inst, index.offsets)
  const pVNbr = lowerI32Array(inst, index.neighbors)

  const resultPtr = wasm.__pin(wasm.coOccurrence(pVOff, pVNbr, vIdx))
  const hyperedgeIndices = decodeIndexList(wasm, resultPtr)
  unpinAll(wasm, [pVOff, pVNbr, resultPtr])

  const hyperedges = hyperedgeIndices.map((heIdx) => {
    const { id, type } = getHyperedgeInfo(index, heIdx)
    return { id, type, vertices: getHyperedgeVertices(index, heIdx) }
  })
  return { hyperedges }
}

const queryCheckCycles = (index: HypergraphIndex, inst: WasmInstance): z.infer<typeof CheckCyclesOutputSchema> => {
  const { exports: wasm } = inst
  const pDirOff = lowerI32Array(inst, index.dirOffsets)
  const pDirNbr = lowerI32Array(inst, index.dirNeighbors)

  const resultPtr = wasm.__pin(wasm.checkCycles(index.vertexIds.length, pDirOff, pDirNbr))
  const rawCycles = decodeCycles(wasm, resultPtr)
  unpinAll(wasm, [pDirOff, pDirNbr, resultPtr])

  const cycles = rawCycles.map((cycle) => cycle.map((vIdx) => getVertexId(index, vIdx)))
  return { cycles }
}

const queryMatchPattern = (
  index: HypergraphIndex,
  inst: WasmInstance,
  sequence: string[],
): z.infer<typeof MatchOutputSchema> => {
  // Map @type strings to integer indices
  const patternIndices = new Int32Array(sequence.length)
  let patIdx = 0
  for (const typeName of sequence) {
    const typeIdx = index.typeSet.indexOf(typeName)
    if (typeIdx === -1) return { matches: [] }
    patternIndices[patIdx] = typeIdx
    patIdx++
  }

  // Map hyperedge types to integer indices
  const typeIndices = new Int32Array(index.hyperedgeTypes.length)
  for (const [i, heType] of index.hyperedgeTypes.entries()) {
    typeIndices[i] = index.typeSet.indexOf(heType)
  }

  const { exports: wasm } = inst
  const pTypes = lowerI32Array(inst, typeIndices)
  const pPattern = lowerI32Array(inst, patternIndices)

  const resultPtr = wasm.__pin(wasm.matchPattern(index.hyperedgeIds.length, pTypes, pPattern, sequence.length))
  const startIndices = decodeIndexList(wasm, resultPtr)
  unpinAll(wasm, [pTypes, pPattern, resultPtr])

  const matches = startIndices.map((startIdx) => {
    const matchGroup = []
    for (let j = 0; j < sequence.length; j++) {
      const heIdx = startIdx + j
      const { id, type } = getHyperedgeInfo(index, heIdx)
      matchGroup.push({ id, type, vertices: getHyperedgeVertices(index, heIdx) })
    }
    return matchGroup
  })
  return { matches }
}

const querySimilar = (
  index: HypergraphIndex,
  inst: WasmInstance,
  embedding: number[],
  topK: number,
): z.infer<typeof SimilarOutputSchema> => {
  if (index.embeddingDocs.length === 0 || index.dims === 0) return { results: [] }

  const { exports: wasm } = inst
  const queryEmb = new Float32Array(embedding)
  const pEmb = lowerF32Array(inst, index.embeddings)
  const pQuery = lowerF32Array(inst, queryEmb)

  const resultPtr = wasm.__pin(wasm.similar(index.embeddingDocs.length, index.dims, pEmb, pQuery, topK))
  const entries = decodeSimilar(wasm, resultPtr)
  unpinAll(wasm, [pEmb, pQuery, resultPtr])

  const results = entries.map(({ docIdx, score }) => ({
    id: getEmbeddingDocId(index, docIdx),
    score,
  }))
  return { results }
}

const queryFilteredReachability = (
  index: HypergraphIndex,
  inst: WasmInstance,
  startVertices: string[],
  vertexTypeFilter?: string[],
  hyperedgeTypeFilter?: string[],
  maxDepth?: number,
): z.infer<typeof ReachabilityOutputSchema> => {
  // Resolve start vertex indices
  const startIndices: number[] = []
  for (const sv of startVertices) {
    const idx = index.vertexMap.get(sv)
    if (idx !== undefined) startIndices.push(idx)
  }
  if (startIndices.length === 0) return { vertices: [] }

  // Build vertex mask (1=traversable, 0=skip)
  const vertexMask = new Int32Array(index.vertexIds.length)
  if (vertexTypeFilter && vertexTypeFilter.length > 0) {
    const filterSet = new Set(vertexTypeFilter)
    for (let i = 0; i < index.vertexIds.length; i++) {
      const vt = index.vertexTypes[i] ?? ''
      vertexMask[i] = filterSet.has(vt) ? 1 : 0
    }
    // Start vertices always traversable
    for (const idx of startIndices) vertexMask[idx] = 1
  } else {
    vertexMask.fill(1)
  }

  // Build hyperedge mask
  const hyperedgeMask = new Int32Array(index.hyperedgeIds.length)
  if (hyperedgeTypeFilter && hyperedgeTypeFilter.length > 0) {
    const filterSet = new Set(hyperedgeTypeFilter)
    for (let i = 0; i < index.hyperedgeIds.length; i++) {
      const ht = index.hyperedgeTypes[i] ?? ''
      hyperedgeMask[i] = filterSet.has(ht) ? 1 : 0
    }
  } else {
    hyperedgeMask.fill(1)
  }

  const { exports: wasm } = inst
  const pVOff = lowerI32Array(inst, index.offsets)
  const pVNbr = lowerI32Array(inst, index.neighbors)
  const pHEOff = lowerI32Array(inst, index.heOffsets)
  const pHENbr = lowerI32Array(inst, index.heNeighbors)
  const pVMask = lowerI32Array(inst, vertexMask)
  const pHEMask = lowerI32Array(inst, hyperedgeMask)
  const pStarts = lowerI32Array(inst, new Int32Array(startIndices))

  const resultPtr = wasm.__pin(
    wasm.filteredReachability(
      index.vertexIds.length,
      index.hyperedgeIds.length,
      pVOff,
      pVNbr,
      pHEOff,
      pHENbr,
      pVMask,
      pHEMask,
      pStarts,
      startIndices.length,
      maxDepth ?? 0,
    ),
  )
  const entries = decodeReachability(wasm, resultPtr)
  unpinAll(wasm, [pVOff, pVNbr, pHEOff, pHENbr, pVMask, pHEMask, pStarts, resultPtr])

  const vertices = entries.map(({ vIdx, depth }) => ({
    id: getVertexId(index, vIdx),
    type: index.vertexTypes[vIdx] ?? '',
    depth,
  }))
  return { vertices }
}

const queryProvenance = async (dirPath: string): Promise<z.infer<typeof ProvenanceOutputSchema>> => {
  const { deriveProvenanceEdges } = await import('./hypergraph.utils.ts')
  const docs = await loadJsonLd(dirPath)
  // Filter to decision documents and sort by @id
  const decisions = docs.filter((doc) => Array.isArray(doc.bids) && typeof doc['@id'] === 'string')
  return { edges: deriveProvenanceEdges(decisions) }
}

// ============================================================================
// ToolHandler — search
// ============================================================================

/**
 * Query the hypergraph memory over JSON-LD files.
 *
 * @remarks
 * Loads `.jsonld` files from the given path, builds an in-memory incidence
 * structure, and runs the requested graph algorithm via WASM.
 * The `provenance` query is TS-only (no WASM overhead).
 *
 * @public
 */
export const search: ToolHandler = async (args, ctx) => {
  const input = HypergraphQuerySchema.parse(args)
  const dirPath = resolve(ctx.workspace, input.path)

  // Provenance is TS-only, no WASM needed
  if (input.query === 'provenance') {
    return queryProvenance(dirPath)
  }

  const docs = await loadJsonLd(dirPath)
  const index = buildIndex(docs)
  const inst = await loadWasm()

  switch (input.query) {
    case 'causal-chain':
      return queryCausalChain(index, inst, input.from, input.to)
    case 'co-occurrence':
      return queryCoOccurrence(index, inst, input.vertex)
    case 'check-cycles':
      return queryCheckCycles(index, inst)
    case 'match':
      return queryMatchPattern(index, inst, input.pattern.sequence)
    case 'similar':
      return querySimilar(index, inst, input.embedding, input.topK ?? 5)
    case 'reachability':
      return queryFilteredReachability(
        index,
        inst,
        input.startVertices,
        input.vertexTypeFilter,
        input.hyperedgeTypeFilter,
        input.maxDepth,
      )
  }
}

// ============================================================================
// Risk Tags & ToolDefinition
// ============================================================================

/**
 * Risk tags for the search tool — workspace-only (read-only graph queries).
 *
 * @public
 */
export const searchRiskTags: string[] = [RISK_TAG.workspace]

/**
 * OpenAI function-calling tool definition for the search tool.
 *
 * @public
 */
export const searchToolDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search',
    description:
      'Query the hypergraph memory. Supports causal-chain, co-occurrence, check-cycles, match, and similar queries over JSON-LD files.',
    parameters: z.toJSONSchema(HypergraphQuerySchema) as ToolDefinition['function']['parameters'],
  },
}

// ============================================================================
// ============================================================================
// CLI
// ============================================================================

/**
 * CLI handler for the search tool.
 *
 * @remarks
 * Uses `parseCli` directly since `HypergraphQuerySchema` is a discriminated
 * union (not `ZodObject`), which is incompatible with `makeCli`'s `.extend()`.
 *
 * @internal
 */
export const searchCli = async (args: string[]): Promise<void> => {
  const input = await parseCli(args, HypergraphQuerySchema, { name: 'search' })
  const ctx = { workspace: process.cwd(), env: {}, signal: AbortSignal.timeout(300_000) }
  try {
    const output = await search(input as Record<string, unknown>, ctx)
    // biome-ignore lint/suspicious/noConsole: CLI stdout output
    console.log(JSON.stringify(output))
  } catch (error) {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    process.exit(1)
  }
}

if (import.meta.main) {
  searchCli(process.argv.slice(2))
}
