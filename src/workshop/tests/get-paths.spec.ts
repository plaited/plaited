import { expect, test } from 'bun:test'
import { getPaths } from '../get-paths.ts'

test('getPaths: should generate route from file path and export name', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/src/Button.stories.tsx'
  const exportName = 'primary'

  const result = getPaths({ filePath, cwd, exportName })

  expect(result.route).toBe('/src/button--primary')
  expect(result.entryPath).toBe('/src/Button.stories.js')
})

test('getPaths: should convert PascalCase to kebab-case', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/MyElement.stories.tsx'
  const exportName = 'MyStoryName'

  const result = getPaths({ filePath, cwd, exportName })

  expect(result.route).toBe('/my-element--my-story-name')
  expect(result.entryPath).toBe('/MyElement.stories.js')
})

test('getPaths: should handle nested directories', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/src/elements/atoms/Button.stories.tsx'
  const exportName = 'default'

  const result = getPaths({ filePath, cwd, exportName })

  expect(result.route).toBe('/src/elements/atoms/button--default')
  expect(result.entryPath).toBe('/src/elements/atoms/Button.stories.js')
})

test('getPaths: should strip cwd from file path', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/src/Button.stories.tsx'
  const exportName = 'basic'

  const result = getPaths({ filePath, cwd, exportName })

  // Should strip '/Users/test/project' from filePath
  expect(result.route).toMatch(/^\/src\/button--basic$/)
  expect(result.entryPath).toMatch(/^\/src\/Button\.stories\.js$/)
})

test('getPaths: should handle root-level files', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/Template.stories.tsx'
  const exportName = 'story'

  const result = getPaths({ filePath, cwd, exportName })

  expect(result.route).toBe('/template--story')
  expect(result.entryPath).toBe('/Template.stories.js')
})

test('getPaths: should convert .tsx to .js in entry path', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/src/MyElement.stories.tsx'
  const exportName = 'test'

  const result = getPaths({ filePath, cwd, exportName })

  expect(result.entryPath).toMatch(/\.js$/)
  expect(result.entryPath).not.toMatch(/\.tsx$/)
})

test('getPaths: should preserve directory structure in entry path', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/deep/nested/path/Template.stories.tsx'
  const exportName = 'story'

  const result = getPaths({ filePath, cwd, exportName })

  expect(result.entryPath).toBe('/deep/nested/path/Template.stories.js')
  expect(result.route).toBe('/deep/nested/path/template--story')
})

test('getPaths: should add leading slash to paths', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/src/Button.stories.tsx'
  const exportName = 'basic'

  const result = getPaths({ filePath, cwd, exportName })

  expect(result.route).toMatch(/^\//)
  expect(result.entryPath).toMatch(/^\//)
})

test('getPaths: should handle .stories.tsx extension', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/src/Button.stories.tsx'
  const exportName = 'primary'

  const result = getPaths({ filePath, cwd, exportName })

  // Should strip .tsx and convert to .js (preserving .stories)
  expect(result.entryPath).toBe('/src/Button.stories.js')
  // Should use base name (Button) in route
  expect(result.route).toBe('/src/button--primary')
})

test('getPaths: should handle files with multiple dots', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/src/foo.bar.stories.tsx'
  const exportName = 'test'

  const result = getPaths({ filePath, cwd, exportName })

  expect(result.entryPath).toBe('/src/foo.bar.stories.js')
  expect(result.route).toBe('/src/foo.bar--test')
})

test('getPaths: should handle deeply nested paths', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/src/elements/atoms/buttons/PrimaryButton.stories.tsx'
  const exportName = 'large'

  const result = getPaths({ filePath, cwd, exportName })

  expect(result.entryPath).toBe('/src/elements/atoms/buttons/PrimaryButton.stories.js')
  expect(result.route).toBe('/src/elements/atoms/buttons/primary-button--large')
})

test('getPaths: should handle special characters in names via kebabCase', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/MySpecialTemplate.stories.tsx'
  const exportName = 'MySpecialStory'

  const result = getPaths({ filePath, cwd, exportName })

  // PascalCase should be converted to kebab-case
  expect(result.route).toBe('/my-special-template--my-special-story')
})

test('getPaths: route should match pattern /dir/file-name--export-name', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/src/elements/Button.stories.tsx'
  const exportName = 'primary'

  const result = getPaths({ filePath, cwd, exportName })

  // Route pattern: /optional-dirs/file-name--export-name
  expect(result.route).toMatch(/^\/[\w-/]+--[\w-]+$/)
  expect(result.route).toBe('/src/elements/button--primary')
})

test('getPaths: entryPath should match pattern /dir/file-name.js', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/src/elements/Button.stories.tsx'
  const exportName = 'primary'

  const result = getPaths({ filePath, cwd, exportName })

  // Entry path pattern: /optional-dirs/FileName.stories.js
  expect(result.entryPath).toMatch(/^\/[\w-/.]+\.js$/)
  expect(result.entryPath).toBe('/src/elements/Button.stories.js')
})

test('getPaths: should handle file path that does not start with cwd', () => {
  const cwd = '/Users/test/project'
  const filePath = '/different/path/Template.stories.tsx'
  const exportName = 'story'

  const result = getPaths({ filePath, cwd, exportName })

  // Should use the full path when it doesn't start with cwd
  expect(result.route).toBe('/different/path/template--story')
  expect(result.entryPath).toBe('/different/path/Template.stories.js')
})

test('getPaths: should handle relative-like paths starting with /', () => {
  const cwd = '/Users/test/project'
  const filePath = '/Users/test/project/src/Button.stories.tsx'
  const exportName = 'test'

  const result = getPaths({ filePath, cwd, exportName })

  // After stripping cwd, path starts with / -> normalized to remove it
  // Then leading / is added back in entry path
  expect(result.entryPath).toBe('/src/Button.stories.js')
})
