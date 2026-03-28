import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_HYPERGRAPH_PROGRAM_PATH,
  DEFAULT_HYPERGRAPH_SEED_PATH,
  getDefaultHypergraphStatus,
  isDefaultHypergraphValid,
  renderDefaultHypergraphStatus,
} from '../default-hypergraph.ts'

describe('default-hypergraph script', () => {
  test('reports the configured program path', async () => {
    const status = await getDefaultHypergraphStatus()

    expect(status.programPath).toBe(DEFAULT_HYPERGRAPH_PROGRAM_PATH)
  })

  test('renders a readable status block', async () => {
    const status = await getDefaultHypergraphStatus()
    const output = renderDefaultHypergraphStatus(status)

    expect(output).toContain('program: default-hypergraph')
    expect(output).toContain(`programPath: ${DEFAULT_HYPERGRAPH_PROGRAM_PATH}`)
    expect(output).toContain(`seedPath: ${DEFAULT_HYPERGRAPH_SEED_PATH}`)
    expect(output).toContain('requirements:')
  })

  test('validates against the current repo state', async () => {
    const status = await getDefaultHypergraphStatus()

    expect(isDefaultHypergraphValid(status)).toBe(true)
  })

  test('loads a non-empty seed graph with no missing concepts or links', async () => {
    const status = await getDefaultHypergraphStatus()

    expect(status.seedDocs).toBeGreaterThan(0)
    expect(status.vertexCount).toBeGreaterThan(0)
    expect(status.hyperedgeCount).toBeGreaterThan(0)
    expect(status.missingConcepts).toHaveLength(0)
    expect(status.missingInternalReferences).toHaveLength(0)
    expect(status.missingSkillLinks).toHaveLength(0)
  })
})
