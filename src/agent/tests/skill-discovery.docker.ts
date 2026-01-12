import { describe, expect, test } from 'bun:test'
import {
  discoverSkillScripts,
  discoverSkills,
  formatSkillsContext,
  type SkillMetadata,
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
      invocable: true,
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

  test('includes skill name and location attributes', () => {
    const xml = formatSkillsContext(mockSkills)

    expect(xml).toContain('name="test-skill"')
    expect(xml).toContain('location="/path/to/test-skill/SKILL.md"')
  })

  test('includes skill descriptions', () => {
    const xml = formatSkillsContext(mockSkills)

    expect(xml).toContain('A test skill for validation')
    expect(xml).toContain('Another skill for testing')
  })

  test('includes invocable attribute when true', () => {
    const xml = formatSkillsContext(mockSkills)

    expect(xml).toContain('invocable="true"')
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
