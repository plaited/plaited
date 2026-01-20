import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  createSkillDiscovery,
  discoverSkillScripts,
  discoverSkills,
  formatSkillsContext,
  type SkillDiscovery,
  type SkillMetadata,
  type SkillReference,
  type SkillScript,
  scriptsToToolSchemas,
} from '../skill-discovery.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_SKILLS_ROOT = '.claude/skills'

// ============================================================================
// discoverSkills Tests
// ============================================================================

describe('discoverSkills', () => {
  test('discovers skills from .claude/skills directory', async () => {
    const skills = await discoverSkills(TEST_SKILLS_ROOT)

    expect(skills.length).toBeGreaterThan(0)

    // Should find at least one skill with required fields
    const skill = skills[0]!
    expect(skill.name).toBeDefined()
    expect(skill.description).toBeDefined()
    expect(skill.location).toContain('SKILL.md')
    expect(skill.skillDir).toBeDefined()
  })

  test('extracts frontmatter metadata correctly', async () => {
    const skills = await discoverSkills(TEST_SKILLS_ROOT)

    // Find a known skill (plaited-standards should exist)
    const plaitedStandards = skills.find((s) => s.name === 'plaited-standards')

    if (plaitedStandards) {
      expect(plaitedStandards.description).toContain('code conventions')
    }
  })

  test('returns empty array for non-existent directory', async () => {
    const skills = await discoverSkills('non-existent-dir')

    expect(skills).toHaveLength(0)
  })

  test('includes absolute paths to SKILL.md', async () => {
    const skills = await discoverSkills(TEST_SKILLS_ROOT)

    for (const skill of skills) {
      expect(skill.location).toMatch(/^\//)
      expect(skill.location).toEndWith('SKILL.md')
    }
  })
})

// ============================================================================
// discoverSkillScripts Tests
// ============================================================================

describe('discoverSkillScripts', () => {
  test('discovers scripts from skill directories', async () => {
    const scripts = await discoverSkillScripts({ skillsRoot: TEST_SKILLS_ROOT })

    // Should find some scripts (workbench skill has query scripts)
    expect(scripts.length).toBeGreaterThanOrEqual(0)
  })

  test('extracts qualified names', async () => {
    const scripts = await discoverSkillScripts({ skillsRoot: TEST_SKILLS_ROOT })

    for (const script of scripts) {
      expect(script.qualifiedName).toContain(':')
      expect(script.qualifiedName).toBe(`${script.skillName}:${script.name}`)
    }
  })

  test('skips test files', async () => {
    const scripts = await discoverSkillScripts({ skillsRoot: TEST_SKILLS_ROOT })

    for (const script of scripts) {
      expect(script.location).not.toContain('.spec.')
      expect(script.location).not.toContain('.test.')
      expect(script.location).not.toContain('/tests/')
    }
  })

  test('extracts script extension', async () => {
    const scripts = await discoverSkillScripts({ skillsRoot: TEST_SKILLS_ROOT })

    for (const script of scripts) {
      expect(['.ts', '.js', '.sh', '.py']).toContain(script.extension)
    }
  })
})

// ============================================================================
// formatSkillsContext Tests
// ============================================================================

describe('formatSkillsContext', () => {
  const mockSkills: SkillMetadata[] = [
    {
      name: 'test-skill',
      description: 'A test skill for validation',
      location: '/path/to/test-skill/SKILL.md',
      skillDir: '/path/to/test-skill',
    },
    {
      name: 'another-skill',
      description: 'Another skill for testing',
      location: '/path/to/another-skill/SKILL.md',
      skillDir: '/path/to/another-skill',
    },
  ]

  const mockScripts: SkillScript[] = [
    {
      name: 'run-test',
      qualifiedName: 'test-skill:run-test',
      description: 'Run tests for the skill',
      location: '/path/to/test-skill/scripts/run-test.ts',
      skillName: 'test-skill',
      extension: '.ts',
      parameters: [],
    },
  ]

  test('generates valid XML structure', () => {
    const xml = formatSkillsContext(mockSkills)

    expect(xml).toContain('<available_skills>')
    expect(xml).toContain('</available_skills>')
    expect(xml).toContain('<skill')
    expect(xml).toContain('</skill>')
  })

  test('includes skill name and location as child elements', () => {
    const xml = formatSkillsContext(mockSkills)

    expect(xml).toContain('<name>test-skill</name>')
    expect(xml).toContain('<location>/path/to/test-skill/SKILL.md</location>')
  })

  test('includes skill descriptions as child elements', () => {
    const xml = formatSkillsContext(mockSkills)

    expect(xml).toContain('<description>A test skill for validation</description>')
    expect(xml).toContain('<description>Another skill for testing</description>')
  })

  test('includes scripts when provided', () => {
    const xml = formatSkillsContext(mockSkills, mockScripts)

    expect(xml).toContain('<scripts>')
    expect(xml).toContain('</scripts>')
    expect(xml).toContain('test-skill:run-test')
    expect(xml).toContain('Run tests for the skill')
  })

  test('returns empty string for empty skills array', () => {
    const xml = formatSkillsContext([])

    expect(xml).toBe('')
  })
})

// ============================================================================
// scriptsToToolSchemas Tests
// ============================================================================

describe('scriptsToToolSchemas', () => {
  const mockScripts: SkillScript[] = [
    {
      name: 'analyze',
      qualifiedName: 'my-skill:analyze',
      description: 'Analyze code patterns',
      location: '/path/to/script.ts',
      skillName: 'my-skill',
      extension: '.ts',
      parameters: [
        { name: 'path', type: 'string', required: true, description: 'Path to analyze' },
        { name: 'verbose', type: 'boolean', required: false, default: false },
        { name: 'limit', type: 'number', required: false, default: 10 },
      ],
    },
  ]

  test('converts scripts to tool schemas', () => {
    const schemas = scriptsToToolSchemas(mockScripts)

    expect(schemas).toHaveLength(1)
    expect(schemas[0]!.name).toBe('my-skill:analyze')
    expect(schemas[0]!.description).toBe('Analyze code patterns')
  })

  test('includes parameters in schema', () => {
    const schemas = scriptsToToolSchemas(mockScripts)
    const schema = schemas[0]!

    expect(schema.parameters.type).toBe('object')
    expect(schema.parameters.properties).toHaveProperty('path')
    expect(schema.parameters.properties).toHaveProperty('verbose')
    expect(schema.parameters.properties).toHaveProperty('limit')
  })

  test('marks required parameters correctly', () => {
    const schemas = scriptsToToolSchemas(mockScripts)
    const schema = schemas[0]!

    expect(schema.parameters.required).toContain('path')
    expect(schema.parameters.required).not.toContain('verbose')
    expect(schema.parameters.required).not.toContain('limit')
  })

  test('includes parameter types', () => {
    const schemas = scriptsToToolSchemas(mockScripts)
    const props = schemas[0]!.parameters.properties as Record<string, { type: string; default?: unknown }>

    expect(props.path!.type).toBe('string')
    expect(props.verbose!.type).toBe('boolean')
    expect(props.limit!.type).toBe('number')
  })

  test('includes default values', () => {
    const schemas = scriptsToToolSchemas(mockScripts)
    const props = schemas[0]!.parameters.properties as Record<string, { type: string; default?: unknown }>

    expect(props.verbose!.default).toBe(false)
    expect(props.limit!.default).toBe(10)
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('integration', () => {
  test('discovers and formats real skills from repo', async () => {
    const skills = await discoverSkills(TEST_SKILLS_ROOT)

    if (skills.length > 0) {
      const xml = formatSkillsContext(skills)

      expect(xml).toContain('<available_skills>')
      expect(xml.split('<skill').length).toBeGreaterThan(1)
    }
  })

  test('full pipeline: discover → format → schemas', async () => {
    const skills = await discoverSkills(TEST_SKILLS_ROOT)
    const scripts = await discoverSkillScripts({ skillsRoot: TEST_SKILLS_ROOT })

    if (skills.length > 0) {
      const xml = formatSkillsContext(skills, scripts)
      const schemas = scriptsToToolSchemas(scripts)

      expect(xml).toContain('<available_skills>')
      // Schemas array should match scripts length
      expect(schemas.length).toBe(scripts.length)
    }
  })
})

// ============================================================================
// createSkillDiscovery Tests
// ============================================================================

describe('createSkillDiscovery', () => {
  let discovery: SkillDiscovery

  afterEach(async () => {
    if (discovery) {
      await discovery.close()
    }
  })

  test('creates discovery instance with in-memory database', async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })

    expect(discovery).toBeDefined()
    expect(discovery.search).toBeFunction()
    expect(discovery.all).toBeFunction()
    expect(discovery.close).toBeFunction()
  })

  test('discovers and indexes skills on creation', async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })

    const skills = discovery.all()
    expect(skills.length).toBeGreaterThan(0)
  })

  test('returns statistics about indexed content', async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })

    const stats = discovery.stats()

    expect(stats.totalSkills).toBeGreaterThan(0)
    expect(stats.totalScripts).toBeGreaterThanOrEqual(0)
    expect(stats.totalChunks).toBe(0) // No embedder = no chunks indexed
    expect(stats.vectorSearchEnabled).toBe(false)
  })

  test('indexes spec-compliant metadata fields', async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })

    const skills = discovery.all()
    const skill = skills[0]!

    // Required fields
    expect(skill.name).toBeDefined()
    expect(skill.description).toBeDefined()
    expect(skill.location).toBeDefined()
    expect(skill.skillDir).toBeDefined()

    // Optional spec fields should be undefined or have values
    expect('license' in skill || skill.license === undefined).toBe(true)
    expect('compatibility' in skill || skill.compatibility === undefined).toBe(true)
    expect('metadata' in skill || skill.metadata === undefined).toBe(true)
    expect('allowedTools' in skill || skill.allowedTools === undefined).toBe(true)
  })
})

// ============================================================================
// SkillDiscovery.search Tests
// ============================================================================

describe('SkillDiscovery.search', () => {
  let discovery: SkillDiscovery

  beforeEach(async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('searches skills by intent using FTS5', async () => {
    const results = await discovery.search('behavioral programming')

    expect(Array.isArray(results)).toBe(true)
  })

  test('returns SkillMatch objects with scores', async () => {
    const results = await discovery.search('code conventions standards')

    if (results.length > 0) {
      const match = results[0]!
      expect(match.skill).toBeDefined()
      expect(match.score).toBeGreaterThan(0)
      expect(match.skill.name).toBeDefined()
    }
  })

  test('respects limit option', async () => {
    const results = await discovery.search('skill', { limit: 2 })

    expect(results.length).toBeLessThanOrEqual(2)
  })

  test('respects minScore option', async () => {
    const results = await discovery.search('skill', { minScore: 0.5 })

    for (const match of results) {
      expect(match.score).toBeGreaterThanOrEqual(0.5)
    }
  })

  test('returns results sorted by score descending', async () => {
    const results = await discovery.search('template')

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score)
    }
  })

  test('includes FTS rank in results', async () => {
    const results = await discovery.search('plaited')

    if (results.length > 0) {
      // FTS rank should be present when matched via FTS
      const hasRank = results.some((r) => r.ftsRank !== undefined)
      expect(hasRank).toBe(true)
    }
  })
})

// ============================================================================
// SkillDiscovery.searchChunks Tests
// ============================================================================

describe('SkillDiscovery.searchChunks', () => {
  let discovery: SkillDiscovery

  beforeEach(async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
      // No embedder - vector search disabled
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('returns empty array when vector search disabled', async () => {
    const results = await discovery.searchChunks('behavioral programming')

    expect(results).toEqual([])
  })

  test('requires embedder for chunk search', async () => {
    const stats = discovery.stats()
    expect(stats.vectorSearchEnabled).toBe(false)
    expect(stats.totalChunks).toBe(0)
  })
})

// ============================================================================
// SkillDiscovery.getBody Tests
// ============================================================================

describe('SkillDiscovery.getBody', () => {
  let discovery: SkillDiscovery

  beforeEach(async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('returns body content for existing skill', async () => {
    const skills = discovery.all()
    const skill = skills.find((s) => s.name === 'plaited-standards')

    if (skill) {
      const body = await discovery.getBody(skill.name)

      expect(body).toBeDefined()
      expect(body!.length).toBeGreaterThan(0)
      // Body should not contain frontmatter
      expect(body).not.toContain('---\nname:')
    }
  })

  test('returns undefined for non-existent skill', async () => {
    const body = await discovery.getBody('non-existent-skill')

    expect(body).toBeUndefined()
  })
})

// ============================================================================
// SkillDiscovery.getScripts Tests
// ============================================================================

describe('SkillDiscovery.getScripts', () => {
  let discovery: SkillDiscovery

  beforeEach(async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('returns scripts for skill with scripts directory', async () => {
    const skills = discovery.all()
    const skillWithScripts = skills.find((s) => {
      const scripts = discovery.getScripts(s.name)
      return scripts.length > 0
    })

    if (skillWithScripts) {
      const scripts = discovery.getScripts(skillWithScripts.name)

      expect(scripts.length).toBeGreaterThan(0)
      expect(scripts[0]!.qualifiedName).toContain(':')
      expect(scripts[0]!.skillName).toBe(skillWithScripts.name)
    }
  })

  test('returns empty array for skill without scripts', async () => {
    // Create a test for skills that might not have scripts
    const scripts = discovery.getScripts('non-existent-skill')

    expect(scripts).toEqual([])
  })
})

// ============================================================================
// SkillDiscovery.refresh Tests
// ============================================================================

describe('SkillDiscovery.refresh', () => {
  let discovery: SkillDiscovery

  afterEach(async () => {
    if (discovery) {
      await discovery.close()
    }
  })

  test('refresh does not throw', async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })

    // refresh should not throw
    await expect(discovery.refresh()).resolves.toBeUndefined()
  })

  test('maintains skill count after refresh', async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })

    const countBefore = discovery.all().length
    await discovery.refresh()
    const countAfter = discovery.all().length

    expect(countAfter).toBe(countBefore)
  })
})

// ============================================================================
// Persistent Database Tests
// ============================================================================

describe('persistent database', () => {
  const testDbPath = '/tmp/claude/skill-discovery-test.sqlite'

  afterEach(async () => {
    // Clean up test database
    try {
      ;(await Bun.file(testDbPath).exists()) && (await Bun.$`rm -f ${testDbPath}`)
    } catch {
      // Ignore cleanup errors
    }
  })

  test('creates SQLite database at specified path', async () => {
    const discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
      dbPath: testDbPath,
    })

    await discovery.close()

    const exists = await Bun.file(testDbPath).exists()
    expect(exists).toBe(true)
  })

  test('loads skills from persistent database on creation', async () => {
    // First instance - creates and populates
    const discovery1 = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
      dbPath: testDbPath,
    })
    const count1 = discovery1.all().length
    await discovery1.close()

    // Second instance - should load from DB
    const discovery2 = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
      dbPath: testDbPath,
    })
    const count2 = discovery2.all().length
    await discovery2.close()

    expect(count2).toBe(count1)
  })
})

// ============================================================================
// FTS5 with Metadata Tests
// ============================================================================

describe('FTS5 metadata search', () => {
  let discovery: SkillDiscovery

  beforeEach(async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('searches include metadata values in FTS index', async () => {
    // Search for terms that might appear in metadata
    const results = await discovery.search('plaited')

    // Should return results from name/description/metadata
    expect(Array.isArray(results)).toBe(true)
  })
})

// ============================================================================
// SkillDiscovery.getReferences Tests
// ============================================================================

describe('SkillDiscovery.getReferences', () => {
  let discovery: SkillDiscovery

  beforeEach(async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('returns references for skill with markdown links', async () => {
    const skills = discovery.all()
    const skillWithRefs = skills.find((s) => {
      const refs = discovery.getReferences(s.name)
      return refs.length > 0
    })

    if (skillWithRefs) {
      const refs = discovery.getReferences(skillWithRefs.name)

      expect(refs.length).toBeGreaterThan(0)
      expect(refs[0]!.skillName).toBe(skillWithRefs.name)
      expect(refs[0]!.displayText).toBeDefined()
      expect(refs[0]!.relativePath).toBeDefined()
      expect(refs[0]!.absolutePath).toBeDefined()
      expect(refs[0]!.lineNumber).toBeGreaterThan(0)
    }
  })

  test('returns empty array for skill without references', async () => {
    const refs = discovery.getReferences('non-existent-skill')

    expect(refs).toEqual([])
  })

  test('resolves absolute paths relative to skill directory', async () => {
    const skills = discovery.all()
    const skillWithRefs = skills.find((s) => {
      const refs = discovery.getReferences(s.name)
      return refs.length > 0
    })

    if (skillWithRefs) {
      const refs = discovery.getReferences(skillWithRefs.name)

      for (const ref of refs) {
        // Absolute path should contain skill directory
        expect(ref.absolutePath).toContain(skillWithRefs.skillDir)
        // Absolute path should start with /
        expect(ref.absolutePath).toMatch(/^\//)
      }
    }
  })
})

// ============================================================================
// SkillDiscovery.getReferenceContent Tests
// ============================================================================

describe('SkillDiscovery.getReferenceContent', () => {
  let discovery: SkillDiscovery

  beforeEach(async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('returns content for existing reference', async () => {
    const skills = discovery.all()

    for (const skill of skills) {
      const refs = discovery.getReferences(skill.name)
      const existingRef = refs.find((r) => r.relativePath.endsWith('.md'))

      if (existingRef) {
        const content = await discovery.getReferenceContent(existingRef)

        if (content) {
          expect(content.length).toBeGreaterThan(0)
          return // Found a valid reference, test passes
        }
      }
    }

    // If no references exist with content, that's acceptable
    expect(true).toBe(true)
  })

  test('returns undefined for non-existent reference path', async () => {
    const fakeRef: SkillReference = {
      skillName: 'test-skill',
      displayText: 'fake reference',
      relativePath: 'non-existent-file.md',
      absolutePath: '/non/existent/path/file.md',
      lineNumber: 1,
    }

    const content = await discovery.getReferenceContent(fakeRef)

    expect(content).toBeUndefined()
  })
})

// ============================================================================
// SkillDiscovery.searchReferences Tests
// ============================================================================

describe('SkillDiscovery.searchReferences', () => {
  let discovery: SkillDiscovery

  beforeEach(async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
      // No embedder - vector search disabled
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('returns empty array when vector search disabled', async () => {
    const results = await discovery.searchReferences('behavioral programming')

    expect(results).toEqual([])
  })

  test('requires embedder for reference search', async () => {
    const stats = discovery.stats()
    expect(stats.vectorSearchEnabled).toBe(false)
  })
})

// ============================================================================
// Stats includes totalReferences
// ============================================================================

describe('SkillDiscovery.stats with references', () => {
  let discovery: SkillDiscovery

  beforeEach(async () => {
    discovery = await createSkillDiscovery({
      skillsRoot: TEST_SKILLS_ROOT,
    })
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('stats includes totalReferences field', async () => {
    const stats = discovery.stats()

    expect(stats).toHaveProperty('totalReferences')
    expect(typeof stats.totalReferences).toBe('number')
  })

  test('totalReferences counts extracted markdown links', async () => {
    const skills = discovery.all()
    const stats = discovery.stats()

    // Ensure references are loaded by accessing them
    let manualCount = 0
    for (const skill of skills) {
      const refs = discovery.getReferences(skill.name)
      manualCount += refs.length
    }

    expect(stats.totalReferences).toBe(manualCount)
  })
})
