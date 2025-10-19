import { test, expect } from 'bun:test'
import { getStoryUrl } from '../get-story-url.js'

// Direct function tests
test('getStoryUrl: generates correct URL for story', () => {
  const result = getStoryUrl({
    filePath: '/src/components/Button.stories.tsx',
    exportName: 'Primary',
  })
  expect(result).toBe('/src/components/button--primary')
})

test('getStoryUrl: handles kebab-case conversion', () => {
  const result = getStoryUrl({
    filePath: '/src/components/MyComplexComponent.stories.tsx',
    exportName: 'WithCustomProps',
  })
  expect(result).toBe('/src/components/my-complex-component--with-custom-props')
})

test('getStoryUrl: handles nested paths', () => {
  const result = getStoryUrl({
    filePath: '/src/features/auth/Login.stories.tsx',
    exportName: 'Default',
  })
  expect(result).toBe('/src/features/auth/login--default')
})

test('getStoryUrl: handles .stories.ts extension', () => {
  const result = getStoryUrl({
    filePath: '/components/Form.stories.ts',
    exportName: 'Basic',
  })
  expect(result).toBe('/components/form--basic')
})

test('getStoryUrl: handles Windows paths', () => {
  const result = getStoryUrl({
    filePath: 'C:\\src\\components\\Button.stories.tsx',
    exportName: 'Primary',
  })
  expect(result).toBe('/src/components/button--primary')
})

test('getStoryUrl: handles camelCase to kebab-case', () => {
  const result = getStoryUrl({
    filePath: '/components/myAwesomeComponent.stories.tsx',
    exportName: 'withSpecialProps',
  })
  expect(result).toBe('/components/my-awesome-component--with-special-props')
})

test('getStoryUrl: preserves directory structure', () => {
  const result = getStoryUrl({
    filePath: '/deeply/nested/components/ui/Button.stories.tsx',
    exportName: 'Primary',
  })
  expect(result).toBe('/deeply/nested/components/ui/button--primary')
})

test('getStoryUrl: handles snake_case filenames', () => {
  const result = getStoryUrl({
    filePath: '/components/my_special_component.stories.tsx',
    exportName: 'Default',
  })
  expect(result).toBe('/components/my-special-component--default')
})
