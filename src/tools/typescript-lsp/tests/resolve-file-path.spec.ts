import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { resolveFilePath } from '../resolve-file-path.ts'

describe('resolveFilePath', () => {
  describe('absolute paths', () => {
    test('returns absolute path as-is', () => {
      const absolutePath = '/Users/test/file.ts'
      const result = resolveFilePath(absolutePath)
      expect(result).toBe(absolutePath)
    })
  })

  describe('relative paths with extension', () => {
    test('resolves ./path from cwd', () => {
      const relativePath = './src/resolve-file-path.ts'
      const result = resolveFilePath(relativePath)
      expect(result).toBe(join(process.cwd(), relativePath))
    })

    test('resolves ../path from cwd', () => {
      const relativePath = '../other/file.ts'
      const result = resolveFilePath(relativePath)
      expect(result).toBe(join(process.cwd(), relativePath))
    })

    test('resolves various file extensions', () => {
      const extensions = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json']

      for (const ext of extensions) {
        const path = `./src/file.${ext}`
        const result = resolveFilePath(path)
        expect(result).toBe(join(process.cwd(), path))
      }
    })
  })

  describe('relative paths without extension', () => {
    test('falls back to cwd when no exports match', () => {
      // ./testing has no extension, tries Bun.resolveSync first
      // Falls back to cwd since this project has no exports field
      const path = './testing'
      const result = resolveFilePath(path)
      expect(result).toBe(join(process.cwd(), path))
    })
  })

  describe('implicit relative paths', () => {
    test('resolves src/foo.ts via fallback to cwd', () => {
      // No ./ prefix, has extension - tries Bun.resolveSync (fails), falls back to cwd
      const path = 'src/resolve-file-path.ts'
      const result = resolveFilePath(path)
      expect(result).toBe(join(process.cwd(), path))
    })

    test('resolves nested implicit path via fallback', () => {
      const path = 'src/tests/fixtures/sample.ts'
      const result = resolveFilePath(path)
      expect(result).toBe(join(process.cwd(), path))
    })
  })

  describe('bare package specifiers', () => {
    test('resolves bare package name', () => {
      const result = resolveFilePath('typescript')
      expect(result).toContain('node_modules/typescript')
      expect(result.startsWith('/')).toBe(true)
    })

    test('falls back to cwd for non-existent package', () => {
      const invalidPath = 'nonexistent-package'
      const result = resolveFilePath(invalidPath)
      expect(result).toBe(join(process.cwd(), invalidPath))
    })
  })

  describe('scoped package specifiers', () => {
    test('falls back to cwd for non-existent scoped package', () => {
      const scopedPkg = '@nonexistent/pkg/src/file.ts'
      const result = resolveFilePath(scopedPkg)
      expect(result).toBe(join(process.cwd(), scopedPkg))
    })
  })

  describe('package subpaths', () => {
    test('resolves package subpath with extension', () => {
      // typescript/lib/typescript.js is a real subpath
      const result = resolveFilePath('typescript/lib/typescript.js')
      expect(result).toContain('node_modules/typescript')
      expect(result).toContain('typescript.js')
    })
  })
})
