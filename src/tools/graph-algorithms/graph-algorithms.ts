/**
 * Hypergraph graph algorithms compiled to WebAssembly via AssemblyScript.
 *
 * @remarks
 * Pure computation over integer-encoded graph data. No file I/O, no JSON,
 * no strings. The TS layer maps @id URIs to integer indices before calling
 * these functions. Data is passed via typed arrays in WASM linear memory.
 *
 * Graph encoding: CSR (Compressed Sparse Row) format.
 * - offsets[i] to offsets[i+1] gives the range in neighbors for vertex/hyperedge i
 * - neighbors contains the adjacent indices
 */

// ============================================================================
// Runtime type ID exports — used by TS bridge to allocate StaticArrays
// ============================================================================

export function staticArrayI32Id(): u32 { return idof<StaticArray<i32>>() }
export function staticArrayF32Id(): u32 { return idof<StaticArray<f32>>() }

// ============================================================================
// Memory helpers
// ============================================================================

/**
 * Read an i32 from a typed array at a given index.
 */
@inline
function readI32(ptr: StaticArray<i32>, idx: i32): i32 {
  return unchecked(ptr[idx])
}

// ============================================================================
// causalChain — BFS over vertex↔hyperedge incidence
// ============================================================================

/**
 * Find the shortest path of hyperedges connecting two vertices.
 *
 * @remarks
 * BFS alternates between vertex→hyperedge and hyperedge→vertex layers.
 * Two vertices connect if they share a hyperedge. The result is the
 * sequence of hyperedge indices forming the path.
 *
 * @param numVertices - Number of vertices in the graph
 * @param numHyperedges - Number of hyperedges in the graph
 * @param vOffsets - CSR offsets for vertex→hyperedge (length: numVertices + 1)
 * @param vNeighbors - CSR neighbors for vertex→hyperedge
 * @param heOffsets - CSR offsets for hyperedge→vertex (length: numHyperedges + 1)
 * @param heNeighbors - CSR neighbors for hyperedge→vertex
 * @param fromVertex - Source vertex index
 * @param toVertex - Target vertex index
 * @returns StaticArray<i32> — first element is length, followed by hyperedge indices
 */
export function causalChain(
  numVertices: i32,
  numHyperedges: i32,
  vOffsets: StaticArray<i32>,
  vNeighbors: StaticArray<i32>,
  heOffsets: StaticArray<i32>,
  heNeighbors: StaticArray<i32>,
  fromVertex: i32,
  toVertex: i32,
): StaticArray<i32> {
  if (fromVertex === toVertex) {
    const result = new StaticArray<i32>(1)
    unchecked((result[0] = 0))
    return result
  }

  // BFS state
  const visitedV = new StaticArray<bool>(numVertices)
  const visitedHE = new StaticArray<bool>(numHyperedges)
  const parentHE = new StaticArray<i32>(numVertices) // which hyperedge reached this vertex
  const parentV = new StaticArray<i32>(numHyperedges) // which vertex reached this hyperedge

  for (let i: i32 = 0; i < numVertices; i++) {
    unchecked((parentHE[i] = -1))
  }
  for (let i: i32 = 0; i < numHyperedges; i++) {
    unchecked((parentV[i] = -1))
  }

  // Queue of vertex indices
  const queue = new Array<i32>()
  queue.push(fromVertex)
  unchecked((visitedV[fromVertex] = true))

  let found = false

  while (queue.length > 0) {
    const v = queue.shift()

    // Expand vertex → hyperedges
    const heStart = unchecked(vOffsets[v])
    const heEnd = unchecked(vOffsets[v + 1])

    for (let i = heStart; i < heEnd; i++) {
      const he = unchecked(vNeighbors[i])
      if (unchecked(visitedHE[he])) continue
      unchecked((visitedHE[he] = true))
      unchecked((parentV[he] = v))

      // Expand hyperedge → vertices
      const vStart = unchecked(heOffsets[he])
      const vEnd = unchecked(heOffsets[he + 1])

      for (let j = vStart; j < vEnd; j++) {
        const nextV = unchecked(heNeighbors[j])
        if (unchecked(visitedV[nextV])) continue
        unchecked((visitedV[nextV] = true))
        unchecked((parentHE[nextV] = he))
        queue.push(nextV)

        if (nextV === toVertex) {
          found = true
          break
        }
      }
      if (found) break
    }
    if (found) break
  }

  if (!found) {
    const result = new StaticArray<i32>(1)
    unchecked((result[0] = 0))
    return result
  }

  // Trace back from toVertex to fromVertex
  const path = new Array<i32>()
  let cur = toVertex
  while (cur !== fromVertex) {
    const he = unchecked(parentHE[cur])
    path.push(he)
    cur = unchecked(parentV[he])
  }

  // Reverse and pack result
  const pathLen = path.length
  const result = new StaticArray<i32>(pathLen + 1)
  unchecked((result[0] = pathLen))
  for (let i: i32 = 0; i < pathLen; i++) {
    unchecked((result[i + 1] = path[pathLen - 1 - i]))
  }
  return result
}

// ============================================================================
// coOccurrence — direct CSR lookup
// ============================================================================

/**
 * Find all hyperedges containing a given vertex.
 *
 * @param vOffsets - CSR offsets for vertex→hyperedge
 * @param vNeighbors - CSR neighbors for vertex→hyperedge
 * @param vertex - Vertex index to look up
 * @returns StaticArray<i32> — first element is count, followed by hyperedge indices
 */
export function coOccurrence(
  vOffsets: StaticArray<i32>,
  vNeighbors: StaticArray<i32>,
  vertex: i32,
): StaticArray<i32> {
  const start = unchecked(vOffsets[vertex])
  const end = unchecked(vOffsets[vertex + 1])
  const count = end - start

  const result = new StaticArray<i32>(count + 1)
  unchecked((result[0] = count))
  for (let i: i32 = 0; i < count; i++) {
    unchecked((result[i + 1] = vNeighbors[start + i]))
  }
  return result
}

// ============================================================================
// checkCycles — DFS with coloring on directed adjacency
// ============================================================================

const WHITE: i32 = 0
const GRAY: i32 = 1
const BLACK: i32 = 2

/**
 * Detect cycles in a directed graph (blockedBy relationships).
 *
 * @remarks
 * DFS with white/gray/black coloring. When a gray node is revisited,
 * the cycle is extracted by tracing the parent chain.
 *
 * @param numVertices - Number of vertices
 * @param dirOffsets - CSR offsets for directed adjacency
 * @param dirNeighbors - CSR neighbors (target vertices from blockedBy)
 * @returns StaticArray<i32> — layout: [numCycles, len1, v1a, v1b, ..., len2, ...]
 */
export function checkCycles(
  numVertices: i32,
  dirOffsets: StaticArray<i32>,
  dirNeighbors: StaticArray<i32>,
): StaticArray<i32> {
  const color = new StaticArray<i32>(numVertices)
  const parent = new StaticArray<i32>(numVertices)
  const cycles = new Array<Array<i32>>()

  for (let i: i32 = 0; i < numVertices; i++) {
    unchecked((parent[i] = -1))
  }

  for (let i: i32 = 0; i < numVertices; i++) {
    if (unchecked(color[i]) === WHITE) {
      dfs(i, color, parent, dirOffsets, dirNeighbors, cycles)
    }
  }

  // Pack cycles into flat array
  let totalLen: i32 = 1 // numCycles header
  for (let i = 0; i < cycles.length; i++) {
    totalLen += 1 + unchecked(cycles[i]).length // length prefix + vertices
  }

  const result = new StaticArray<i32>(totalLen)
  unchecked((result[0] = cycles.length))
  let offset: i32 = 1
  for (let i = 0; i < cycles.length; i++) {
    const cycle = unchecked(cycles[i])
    unchecked((result[offset] = cycle.length))
    offset++
    for (let j = 0; j < cycle.length; j++) {
      unchecked((result[offset] = cycle[j]))
      offset++
    }
  }
  return result
}

function dfs(
  v: i32,
  color: StaticArray<i32>,
  parent: StaticArray<i32>,
  dirOffsets: StaticArray<i32>,
  dirNeighbors: StaticArray<i32>,
  cycles: Array<Array<i32>>,
): void {
  unchecked((color[v] = GRAY))

  const start = unchecked(dirOffsets[v])
  const end = unchecked(dirOffsets[v + 1])

  for (let i = start; i < end; i++) {
    const u = unchecked(dirNeighbors[i])

    if (unchecked(color[u]) === WHITE) {
      unchecked((parent[u] = v))
      dfs(u, color, parent, dirOffsets, dirNeighbors, cycles)
    } else if (unchecked(color[u]) === GRAY) {
      // Found cycle — trace back from v to u
      const cycle = new Array<i32>()
      cycle.push(u)
      let cur = v
      while (cur !== u) {
        cycle.push(cur)
        cur = unchecked(parent[cur])
      }
      cycles.push(cycle)
    }
  }

  unchecked((color[v] = BLACK))
}

// ============================================================================
// matchPattern — sliding window over hyperedge types
// ============================================================================

/**
 * Find runs of consecutive hyperedges matching a type pattern.
 *
 * @remarks
 * Hyperedges are assumed pre-sorted by superstep (the TS layer handles ordering).
 * Types are integer-encoded (TS maps @type strings to i32 indices).
 *
 * @param numHyperedges - Number of hyperedges
 * @param types - Type index per hyperedge (length: numHyperedges)
 * @param pattern - Pattern type indices to match (length: patternLen)
 * @param patternLen - Length of pattern
 * @returns StaticArray<i32> — [numMatches, startIdx1, startIdx2, ...]
 */
export function matchPattern(
  numHyperedges: i32,
  types: StaticArray<i32>,
  pattern: StaticArray<i32>,
  patternLen: i32,
): StaticArray<i32> {
  const matches = new Array<i32>()

  if (patternLen <= 0 || patternLen > numHyperedges) {
    const result = new StaticArray<i32>(1)
    unchecked((result[0] = 0))
    return result
  }

  for (let i: i32 = 0; i <= numHyperedges - patternLen; i++) {
    let match = true
    for (let j: i32 = 0; j < patternLen; j++) {
      if (unchecked(types[i + j]) !== unchecked(pattern[j])) {
        match = false
        break
      }
    }
    if (match) {
      matches.push(i)
    }
  }

  const result = new StaticArray<i32>(matches.length + 1)
  unchecked((result[0] = matches.length))
  for (let i: i32 = 0; i < matches.length; i++) {
    unchecked((result[i + 1] = matches[i]))
  }
  return result
}

// ============================================================================
// similar — brute-force cosine similarity
// ============================================================================

/**
 * Find top-K most similar documents by cosine similarity.
 *
 * @remarks
 * Brute-force: computes cosine similarity between the query embedding and
 * every document embedding. Maintains a sorted result of top-K entries.
 * At the scale of hundreds to low thousands of documents, this is <1ms.
 *
 * @param numDocs - Number of documents with embeddings
 * @param dims - Embedding dimensionality
 * @param embeddings - Flat row-major embeddings (length: numDocs * dims)
 * @param queryEmb - Query embedding (length: dims)
 * @param topK - Number of top results to return
 * @returns StaticArray<f32> — [topK_actual, docIdx1, score1, docIdx2, score2, ...]
 */
export function similar(
  numDocs: i32,
  dims: i32,
  embeddings: StaticArray<f32>,
  queryEmb: StaticArray<f32>,
  topK: i32,
): StaticArray<f32> {
  if (numDocs === 0 || dims === 0) {
    const result = new StaticArray<f32>(1)
    unchecked((result[0] = 0.0))
    return result
  }

  // Compute query magnitude
  let queryMag: f32 = 0.0
  for (let d: i32 = 0; d < dims; d++) {
    const val = unchecked(queryEmb[d])
    queryMag += val * val
  }
  queryMag = f32(Math.sqrt(f64(queryMag)))

  if (queryMag === 0.0) {
    const result = new StaticArray<f32>(1)
    unchecked((result[0] = 0.0))
    return result
  }

  // Compute cosine similarity for each doc
  const scores = new StaticArray<f32>(numDocs)
  for (let i: i32 = 0; i < numDocs; i++) {
    let dot: f32 = 0.0
    let docMag: f32 = 0.0
    const base = i * dims
    for (let d: i32 = 0; d < dims; d++) {
      const docVal = unchecked(embeddings[base + d])
      const qVal = unchecked(queryEmb[d])
      dot += docVal * qVal
      docMag += docVal * docVal
    }
    docMag = f32(Math.sqrt(f64(docMag)))
    unchecked((scores[i] = docMag > 0.0 ? dot / (docMag * queryMag) : 0.0))
  }

  // Find top-K via partial sort (selection)
  const actualK = topK < numDocs ? topK : numDocs
  const indices = new StaticArray<i32>(numDocs)
  for (let i: i32 = 0; i < numDocs; i++) {
    unchecked((indices[i] = i))
  }

  // Simple selection: for each position 0..actualK-1, find max in remaining
  for (let i: i32 = 0; i < actualK; i++) {
    let maxIdx = i
    for (let j: i32 = i + 1; j < numDocs; j++) {
      if (unchecked(scores[unchecked(indices[j])]) > unchecked(scores[unchecked(indices[maxIdx])])) {
        maxIdx = j
      }
    }
    if (maxIdx !== i) {
      const tmp = unchecked(indices[i])
      unchecked((indices[i] = unchecked(indices[maxIdx])))
      unchecked((indices[maxIdx] = tmp))
    }
  }

  // Pack result: [actualK, docIdx1, score1, docIdx2, score2, ...]
  const result = new StaticArray<f32>(1 + actualK * 2)
  unchecked((result[0] = f32(actualK)))
  for (let i: i32 = 0; i < actualK; i++) {
    const idx = unchecked(indices[i])
    unchecked((result[1 + i * 2] = f32(idx)))
    unchecked((result[2 + i * 2] = scores[idx]))
  }
  return result
}
