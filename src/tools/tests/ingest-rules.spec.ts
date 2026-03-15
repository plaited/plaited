/**
 * Tests for AGENTS.md → JSON-LD RuleSet ingestion (ingest-rules).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { ingestRules, parseRuleSections } from '../ingest-rules.ts'

// ============================================================================
// Fixtures
// ============================================================================

const FIXTURES_DIR = join(import.meta.dir, 'fixtures/ingest-rules')
const MEMORY_DIR = join(FIXTURES_DIR, '.memory')

const SAMPLE_AGENTS_MD = `# AGENTS.md

## Rules

# Bun APIs

**Prefer Bun over Node.js** when running in Bun environment.

## File system

- \`Bun.file(path).exists()\` not \`fs.existsSync()\`
- \`Bun.file(path).text()\` not \`readFileSync()\`

## Shell commands

- \`Bun.$\` not \`child_process.spawn()\`

# Testing

**Use test not it** — \`test('description', ...)\`

## Organize with describe

Group related tests in \`describe('feature', () => {...})\`

## Coverage checklist

Happy path, edge cases, error paths, real integrations

# Module Organization

**No index.ts** — never use index files

## Explicit extensions

\`import { x } from './file.ts'\` not \`'./file'\`
`

beforeAll(async () => {
  await Bun.write(join(FIXTURES_DIR, 'AGENTS.md'), SAMPLE_AGENTS_MD)
})

afterAll(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true })
})

// ============================================================================
// parseRuleSections
// ============================================================================

describe('parseRuleSections', () => {
  test('parses top-level sections (skips file title)', () => {
    const sections = parseRuleSections(SAMPLE_AGENTS_MD)
    const titles = sections.map((s) => s.title)
    expect(titles).not.toContain('AGENTS.md')
    expect(titles).toContain('Bun APIs')
    expect(titles).toContain('Testing')
    expect(titles).toContain('Module Organization')
  })

  test('extracts subsections within each section', () => {
    const sections = parseRuleSections(SAMPLE_AGENTS_MD)
    const bunApis = sections.find((s) => s.title === 'Bun APIs')!
    expect(bunApis.subsections.length).toBe(2)
    expect(bunApis.subsections[0]!.title).toBe('File system')
    expect(bunApis.subsections[1]!.title).toBe('Shell commands')
  })

  test('subsection content is captured', () => {
    const sections = parseRuleSections(SAMPLE_AGENTS_MD)
    const testing = sections.find((s) => s.title === 'Testing')!
    const coverage = testing.subsections.find((s) => s.title === 'Coverage checklist')!
    expect(coverage.content).toContain('Happy path')
  })

  test('section content before first subsection is captured', () => {
    const sections = parseRuleSections(SAMPLE_AGENTS_MD)
    const bunApis = sections.find((s) => s.title === 'Bun APIs')!
    expect(bunApis.content).toContain('Prefer Bun over Node.js')
  })

  test('empty input → empty', () => {
    expect(parseRuleSections('')).toEqual([])
  })

  test('input with only file title → empty', () => {
    expect(parseRuleSections('# AGENTS.md\n\nSome content')).toEqual([])
  })
})

// ============================================================================
// ingestRules
// ============================================================================

describe('ingestRules', () => {
  test('generates one RuleSet per top-level section', async () => {
    const agentsPath = join(FIXTURES_DIR, 'AGENTS.md')
    const result = await ingestRules(agentsPath, MEMORY_DIR)

    // 3 sections: Bun APIs, Testing, Module Organization
    expect(result.vertices.length).toBe(3)
  })

  test('RuleSet vertex has correct JSON-LD shape', async () => {
    const agentsPath = join(FIXTURES_DIR, 'AGENTS.md')
    const result = await ingestRules(agentsPath, MEMORY_DIR)

    const bunApis = result.vertices.find((v) => v.vertex['@id'] === 'rules://bun-apis')!
    expect(bunApis).toBeDefined()
    expect(bunApis.vertex['@type']).toBe('RuleSet')
    expect(bunApis.vertex['schema:name']).toBe('Bun APIs')
    expect(bunApis.vertex.source).toBe(join(FIXTURES_DIR, 'AGENTS.md'))
  })

  test('subsections become rules within the RuleSet', async () => {
    const agentsPath = join(FIXTURES_DIR, 'AGENTS.md')
    const result = await ingestRules(agentsPath, MEMORY_DIR)

    const bunApis = result.vertices.find((v) => v.vertex['@id'] === 'rules://bun-apis')!
    const rules = bunApis.vertex.rules as { '@id': string; 'schema:name': string }[]
    expect(rules.length).toBe(2)
    expect(rules[0]!['schema:name']).toBe('File system')
    expect(rules[1]!['schema:name']).toBe('Shell commands')
  })

  test('rule @id includes parent section slug', async () => {
    const agentsPath = join(FIXTURES_DIR, 'AGENTS.md')
    const result = await ingestRules(agentsPath, MEMORY_DIR)

    const testing = result.vertices.find((v) => v.vertex['@id'] === 'rules://testing')!
    const rules = testing.vertex.rules as { '@id': string }[]
    expect(rules[0]!['@id']).toBe('rule://testing/organize-with-describe')
  })

  test('writes .jsonld files to rules/ directory', async () => {
    const agentsPath = join(FIXTURES_DIR, 'AGENTS.md')
    const result = await ingestRules(agentsPath, MEMORY_DIR)

    for (const v of result.vertices) {
      expect(v.vertexPath).toContain('rules/')
      const exists = await Bun.file(v.vertexPath).exists()
      expect(exists).toBe(true)
    }
  })

  test('non-existent file throws', async () => {
    await expect(ingestRules('/tmp/no-agents.md', MEMORY_DIR)).rejects.toThrow('does not exist')
  })

  test('vertices include timestamp', async () => {
    const agentsPath = join(FIXTURES_DIR, 'AGENTS.md')
    const result = await ingestRules(agentsPath, MEMORY_DIR)

    for (const v of result.vertices) {
      expect(typeof v.vertex.timestamp).toBe('string')
    }
  })
})
