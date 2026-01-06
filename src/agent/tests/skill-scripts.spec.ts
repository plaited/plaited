import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { ToolRegistry, ToolSchema } from '../agent.types.ts'
import {
  discoverSkillScripts,
  discoverSkills,
  formatSkillsContext,
  loadSkillScripts,
  registerSkillScripts,
  type SkillMetadata,
  type SkillScript,
  scriptsToToolSchemas,
} from '../skill-scripts.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_DIR = '/tmp/claude/test-skills'

const createTestSkill = async (name: string, frontmatter: Record<string, string>, scripts: string[] = []) => {
  const skillDir = join(TEST_DIR, name)
  await mkdir(skillDir, { recursive: true })

  // Create SKILL.md
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  await Bun.write(join(skillDir, 'SKILL.md'), `---\n${fm}\n---\n\n# ${name}\n`)

  // Create scripts directory if needed
  if (scripts.length > 0) {
    const scriptsDir = join(skillDir, 'scripts')
    await mkdir(scriptsDir, { recursive: true })

    for (const script of scripts) {
      const content = `/**\n * ${script} script description.\n */\nconsole.log('${script}')\n`
      await Bun.write(join(scriptsDir, `${script}.ts`), content)
    }
  }
}

beforeAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true })
  await mkdir(TEST_DIR, { recursive: true })

  // Create test skills
  await createTestSkill(
    'test-skill',
    {
      name: 'test-skill',
      description: 'A test skill for unit tests',
      license: 'MIT',
    },
    ['hello', 'world'],
  )

  await createTestSkill(
    'another-skill',
    {
      name: 'another-skill',
      description: 'Another test skill',
    },
    ['foo'],
  )

  // Skill without required frontmatter (should be skipped)
  await createTestSkill('invalid-skill', {
    name: 'invalid-skill',
    // missing description
  })

  // Skill with no scripts
  await createTestSkill('no-scripts', {
    name: 'no-scripts',
    description: 'Skill without scripts',
  })
})

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true })
})

// ============================================================================
// Skill Discovery Tests
// ============================================================================

describe('discoverSkills', () => {
  test('discovers skills with valid frontmatter', async () => {
    const skills = await discoverSkills(TEST_DIR)

    expect(skills.length).toBeGreaterThanOrEqual(2)
    expect(skills.some((s) => s.name === 'test-skill')).toBe(true)
    expect(skills.some((s) => s.name === 'another-skill')).toBe(true)
  })

  test('extracts all frontmatter fields', async () => {
    const skills = await discoverSkills(TEST_DIR)
    const testSkill = skills.find((s) => s.name === 'test-skill')

    expect(testSkill).toBeDefined()
    expect(testSkill!.description).toBe('A test skill for unit tests')
    expect(testSkill!.license).toBe('MIT')
    expect(testSkill!.directory).toContain('test-skill')
  })

  test('skips skills without required frontmatter', async () => {
    const skills = await discoverSkills(TEST_DIR)
    const invalid = skills.find((s) => s.name === 'invalid-skill')

    expect(invalid).toBeUndefined()
  })

  test('includes skills without scripts', async () => {
    const skills = await discoverSkills(TEST_DIR)
    const noScripts = skills.find((s) => s.name === 'no-scripts')

    expect(noScripts).toBeDefined()
    expect(noScripts!.description).toBe('Skill without scripts')
  })
})

// ============================================================================
// Script Discovery Tests
// ============================================================================

describe('discoverSkillScripts', () => {
  test('discovers scripts in skills directories', async () => {
    const scripts = await discoverSkillScripts({ skillsRoot: TEST_DIR })

    expect(scripts.length).toBeGreaterThanOrEqual(3)
    expect(scripts.some((s) => s.name === 'hello')).toBe(true)
    expect(scripts.some((s) => s.name === 'world')).toBe(true)
    expect(scripts.some((s) => s.name === 'foo')).toBe(true)
  })

  test('extracts description from JSDoc', async () => {
    const scripts = await discoverSkillScripts({ skillsRoot: TEST_DIR })
    const hello = scripts.find((s) => s.name === 'hello')

    expect(hello).toBeDefined()
    expect(hello!.description).toBe('hello script description.')
  })

  test('associates scripts with skill name', async () => {
    const scripts = await discoverSkillScripts({ skillsRoot: TEST_DIR })
    const hello = scripts.find((s) => s.name === 'hello')
    const foo = scripts.find((s) => s.name === 'foo')

    expect(hello!.skillName).toBe('test-skill')
    expect(foo!.skillName).toBe('another-skill')
  })

  test('provides default parameters schema', async () => {
    const scripts = await discoverSkillScripts({ skillsRoot: TEST_DIR })
    const hello = scripts.find((s) => s.name === 'hello')

    expect(hello!.parameters.type).toBe('object')
    expect(hello!.parameters.properties.args).toBeDefined()
  })
})

// ============================================================================
// Registration Tests
// ============================================================================

describe('registerSkillScripts', () => {
  test('registers scripts as tools in registry', () => {
    const handlers = new Map()
    const schemas: ToolSchema[] = []

    const mockRegistry: ToolRegistry = {
      register(name, handler, schema) {
        handlers.set(name, handler)
        schemas.push(schema)
      },
      get schemas() {
        return schemas
      },
    } as ToolRegistry

    const scripts: SkillScript[] = [
      {
        name: 'test',
        description: 'Test script',
        path: '/path/to/test.ts',
        skillDir: '/path/to',
        skillName: 'my-skill',
        parameters: { type: 'object', properties: {} },
      },
    ]

    registerSkillScripts(mockRegistry, scripts)

    expect(handlers.has('my-skill:test')).toBe(true)
    expect(schemas[0]!.name).toBe('my-skill:test')
    expect(schemas[0]!.description).toBe('[my-skill] Test script')
  })
})

describe('loadSkillScripts', () => {
  test('discovers and registers scripts in one call', async () => {
    const handlers = new Map()
    const schemas: ToolSchema[] = []

    const mockRegistry: ToolRegistry = {
      register(name, handler, schema) {
        handlers.set(name, handler)
        schemas.push(schema)
      },
      get schemas() {
        return schemas
      },
    } as ToolRegistry

    const scripts = await loadSkillScripts(mockRegistry, { skillsRoot: TEST_DIR })

    expect(scripts.length).toBeGreaterThanOrEqual(3)
    expect(handlers.has('test-skill:hello')).toBe(true)
    expect(handlers.has('test-skill:world')).toBe(true)
    expect(handlers.has('another-skill:foo')).toBe(true)
  })
})

// ============================================================================
// Context Injection Tests
// ============================================================================

describe('formatSkillsContext', () => {
  const testScripts: SkillScript[] = [
    {
      name: 'create',
      description: 'Create a resource',
      path: '/path/to/create.ts',
      skillDir: '/path/to',
      skillName: 'resource-manager',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Resource name' },
          type: { type: 'string', description: 'Resource type' },
        },
      },
    },
    {
      name: 'delete',
      description: 'Delete a resource',
      path: '/path/to/delete.ts',
      skillDir: '/path/to',
      skillName: 'resource-manager',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Resource ID' },
        },
      },
    },
  ]

  test('returns empty string for empty scripts', () => {
    const context = formatSkillsContext([])
    expect(context).toBe('')
  })

  test('generates valid XML structure', () => {
    const context = formatSkillsContext(testScripts)

    expect(context).toContain('<available_skills>')
    expect(context).toContain('</available_skills>')
    expect(context).toContain('<skill name="resource-manager">')
    expect(context).toContain('<tool name="resource-manager:create">')
    expect(context).toContain('<tool name="resource-manager:delete">')
  })

  test('includes parameter information', () => {
    const context = formatSkillsContext(testScripts)

    expect(context).toContain('<param name="name" type="string">')
    expect(context).toContain('Resource name')
    expect(context).toContain('<param name="id" type="string">')
  })

  test('uses skill metadata for descriptions when provided', () => {
    const skills: SkillMetadata[] = [
      {
        name: 'resource-manager',
        description: 'Manage cloud resources',
        path: '/path/to/SKILL.md',
        directory: '/path/to',
      },
    ]

    const context = formatSkillsContext(testScripts, skills)

    expect(context).toContain('Manage cloud resources')
  })

  test('falls back to default description without metadata', () => {
    const context = formatSkillsContext(testScripts)

    expect(context).toContain('Scripts from resource-manager skill')
  })
})

describe('scriptsToToolSchemas', () => {
  test('converts scripts to tool schemas', () => {
    const scripts: SkillScript[] = [
      {
        name: 'analyze',
        description: 'Analyze data',
        path: '/path/to/analyze.ts',
        skillDir: '/path/to',
        skillName: 'data-tools',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input file' },
          },
        },
      },
    ]

    const schemas = scriptsToToolSchemas(scripts)

    expect(schemas).toHaveLength(1)
    expect(schemas[0]!.name).toBe('data-tools:analyze')
    expect(schemas[0]!.description).toBe('Analyze data')
    expect(schemas[0]!.parameters.properties.input).toBeDefined()
  })

  test('prefixes tool names with skill name', () => {
    const scripts: SkillScript[] = [
      {
        name: 'run',
        description: 'Run task',
        path: '/path/to/run.ts',
        skillDir: '/path/to',
        skillName: 'task-runner',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'build',
        description: 'Build project',
        path: '/path/to/build.ts',
        skillDir: '/path/to',
        skillName: 'project-tools',
        parameters: { type: 'object', properties: {} },
      },
    ]

    const schemas = scriptsToToolSchemas(scripts)

    expect(schemas[0]!.name).toBe('task-runner:run')
    expect(schemas[1]!.name).toBe('project-tools:build')
  })
})
