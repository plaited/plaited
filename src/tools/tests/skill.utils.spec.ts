/**
 * Tests for skill utility functions.
 *
 * @remarks
 * Covers: parseFrontmatter, findSkillMd, isDirectory, findSkillDirectories.
 * Uses temp directories for filesystem tests.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { findSkillDirectories, findSkillMd, isDirectory, parseFrontmatter } from '../skill.utils.ts'

// ============================================================================
// parseFrontmatter
// ============================================================================

describe('parseFrontmatter', () => {
  test('parses valid frontmatter with metadata and body', () => {
    const content = `---
name: my-skill
description: A test skill
---

# Body Content

Some markdown here.`

    const result = parseFrontmatter(content)
    expect(result.metadata.name).toBe('my-skill')
    expect(result.metadata.description).toBe('A test skill')
    expect(result.body).toContain('# Body Content')
    expect(result.body).toContain('Some markdown here.')
  })

  test('parses frontmatter with nested metadata', () => {
    const content = `---
name: nested-skill
metadata:
  contentType: tools
  scale: "2"
---

Body.`

    const result = parseFrontmatter(content)
    expect(result.metadata.name).toBe('nested-skill')
    const meta = result.metadata.metadata as Record<string, string>
    expect(meta.contentType).toBe('tools')
    expect(meta.scale).toBe('2')
  })

  test('parses frontmatter with allowed-tools array', () => {
    const content = `---
name: tool-skill
allowed-tools:
  - Read
  - Grep
  - Glob
---

Body.`

    const result = parseFrontmatter(content)
    const tools = result.metadata['allowed-tools'] as string[]
    expect(tools).toEqual(['Read', 'Grep', 'Glob'])
  })

  test('handles empty body after frontmatter', () => {
    const content = `---
name: empty-body
description: no body
---`

    const result = parseFrontmatter(content)
    expect(result.metadata.name).toBe('empty-body')
    expect(result.body).toBe('')
  })

  test('throws when content does not start with ---', () => {
    expect(() => parseFrontmatter('# No frontmatter')).toThrow('must start with YAML frontmatter')
  })

  test('throws when frontmatter is not closed', () => {
    expect(() => parseFrontmatter('---\nname: broken\n')).toThrow('not properly closed')
  })

  test('throws when frontmatter is not a mapping', () => {
    expect(() => parseFrontmatter('---\n- list item\n---\nBody')).toThrow('must be a mapping')
  })

  test('handles leading whitespace', () => {
    const content = `  ---
name: trimmed
---

Body.`

    const result = parseFrontmatter(content)
    expect(result.metadata.name).toBe('trimmed')
  })
})

// ============================================================================
// findSkillMd
// ============================================================================

describe('findSkillMd', () => {
  let tempDir: string

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  })

  test('finds SKILL.md (uppercase)', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'skill-test-'))
    await Bun.write(join(tempDir, 'SKILL.md'), '---\nname: test\n---\nBody')

    const result = await findSkillMd(tempDir)
    expect(result).toBe(join(tempDir, 'SKILL.md'))
  })

  test('finds SKILL.md when it exists', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'skill-test-'))
    await Bun.write(join(tempDir, 'SKILL.md'), '---\nname: test\n---\nBody')

    const result = await findSkillMd(tempDir)
    expect(result).not.toBeNull()
    expect(result).toContain('SKILL.md')
  })

  test('returns null when no SKILL.md exists', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'skill-test-'))
    const result = await findSkillMd(tempDir)
    expect(result).toBeNull()
  })
})

// ============================================================================
// isDirectory
// ============================================================================

describe('isDirectory', () => {
  test('returns true for existing directory', async () => {
    const result = await isDirectory(tmpdir())
    expect(result).toBe(true)
  })

  test('returns false for file path', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'isdir-test-'))
    const filePath = join(tempDir, 'file.txt')
    await Bun.write(filePath, 'content')

    const result = await isDirectory(filePath)
    expect(result).toBe(false)
    rmSync(tempDir, { recursive: true, force: true })
  })

  test('returns false for nonexistent path', async () => {
    const result = await isDirectory('/nonexistent/path/that/does/not/exist')
    expect(result).toBe(false)
  })
})

// ============================================================================
// findSkillDirectories
// ============================================================================

describe('findSkillDirectories', () => {
  let tempDir: string

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  })

  test('finds skill directories recursively', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'skills-test-'))
    const skillA = join(tempDir, 'skill-a')
    const skillB = join(tempDir, 'skill-b')

    await Bun.write(join(skillA, 'SKILL.md'), '---\nname: a\n---\n')
    await Bun.write(join(skillB, 'SKILL.md'), '---\nname: b\n---\n')

    const dirs = await findSkillDirectories(tempDir)
    expect(dirs).toHaveLength(2)
    expect(dirs[0]).toContain('skill-a')
    expect(dirs[1]).toContain('skill-b')
  })

  test('returns sorted results', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'skills-test-'))
    await Bun.write(join(tempDir, 'zebra', 'SKILL.md'), '---\nname: z\n---\n')
    await Bun.write(join(tempDir, 'alpha', 'SKILL.md'), '---\nname: a\n---\n')

    const dirs = await findSkillDirectories(tempDir)
    expect(dirs[0]).toContain('alpha')
    expect(dirs[1]).toContain('zebra')
  })

  test('returns empty for nonexistent directory', async () => {
    const dirs = await findSkillDirectories('/nonexistent/path')
    expect(dirs).toEqual([])
  })

  test('returns empty for directory with no SKILL.md files', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'skills-test-'))
    await Bun.write(join(tempDir, 'readme.md'), 'not a skill')

    const dirs = await findSkillDirectories(tempDir)
    expect(dirs).toEqual([])
  })
})
