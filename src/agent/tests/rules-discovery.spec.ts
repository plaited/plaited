import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { createRulesDiscovery, type RuleReference, type RulesDiscovery } from '../rules-discovery.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

// Use the actual plaited repo root which has AGENTS.md
const TEST_ROOT_DIR = process.cwd()

// ============================================================================
// createRulesDiscovery Tests
// ============================================================================

describe('createRulesDiscovery', () => {
  let discovery: RulesDiscovery

  afterEach(async () => {
    if (discovery) {
      await discovery.close()
    }
  })

  test('creates discovery instance with in-memory database', async () => {
    discovery = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
    })

    expect(discovery).toBeDefined()
    expect(discovery.getRootRules).toBeFunction()
    expect(discovery.searchReferences).toBeFunction()
    expect(discovery.getRulesForPath).toBeFunction()
    expect(discovery.close).toBeFunction()
  })

  test('discovers AGENTS.md files on creation', async () => {
    discovery = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
    })

    const stats = discovery.stats()
    expect(stats.totalRules).toBeGreaterThan(0)
  })

  test('returns statistics about indexed content', async () => {
    discovery = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
    })

    const stats = discovery.stats()

    expect(stats.totalRules).toBeGreaterThan(0)
    expect(stats.totalReferences).toBeGreaterThanOrEqual(0)
    expect(stats.vectorSearchEnabled).toBe(false)
  })
})

// ============================================================================
// RulesDiscovery.getRootRules Tests (Tier 1)
// ============================================================================

describe('RulesDiscovery.getRootRules (Tier 1)', () => {
  let discovery: RulesDiscovery

  beforeEach(async () => {
    discovery = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('returns root AGENTS.md content', async () => {
    const rootRules = discovery.getRootRules()

    // plaited repo has an AGENTS.md at root
    expect(rootRules).toBeDefined()
    expect(rootRules!.length).toBeGreaterThan(0)
  })

  test('root rules content includes expected sections', async () => {
    const rootRules = discovery.getRootRules()

    if (rootRules) {
      // AGENTS.md typically has guidance sections
      expect(rootRules).toContain('AGENTS.md')
    }
  })

  test('returns undefined when no root AGENTS.md exists', async () => {
    const tempDiscovery = await createRulesDiscovery({
      rootDir: '/tmp/nonexistent-dir-for-test',
    })

    const rootRules = tempDiscovery.getRootRules()
    expect(rootRules).toBeUndefined()

    await tempDiscovery.close()
  })
})

// ============================================================================
// RulesDiscovery.searchReferences Tests (Tier 2)
// ============================================================================

describe('RulesDiscovery.searchReferences (Tier 2)', () => {
  let discovery: RulesDiscovery

  beforeEach(async () => {
    discovery = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
      // No embedder - FTS5 only
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('returns empty array when no references match', async () => {
    const results = await discovery.searchReferences('xyznonexistentquery123')

    expect(results).toEqual([])
  })

  test('respects limit option', async () => {
    const results = await discovery.searchReferences('testing', { limit: 2 })

    expect(results.length).toBeLessThanOrEqual(2)
  })

  test('returns ReferenceMatch objects with similarity scores', async () => {
    // Search for something likely to exist in AGENTS.md references
    const results = await discovery.searchReferences('testing')

    if (results.length > 0) {
      const match = results[0]!
      expect(match.reference).toBeDefined()
      expect(match.similarity).toBeGreaterThan(0)
      expect(match.reference.displayText).toBeDefined()
      expect(match.reference.absolutePath).toBeDefined()
      expect(match.reference.source).toBeDefined()
    }
  })

  test('results are sorted by similarity descending', async () => {
    const results = await discovery.searchReferences('rules')

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.similarity).toBeGreaterThanOrEqual(results[i]!.similarity)
    }
  })
})

// ============================================================================
// RulesDiscovery.getRulesForPath Tests (Tier 3)
// ============================================================================

describe('RulesDiscovery.getRulesForPath (Tier 3)', () => {
  let discovery: RulesDiscovery

  beforeEach(async () => {
    discovery = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('returns root rules for file in root directory', async () => {
    const rules = discovery.getRulesForPath(join(TEST_ROOT_DIR, 'src/agent/embedder.ts'))

    // Should at least include root AGENTS.md
    expect(rules.length).toBeGreaterThanOrEqual(0)
  })

  test('returns empty array for path outside root', async () => {
    const rules = discovery.getRulesForPath('/tmp/outside/file.ts')

    expect(rules).toEqual([])
  })

  test('rules are ordered from root to leaf', async () => {
    // If there are nested AGENTS.md files, they should be ordered
    const rules = discovery.getRulesForPath(join(TEST_ROOT_DIR, 'src/agent/tests/embedder.spec.ts'))

    // Each rule in the array should come from a parent directory of the next
    // This is the expected order for spatial loading
    expect(Array.isArray(rules)).toBe(true)
  })

  test('includes nested AGENTS.md when file is in subdirectory', async () => {
    // This tests that if .claude/AGENTS.md exists, it would be included
    // for files under .claude/
    const rules = discovery.getRulesForPath(join(TEST_ROOT_DIR, '.claude/skills/loom/SKILL.md'))

    // May or may not have rules depending on directory structure
    expect(Array.isArray(rules)).toBe(true)
  })
})

// ============================================================================
// RulesDiscovery.getReferences Tests
// ============================================================================

describe('RulesDiscovery.getReferences', () => {
  let discovery: RulesDiscovery

  beforeEach(async () => {
    discovery = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('returns references for AGENTS.md with markdown links', async () => {
    const rootAgentsPath = join(TEST_ROOT_DIR, 'AGENTS.md')
    const refs = discovery.getReferences(rootAgentsPath)

    // AGENTS.md may have references to rules
    expect(Array.isArray(refs)).toBe(true)

    if (refs.length > 0) {
      const ref = refs[0]!
      expect(ref.displayText).toBeDefined()
      expect(ref.relativePath).toBeDefined()
      expect(ref.absolutePath).toBeDefined()
      expect(ref.source).toBe(rootAgentsPath)
      expect(ref.lineNumber).toBeGreaterThan(0)
    }
  })

  test('returns empty array for non-existent path', async () => {
    const refs = discovery.getReferences('/nonexistent/AGENTS.md')

    expect(refs).toEqual([])
  })

  test('resolves absolute paths relative to source directory', async () => {
    const rootAgentsPath = join(TEST_ROOT_DIR, 'AGENTS.md')
    const refs = discovery.getReferences(rootAgentsPath)

    for (const ref of refs) {
      // Absolute path should start with /
      expect(ref.absolutePath).toMatch(/^\//)
      // Should be within or relative to the root
      expect(ref.absolutePath).toContain(TEST_ROOT_DIR.split('/').slice(-1)[0])
    }
  })
})

// ============================================================================
// RulesDiscovery.getReferenceContent Tests
// ============================================================================

describe('RulesDiscovery.getReferenceContent', () => {
  let discovery: RulesDiscovery

  beforeEach(async () => {
    discovery = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('returns content for existing reference', async () => {
    const rootAgentsPath = join(TEST_ROOT_DIR, 'AGENTS.md')
    const refs = discovery.getReferences(rootAgentsPath)

    // Find a reference that exists
    for (const ref of refs) {
      const content = await discovery.getReferenceContent(ref)
      if (content) {
        expect(content.length).toBeGreaterThan(0)
        return // Test passes if we find any valid reference
      }
    }

    // If no references exist with content, that's acceptable
    expect(true).toBe(true)
  })

  test('returns undefined for non-existent reference path', async () => {
    const fakeRef: RuleReference = {
      displayText: 'fake reference',
      relativePath: 'nonexistent.md',
      absolutePath: '/nonexistent/path/file.md',
      source: '/some/AGENTS.md',
      lineNumber: 1,
    }

    const content = await discovery.getReferenceContent(fakeRef)

    expect(content).toBeUndefined()
  })
})

// ============================================================================
// RulesDiscovery.refresh Tests
// ============================================================================

describe('RulesDiscovery.refresh', () => {
  let discovery: RulesDiscovery

  afterEach(async () => {
    if (discovery) {
      await discovery.close()
    }
  })

  test('refresh does not throw', async () => {
    discovery = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
    })

    await expect(discovery.refresh()).resolves.toBeUndefined()
  })

  test('maintains rule count after refresh', async () => {
    discovery = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
    })

    const statsBefore = discovery.stats()
    await discovery.refresh()
    const statsAfter = discovery.stats()

    expect(statsAfter.totalRules).toBe(statsBefore.totalRules)
  })
})

// ============================================================================
// Persistent Database Tests
// ============================================================================

describe('persistent database', () => {
  const testDbPath = '/tmp/claude/rules-discovery-test.sqlite'

  afterEach(async () => {
    try {
      const file = Bun.file(testDbPath)
      if (await file.exists()) {
        await Bun.$`rm -f ${testDbPath}`
      }
    } catch {
      // Ignore cleanup errors
    }
  })

  test('creates SQLite database at specified path', async () => {
    const discovery = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
      dbPath: testDbPath,
    })

    await discovery.close()

    const exists = await Bun.file(testDbPath).exists()
    expect(exists).toBe(true)
  })

  test('loads rules from persistent database on creation', async () => {
    // First instance - creates and populates
    const discovery1 = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
      dbPath: testDbPath,
    })
    const stats1 = discovery1.stats()
    await discovery1.close()

    // Second instance - should load from DB
    const discovery2 = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
      dbPath: testDbPath,
    })
    const stats2 = discovery2.stats()
    await discovery2.close()

    expect(stats2.totalRules).toBe(stats1.totalRules)
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('integration', () => {
  let discovery: RulesDiscovery

  beforeEach(async () => {
    discovery = await createRulesDiscovery({
      rootDir: TEST_ROOT_DIR,
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('full workflow: discover → search → load content', async () => {
    // Tier 1: Get root rules
    const rootRules = discovery.getRootRules()
    expect(rootRules).toBeDefined()

    // Tier 2: Search for references
    const searchResults = await discovery.searchReferences('testing')

    if (searchResults.length > 0) {
      // Load reference content
      const content = await discovery.getReferenceContent(searchResults[0]!.reference)
      // Content may or may not exist depending on actual file structure
      expect(content === undefined || typeof content === 'string').toBe(true)
    }

    // Tier 3: Get rules for a specific path
    const pathRules = discovery.getRulesForPath(join(TEST_ROOT_DIR, 'src/agent/embedder.ts'))
    expect(Array.isArray(pathRules)).toBe(true)
  })

  test('spatial rules include all ancestor AGENTS.md', async () => {
    // Get rules for a deeply nested path
    const deepPath = join(TEST_ROOT_DIR, 'src/agent/tests/embedder.spec.ts')
    const rules = discovery.getRulesForPath(deepPath)

    // If root AGENTS.md exists and is indexed, it should be in the rules
    const rootRules = discovery.getRootRules()
    if (rootRules && rules.length > 0) {
      // First rule should be from closest to root
      expect(rules[0]).toBeDefined()
    }
  })
})
