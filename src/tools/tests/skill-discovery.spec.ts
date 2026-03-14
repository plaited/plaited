import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverSkills } from '../skill-discovery.ts'

const scriptsDir = join(import.meta.dir, '..')

describe('skill-discovery', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skill-discovery-test-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const createSkill = async (name: string, frontmatter: string, body = '# Test Skill') => {
    const skillDir = join(tempDir, name)
    await Bun.$`mkdir -p ${skillDir}`.quiet()
    await Bun.write(join(skillDir, 'SKILL.md'), `---\n${frontmatter}\n---\n\n${body}`)
    return skillDir
  }

  describe('discoverSkills', () => {
    test('discovers skills with valid frontmatter', async () => {
      const rootDir = join(tempDir, 'discover-valid')
      await createSkill('discover-valid/alpha-skill', 'name: alpha-skill\ndescription: First skill')
      await createSkill('discover-valid/beta-skill', 'name: beta-skill\ndescription: Second skill')

      const catalog = await discoverSkills(rootDir)

      expect(catalog).toHaveLength(2)
      const first = catalog.at(0)
      const second = catalog.at(1)
      expect(first).toBeDefined()
      expect(second).toBeDefined()
      expect(first!.name).toBe('alpha-skill')
      expect(first!.description).toBe('First skill')
      expect(first!.location).toEndWith('alpha-skill/SKILL.md')
      expect(second!.name).toBe('beta-skill')
      expect(second!.description).toBe('Second skill')
    })

    test('skips skills with malformed frontmatter', async () => {
      const rootDir = join(tempDir, 'discover-malformed')
      await createSkill('discover-malformed/good-skill', 'name: good-skill\ndescription: Valid')

      // Create a skill with no frontmatter delimiters
      const badDir = join(rootDir, 'bad-skill')
      await Bun.$`mkdir -p ${badDir}`.quiet()
      await Bun.write(join(badDir, 'SKILL.md'), '# No frontmatter here')

      const catalog = await discoverSkills(rootDir)

      expect(catalog).toHaveLength(1)
      const entry = catalog.at(0)
      expect(entry).toBeDefined()
      expect(entry!.name).toBe('good-skill')
    })

    test('skips skills with missing name field', async () => {
      const rootDir = join(tempDir, 'discover-noname')
      await createSkill('discover-noname/good-skill', 'name: good-skill\ndescription: Valid')
      await createSkill('discover-noname/nameless', 'description: No name field here')

      const catalog = await discoverSkills(rootDir)

      expect(catalog).toHaveLength(1)
      const entry = catalog.at(0)
      expect(entry).toBeDefined()
      expect(entry!.name).toBe('good-skill')
    })

    test('skips skills with missing description field', async () => {
      const rootDir = join(tempDir, 'discover-nodesc')
      await createSkill('discover-nodesc/good-skill', 'name: good-skill\ndescription: Valid')
      await createSkill('discover-nodesc/no-desc', 'name: no-desc')

      const catalog = await discoverSkills(rootDir)

      expect(catalog).toHaveLength(1)
      const entry = catalog.at(0)
      expect(entry).toBeDefined()
      expect(entry!.name).toBe('good-skill')
    })

    test('returns empty array for empty directory', async () => {
      const emptyDir = join(tempDir, 'discover-empty')
      await Bun.$`mkdir -p ${emptyDir}`.quiet()

      const catalog = await discoverSkills(emptyDir)

      expect(catalog).toHaveLength(0)
    })

    test('returns empty array for non-existent directory', async () => {
      const catalog = await discoverSkills(join(tempDir, 'nonexistent'))

      expect(catalog).toHaveLength(0)
    })

    test('returns location as absolute path to SKILL.md', async () => {
      const rootDir = join(tempDir, 'discover-location')
      await createSkill('discover-location/loc-skill', 'name: loc-skill\ndescription: Check location')

      const catalog = await discoverSkills(rootDir)

      expect(catalog).toHaveLength(1)
      const entry = catalog.at(0)
      expect(entry).toBeDefined()
      expect(entry!.location).toBe(join(rootDir, 'loc-skill', 'SKILL.md'))
    })
  })

  describe('CLI', () => {
    test('--help exits 0', async () => {
      const proc = Bun.spawn(['bun', `${scriptsDir}/skill-discovery.ts`, '--help'], {
        stderr: 'pipe',
        stdout: 'pipe',
      })
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
    })

    test('--schema input outputs JSON Schema', async () => {
      const result = await Bun.$`bun ${scriptsDir}/skill-discovery.ts --schema input`.quiet()
      const schema = JSON.parse(result.text())

      expect(schema.type).toBe('object')
      expect(schema.properties).toHaveProperty('paths')
    })

    test('--schema output outputs JSON Schema', async () => {
      const result = await Bun.$`bun ${scriptsDir}/skill-discovery.ts --schema output`.quiet()
      const schema = JSON.parse(result.text())

      expect(schema.type).toBe('array')
      expect(schema.items.properties).toHaveProperty('name')
      expect(schema.items.properties).toHaveProperty('description')
      expect(schema.items.properties).toHaveProperty('location')
    })

    test('discovers skills from specified paths', async () => {
      const rootDir = join(tempDir, 'discover-cli')
      await createSkill('discover-cli/cli-skill', 'name: cli-skill\ndescription: CLI test')

      const input = JSON.stringify({ paths: [rootDir] })
      const result = await Bun.$`bun ${scriptsDir}/skill-discovery.ts ${input}`.quiet().nothrow()
      const catalog = JSON.parse(result.text())

      expect(catalog).toHaveLength(1)
      const entry = catalog.at(0)
      expect(entry).toBeDefined()
      expect(entry!.name).toBe('cli-skill')
    })
  })
})
