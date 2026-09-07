import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { grep } from '../grep.ts'
import { tempDir } from './helpers.ts'

describe('grep tool', () => {
  test('finds matching lines in files', async () => {
    const { dir, cleanup } = await tempDir({
      'file1.txt': 'hello world\nfoo bar\nhello again',
    })

    try {
      const result = await grep({ cwd: process.cwd(), pattern: 'hello', dir })
      expect(result.matches.length).toBeGreaterThanOrEqual(1)
      const match = result.matches.find((m) => m.line === 1)
      expect(match).toBeDefined()
      expect(match!.text).toContain('hello')
      expect(result.truncated).toBe(false)
      expect(result.limit).toBe(100)
    } finally {
      await cleanup()
    }
  })

  test('no matches returns empty array with info message', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'hello world' })
    try {
      const result = await grep({ cwd: process.cwd(), pattern: 'zzz_nonexistent', dir })
      expect(result.matches).toHaveLength(0)
      expect(result.message).toContain('no matches')
      expect(result.isError).toBeUndefined()
    } finally {
      await cleanup()
    }
  })

  test('limit input caps match count and appends a notice', async () => {
    // Create a file with many matches
    const lines = Array.from({ length: 50 }, () => 'match line').join('\n')
    const { dir, cleanup } = await tempDir({ 'file.txt': lines })
    try {
      const result = await grep({ cwd: process.cwd(), pattern: 'match', dir, limit: 10 })
      expect(result.matches).toHaveLength(10)
      expect(result.truncated).toBe(true)
      expect(result.notice).toContain('10 matches limit reached')
      expect(result.notice).toContain('limit=20')
      expect(result.limit).toBe(10)
    } finally {
      await cleanup()
    }
  })

  test('long lines are truncated to 500 chars with a notice', async () => {
    const longLine = 'x'.repeat(600)
    const { dir, cleanup } = await tempDir({ 'file.txt': longLine })
    try {
      const result = await grep({ cwd: process.cwd(), pattern: 'x', dir })
      expect(result.matches).toHaveLength(1)
      expect(result.matches[0]!.text).toContain('[truncated]')
      expect(result.truncated).toBe(true)
      expect(result.notice).toContain('truncated to 500 chars')
    } finally {
      await cleanup()
    }
  })

  test('ignoreCase flag matches case-insensitively', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'Hello World\nHELLO AGAIN' })
    try {
      const result = await grep({ cwd: process.cwd(), pattern: 'hello', dir, ignoreCase: true })
      expect(result.matches).toHaveLength(2)
    } finally {
      await cleanup()
    }
  })

  test('literal flag treats pattern as literal string', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'a.b.c\naXbXc\n.*test' })
    try {
      const result = await grep({ cwd: process.cwd(), pattern: 'a.b.c', dir, literal: true })
      // Literal "a.b.c" should match the first line (a.b.c) and the .*test line
      // but NOT aXbXc (the . is literal, not a regex wildcard)
      const matchedTexts = result.matches.map((m) => m.text)
      expect(matchedTexts).toContain('a.b.c')
      expect(matchedTexts).not.toContain('aXbXc')
    } finally {
      await cleanup()
    }
  })

  test('context input includes surrounding lines', async () => {
    const { dir, cleanup } = await tempDir({
      'file.txt': 'line1\nline2\nMATCH\nline4\nline5',
    })
    try {
      const result = await grep({ cwd: process.cwd(), pattern: 'MATCH', dir, context: 1 })
      expect(result.matches).toHaveLength(1)
      // The text should include context lines (multi-line)
      expect(result.matches[0]!.text).toContain('MATCH')
      expect(result.matches[0]!.text).toContain('line2')
      expect(result.matches[0]!.text).toContain('line4')
    } finally {
      await cleanup()
    }
  })

  test('--json parsing handles paths containing colons', async () => {
    // Create a file whose name contains a colon — the old colon-splitting
    // parser would break on this.
    const { dir, cleanup } = await tempDir({})
    const fileName = 'weird:name.txt'
    await Bun.write(path.join(dir, fileName), 'hello world\nhello again')
    try {
      const result = await grep({ cwd: process.cwd(), pattern: 'hello', dir })
      expect(result.matches.length).toBeGreaterThanOrEqual(1)
      // The path should be the relative file name, not a truncated version
      expect(result.matches.some((m) => m.path === fileName)).toBe(true)
    } finally {
      await cleanup()
    }
  })

  test('include glob filters file types', async () => {
    const { dir, cleanup } = await tempDir({
      'match.ts': 'findme',
      'match.js': 'findme',
      'match.txt': 'findme',
    })
    try {
      const result = await grep({ cwd: process.cwd(), pattern: 'findme', dir, include: '*.ts' })
      expect(result.matches).toHaveLength(1)
      expect(result.matches[0]!.path).toBe('match.ts')
    } finally {
      await cleanup()
    }
  })
})
