import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const scriptsDir = join(import.meta.dir, '..')

describe('validate-skill', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'validate-skill-test-'))
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

  const runValidation = async (path: string, json = true) => {
    const args = json ? ['--json'] : []
    const result = await Bun.$`bun ${scriptsDir}/validate-skill.ts ${path} ${args}`.quiet().nothrow()
    if (json) {
      return JSON.parse(result.text())
    }
    return result
  }

  describe('single skill validation', () => {
    test('validates skill with required fields only', async () => {
      const skillDir = await createSkill('valid-skill', 'name: valid-skill\ndescription: A test skill')

      const [result] = await runValidation(skillDir)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.properties?.name).toBe('valid-skill')
      expect(result.properties?.description).toBe('A test skill')
    })

    test('validates skill with all optional fields', async () => {
      const skillDir = await createSkill(
        'full-skill',
        `name: full-skill
description: A complete skill
license: MIT
compatibility: Requires bun
allowed-tools: Bash Read Write
metadata:
  author: test
  version: "1.0"`,
      )

      const [result] = await runValidation(skillDir)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.properties?.license).toBe('MIT')
      expect(result.properties?.compatibility).toBe('Requires bun')
      expect(result.properties?.['allowed-tools']).toBe('Bash Read Write')
      expect(result.properties?.metadata).toEqual({ author: 'test', version: '1.0' })
    })

    test('reports error for missing name', async () => {
      const skillDir = await createSkill('no-name', 'description: Missing name field')

      const [result] = await runValidation(skillDir)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Missing required field in frontmatter: 'name'")
    })

    test('reports error for missing description', async () => {
      const skillDir = await createSkill('no-desc', 'name: no-desc')

      const [result] = await runValidation(skillDir)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Missing required field in frontmatter: 'description'")
    })

    test('reports error for name exceeding 64 characters', async () => {
      const longName = 'a'.repeat(65)
      const skillDir = await createSkill(longName, `name: ${longName}\ndescription: Too long name`)

      const [result] = await runValidation(skillDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes('64 character limit'))).toBe(true)
    })

    test('reports error for description exceeding 1024 characters', async () => {
      const longDesc = 'a'.repeat(1025)
      const skillDir = await createSkill('long-desc', `name: long-desc\ndescription: ${longDesc}`)

      const [result] = await runValidation(skillDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes('1024 character limit'))).toBe(true)
    })

    test('reports error for uppercase name', async () => {
      const skillDir = await createSkill('Upper-Case', 'name: Upper-Case\ndescription: Uppercase name')

      const [result] = await runValidation(skillDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes('lowercase'))).toBe(true)
    })

    test('reports error for consecutive hyphens', async () => {
      const skillDir = await createSkill('bad--name', 'name: bad--name\ndescription: Consecutive hyphens')

      const [result] = await runValidation(skillDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes('consecutive hyphens'))).toBe(true)
    })

    test('reports error for name starting with hyphen', async () => {
      const skillDir = await createSkill('leadhyphen', 'name: -lead-hyphen\ndescription: Leading hyphen')

      const [result] = await runValidation(skillDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes('start or end with a hyphen'))).toBe(true)
    })

    test('reports error for name not matching directory', async () => {
      const skillDir = await createSkill('dir-name', 'name: different-name\ndescription: Mismatched names')

      const [result] = await runValidation(skillDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes('must match skill name'))).toBe(true)
    })

    test('reports error for missing SKILL.md', async () => {
      const skillDir = join(tempDir, 'empty-skill')
      await Bun.$`mkdir -p ${skillDir}`.quiet()

      const [result] = await runValidation(skillDir)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing required file: SKILL.md')
    })

    test('reports error for non-existent directory', async () => {
      const [result] = await runValidation(join(tempDir, 'nonexistent'))

      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes('does not exist'))).toBe(true)
    })

    test('reports error for compatibility exceeding 500 characters', async () => {
      const longCompat = 'a'.repeat(501)
      const skillDir = await createSkill(
        'long-compat',
        `name: long-compat\ndescription: Test\ncompatibility: ${longCompat}`,
      )

      const [result] = await runValidation(skillDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes('500 character limit'))).toBe(true)
    })
  })

  describe('multiple skills validation', () => {
    test('validates multiple skills in directory', async () => {
      const multiDir = join(tempDir, 'multi')
      await Bun.$`mkdir -p ${multiDir}`.quiet()

      await createSkill('multi/valid-one', 'name: valid-one\ndescription: First valid skill')
      await createSkill('multi/valid-two', 'name: valid-two\ndescription: Second valid skill')

      const results = await runValidation(multiDir)

      expect(results).toHaveLength(2)
      expect(results.every((r: { valid: boolean }) => r.valid)).toBe(true)
    })

    test('reports mixed valid and invalid skills', async () => {
      const mixedDir = join(tempDir, 'mixed')
      await Bun.$`mkdir -p ${mixedDir}`.quiet()

      await createSkill('mixed/good-skill', 'name: good-skill\ndescription: Valid skill')
      await createSkill('mixed/bad-skill', 'description: Missing name')

      const results = await runValidation(mixedDir)

      expect(results).toHaveLength(2)
      const valid = results.filter((r: { valid: boolean }) => r.valid)
      const invalid = results.filter((r: { valid: boolean }) => !r.valid)
      expect(valid).toHaveLength(1)
      expect(invalid).toHaveLength(1)
    })
  })

  describe('CLI output', () => {
    test('exits with code 1 on validation errors', async () => {
      const skillDir = await createSkill('cli-exit', 'description: No name field')

      const proc = Bun.spawn(['bun', `${scriptsDir}/validate-skill.ts`, skillDir], {
        stderr: 'pipe',
        stdout: 'pipe',
      })
      const exitCode = await proc.exited

      expect(exitCode).toBe(1)
    })

    test('exits with code 0 on valid skills', async () => {
      const skillDir = await createSkill('cli-success', 'name: cli-success\ndescription: Valid skill')

      const proc = Bun.spawn(['bun', `${scriptsDir}/validate-skill.ts`, skillDir], {
        stderr: 'pipe',
        stdout: 'pipe',
      })
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
    })
  })
})
