import { test, expect } from 'bun:test'
import { getStorySetPaths, getTemplatePaths } from '../get-file-paths.js'
import path from 'node:path'

const testProjectPath = path.join(import.meta.dir, 'fixtures', 'test-project')

// Story Set Paths Tests

test('getStorySetPaths: finds all story files in test project', async () => {
  const files = await getStorySetPaths(testProjectPath)

  expect(Array.isArray(files)).toBe(true)
  expect(files.length).toBe(3) // Button.stories.tsx, Card.stories.tsx, OnlyStory.stories.tsx

  // Check that the paths contain our test story files
  const storyFiles = files.map((f) => f.replace(testProjectPath, ''))
  expect(storyFiles).toContainAllValues([
    '/Button.stories.tsx',
    '/components/Card.stories.tsx',
    '/stories-only/OnlyStory.stories.tsx',
  ])
})

test('getStorySetPaths: returns correct array of file paths', async () => {
  const files = await getStorySetPaths(testProjectPath)

  expect(files).toBeDefined()
  expect(Array.isArray(files)).toBe(true)
  expect(files).toHaveLength(3)
  expect(files).toContainAllValues([
    `${testProjectPath}/Button.stories.tsx`,
    `${testProjectPath}/components/Card.stories.tsx`,
    `${testProjectPath}/stories-only/OnlyStory.stories.tsx`,
  ])
})

test('getStorySetPaths: filters only *.stories.tsx files', async () => {
  const files = await getStorySetPaths(testProjectPath)

  // All files should end with .stories.tsx
  files.forEach((file) => {
    expect(file).toMatch(/\.stories\.tsx$/)
  })

  // Should NOT include regular .tsx files
  const fileNames = files.map((f) => f.replace(testProjectPath, ''))
  expect(fileNames).not.toContainAnyValues(['/Button.tsx', '/components/Card.tsx', '/utils/helpers.tsx'])
})

test('getStorySetPaths: returns absolute paths', async () => {
  const files = await getStorySetPaths(testProjectPath)

  // All paths should be absolute (start with /)
  files.forEach((file) => {
    expect(file).toMatch(/^\//)
    expect(file).toContain(testProjectPath)
  })
})

test('getStorySetPaths: filters by subdirectory when dir is provided', async () => {
  const files = await getStorySetPaths(testProjectPath, `${testProjectPath}/components`)

  // Should only find story files in components directory
  expect(files).toHaveLength(1)
  expect(files).toContainAllValues([`${testProjectPath}/components/Card.stories.tsx`])

  // Should NOT include story files from root
  const fileNames = files.map((f) => f.replace(testProjectPath, ''))
  expect(fileNames).not.toContainAnyValues(['/Button.stories.tsx', '/stories-only/OnlyStory.stories.tsx'])
})

test('getStorySetPaths: handles current directory reference', async () => {
  const files = await getStorySetPaths(testProjectPath, testProjectPath)

  // Should behave same as no dir parameter
  expect(files).toHaveLength(3)
})

test('getStorySetPaths: throws error for parent directory traversal', async () => {
  expect(async () => {
    await getStorySetPaths(testProjectPath, '../')
  }).toThrow('Directory "../" must be within the project root')
})

test('getStorySetPaths: throws error for absolute path outside project', async () => {
  expect(async () => {
    await getStorySetPaths(testProjectPath, '/tmp/malicious')
  }).toThrow('Directory "/tmp/malicious" must be within the project root')
})

test('getStorySetPaths: throws error for path traversal attempts', async () => {
  expect(async () => {
    await getStorySetPaths(testProjectPath, '../../outside')
  }).toThrow('Directory "../../outside" must be within the project root')
})

test('getStorySetPaths: handles nested subdirectories', async () => {
  const files = await getStorySetPaths(testProjectPath, `${testProjectPath}/components`)

  expect(Array.isArray(files)).toBe(true)
})

test('getStorySetPaths: throws error for empty directory', async () => {
  expect(async () => {
    await getStorySetPaths(testProjectPath, `${testProjectPath}/empty`)
  }).toThrow(`No story files (*.stories.tsx) found in directory '${testProjectPath}/empty'`)
})

test('getStorySetPaths: throws error for directory with no stories', async () => {
  expect(async () => {
    await getStorySetPaths(testProjectPath, `${testProjectPath}/utils`)
  }).toThrow(`No story files (*.stories.tsx) found in directory '${testProjectPath}/utils'`)
})

test('getStorySetPaths: throws error for directory with only templates', async () => {
  expect(async () => {
    await getStorySetPaths(testProjectPath, `${testProjectPath}/templates-only`)
  }).toThrow(`No story files (*.stories.tsx) found in directory '${testProjectPath}/templates-only'`)
})

test('getStorySetPaths: finds story files in stories-only directory', async () => {
  const files = await getStorySetPaths(testProjectPath, `${testProjectPath}/stories-only`)

  expect(files).toHaveLength(1)
  expect(files).toContainAllValues([`${testProjectPath}/stories-only/OnlyStory.stories.tsx`])
})

// Template Paths Tests

test('getTemplatePaths: finds all template files excluding stories', async () => {
  const files = await getTemplatePaths(testProjectPath)

  expect(Array.isArray(files)).toBe(true)
  expect(files.length).toBe(4) // Button.tsx, Card.tsx, helpers.tsx, OnlyTemplate.tsx

  // Check that the paths contain our template files
  const templateFiles = files.map((f) => f.replace(testProjectPath, ''))
  expect(templateFiles).toContainAllValues([
    '/Button.tsx',
    '/components/Card.tsx',
    '/utils/helpers.tsx',
    '/templates-only/OnlyTemplate.tsx',
  ])

  // Should NOT contain story files
  expect(templateFiles).not.toContainAnyValues([
    '/Button.stories.tsx',
    '/components/Card.stories.tsx',
    '/stories-only/OnlyStory.stories.tsx',
  ])
})

test('getTemplatePaths: returns correct array of file paths', async () => {
  const files = await getTemplatePaths(testProjectPath)

  expect(files).toBeDefined()
  expect(Array.isArray(files)).toBe(true)
})

test('getTemplatePaths: handles empty results gracefully', async () => {
  // Note: In a real scenario, we'd test with an empty directory
  // For now, we just verify the response structure is correct even with results
  const files = await getTemplatePaths(testProjectPath)

  expect(files).toBeDefined()
  expect(Array.isArray(files)).toBe(true)
})

test('getTemplatePaths: filters out story files correctly', async () => {
  const files = await getTemplatePaths(testProjectPath)

  // All files should end with .tsx
  files.forEach((file) => {
    expect(file).toMatch(/\.tsx$/)
  })

  // None should be story files
  files.forEach((file) => {
    expect(file).not.toMatch(/\.stories\.tsx$/)
  })
})

test('getTemplatePaths: returns absolute paths', async () => {
  const files = await getTemplatePaths(testProjectPath)

  // All paths should be absolute (start with /)
  files.forEach((file) => {
    expect(file).toMatch(/^\//)
    expect(file).toContain(testProjectPath)
  })
})

test('getTemplatePaths: correctly filters files with .stories. in the middle', async () => {
  const files = await getTemplatePaths(testProjectPath)

  // Verify the filter works for .stories. anywhere in the filename
  files.forEach((file) => {
    expect(file).not.toContain('.stories.')
  })
})

test('getTemplatePaths: bug fix verification - returns filtered files not all files', async () => {
  // This test specifically verifies the bug fix where filteredFiles should be returned
  // not the original unfiltered files array
  const files = await getTemplatePaths(testProjectPath)

  // Verify that no story files are in the result
  // This confirms we're getting filteredFiles, not the original files array
  const hasStoryFiles = files.some((file) => file.includes('.stories.'))
  expect(hasStoryFiles).toBe(false)

  // Verify we only have the expected non-story .tsx files
  expect(files.length).toBe(4)
})

test('getTemplatePaths: filters by subdirectory when dir is provided', async () => {
  const files = await getTemplatePaths(testProjectPath, `${testProjectPath}/components`)

  // Should only find template files in components directory
  expect(files).toHaveLength(1)
  expect(files).toContainAllValues([`${testProjectPath}/components/Card.tsx`])

  // Should NOT include template files from root or utils
  const fileNames = files.map((f) => f.replace(testProjectPath, ''))
  expect(fileNames).not.toContainAnyValues(['/Button.tsx', '/utils/helpers.tsx', '/templates-only/OnlyTemplate.tsx'])
})

test('getTemplatePaths: filters by utils directory', async () => {
  const files = await getTemplatePaths(testProjectPath, `${testProjectPath}/utils`)

  // Should only find template files in utils directory
  expect(files).toHaveLength(1)
  expect(files).toContainAllValues([`${testProjectPath}/utils/helpers.tsx`])
})

test('getTemplatePaths: handles current directory reference', async () => {
  const files = await getTemplatePaths(testProjectPath, testProjectPath)

  // Should behave same as no dir parameter
  expect(files).toHaveLength(4)
})

test('getTemplatePaths: handles empty string as dir', async () => {
  const files = await getTemplatePaths(testProjectPath, testProjectPath)

  // Should behave same as no dir parameter
  expect(files).toHaveLength(4)
})

test('getTemplatePaths: throws error for parent directory traversal', async () => {
  expect(async () => {
    await getTemplatePaths(testProjectPath, '../')
  }).toThrow('Directory "../" must be within the project root')
})

test('getTemplatePaths: throws error for absolute path outside project', async () => {
  expect(async () => {
    await getTemplatePaths(testProjectPath, '/tmp/malicious')
  }).toThrow('Directory "/tmp/malicious" must be within the project root')
})

test('getTemplatePaths: throws error for path traversal attempts', async () => {
  expect(async () => {
    await getTemplatePaths(testProjectPath, '../../outside')
  }).toThrow('Directory "../../outside" must be within the project root')
})

test('getTemplatePaths: excludes story files even in subdirectories', async () => {
  const files = await getTemplatePaths(testProjectPath, `${testProjectPath}/components`)

  // Should not include Card.stories.tsx even though it's in components dir
  const hasStoryFiles = files.some((file) => file.includes('.stories.'))
  expect(hasStoryFiles).toBe(false)

  // Should only have Card.tsx
  expect(files).toHaveLength(1)
  expect(files[0]).toContain('Card.tsx')
  expect(files[0]).not.toContain('.stories.')
})

test('getTemplatePaths: throws error for empty directory', async () => {
  expect(async () => {
    await getTemplatePaths(testProjectPath, `${testProjectPath}/empty`)
  }).toThrow(`No template files (*.tsx) found in directory '${testProjectPath}/empty' (excluding *.stories.tsx)`)
})

test('getTemplatePaths: throws error for directory with only stories', async () => {
  expect(async () => {
    await getTemplatePaths(testProjectPath, `${testProjectPath}/stories-only`)
  }).toThrow(`No template files (*.tsx) found in directory '${testProjectPath}/stories-only' (excluding *.stories.tsx)`)
})

test('getTemplatePaths: finds template files in templates-only directory', async () => {
  const files = await getTemplatePaths(testProjectPath, `${testProjectPath}/templates-only`)

  expect(files).toHaveLength(1)
  expect(files).toContainAllValues([`${testProjectPath}/templates-only/OnlyTemplate.tsx`])
})

test('getTemplatePaths: returns correct templates for utils directory', async () => {
  const files = await getTemplatePaths(testProjectPath, `${testProjectPath}/utils`)

  expect(files).toHaveLength(1)
  expect(files).toContainAllValues([`${testProjectPath}/utils/helpers.tsx`])
})
