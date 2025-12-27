import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { getRoot } from '../get-root.ts'

test('getRoot: should return cwd when paths array is empty', () => {
  const result = getRoot([])
  expect(result).toBe(process.cwd())
})

test('getRoot: should return directory for single directory path', () => {
  const dirPath = 'src/elements'
  const result = getRoot([dirPath])
  expect(result).toBe(resolve(process.cwd(), dirPath))
})

test('getRoot: should return parent directory for single file path', () => {
  const filePath = 'src/Button.stories.tsx'
  const result = getRoot([filePath])
  // File detected by .tsx extension, should return parent directory
  expect(result).toBe(resolve(process.cwd(), 'src'))
})

test('getRoot: should return common ancestor for multiple paths in same directory', () => {
  const paths = ['src/elements/Button.tsx', 'src/elements/Input.tsx']
  const result = getRoot(paths)
  expect(result).toBe(resolve(process.cwd(), 'src/elements'))
})

test('getRoot: should find common ancestor for paths in different directories', () => {
  const paths = ['src/elements/Button.tsx', 'src/utils/helpers.ts']
  const result = getRoot(paths)
  expect(result).toBe(resolve(process.cwd(), 'src'))
})

test('getRoot: should handle deeply nested paths', () => {
  const paths = ['src/elements/atoms/buttons/PrimaryButton.tsx', 'src/elements/atoms/inputs/TextInput.tsx']
  const result = getRoot(paths)
  expect(result).toBe(resolve(process.cwd(), 'src/elements/atoms'))
})

test('getRoot: should detect files by presence of extension', () => {
  // Files with extensions should have their parent directory extracted
  const paths = ['src/file1.ts', 'src/file2.tsx']
  const result = getRoot(paths)
  expect(result).toBe(resolve(process.cwd(), 'src'))
})

test('getRoot: should return / as fallback when no common ancestor', () => {
  const paths = ['/home/user/project1/file.ts', '/var/www/project2/file.ts']
  const result = getRoot(paths)
  expect(result).toBe('/')
})

test('getRoot: should resolve relative paths to absolute', () => {
  const paths = ['./src/components', '../other/components']
  const result = getRoot(paths)
  // './src/components' -> /abs/path/to/cwd/src/components
  // '../other/components' -> /abs/path/to/parent/other/components
  // Common ancestor is parent of cwd
  expect(result).toBe(resolve(process.cwd(), '..'))
})

test('getRoot: should handle mix of file and directory paths', () => {
  const paths = ['src/elements', 'src/utils/helpers.ts', 'src/types/index.d.ts']
  const result = getRoot(paths)
  expect(result).toBe(resolve(process.cwd(), 'src'))
})

test('getRoot: should handle single file at root level', () => {
  const result = getRoot(['package.json'])
  // package.json has .json extension, so parent is extracted
  expect(result).toBe(process.cwd())
})

test('getRoot: should handle paths with multiple dots', () => {
  const paths = ['src/foo.bar.stories.tsx', 'src/baz.component.tsx']
  const result = getRoot(paths)
  // Files detected by extensions, parent directory extracted
  expect(result).toBe(resolve(process.cwd(), 'src'))
})

test('getRoot: should return single directory when all paths resolve to same location', () => {
  const paths = ['src/elements', './src/components', 'src/templates/']
  const result = getRoot(paths)
  expect(result).toBe(resolve(process.cwd(), 'src'))
})

test('getRoot: should handle very short common path', () => {
  const paths = ['a/b/c/d.ts', 'a/b/y/z.ts']
  const result = getRoot(paths)
  // Common ancestor is 'a/b', not just 'a'
  expect(result).toBe(resolve(process.cwd(), 'a/b'))
})

test('getRoot: should handle paths with no common parts except root', () => {
  const paths = ['a/file.ts', 'b/file.ts', 'c/file.ts']
  const result = getRoot(paths)
  // Common ancestor is process.cwd() since resolved paths share it
  expect(result).toBe(process.cwd())
})
