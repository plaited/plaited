// scripts/create-corpus/tests/parse-code-files.spec.ts
import { expect, test, beforeAll } from 'bun:test'
import { parseCodeFiles } from '../parse-code-files.js'
import fs from 'fs'
import path from 'path'

// Create test directory structure
const TEST_DIR = path.join(import.meta.dir, 'fixtures')

beforeAll(async () => {
  // Clean up and create test directories
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true })
  }
  fs.mkdirSync(TEST_DIR, { recursive: true })

  // Create test files
  const storyFile = `
    import { fixture1 } from './fixture1';
    import { fixture2 } from './fixture2';

    export const story1 = {
      description: "Test story 1",
      args: { prop: "value" },
      play: async () => {}
    };

    export const story2 = {
      description: "Test story 2",
      args: { prop: "value" },
      play: async () => {}
    };
  `

  const fixture1 = `
    export const fixture1 = {
      data: "test data 1"
    };
  `

  const fixture2 = `
    export const fixture2 = {
      data: "test data 2"
    };
  `

  fs.writeFileSync(path.join(TEST_DIR, 'test.stories.tsx'), storyFile)
  fs.writeFileSync(path.join(TEST_DIR, 'fixture1.ts'), fixture1)
  fs.writeFileSync(path.join(TEST_DIR, 'fixture2.ts'), fixture2)
})

test('parseCodeFiles processes stories and fixtures correctly', async () => {
  const storyPath = path.join(TEST_DIR, 'test.stories.tsx')
  const results = await parseCodeFiles([storyPath])

  // Should process all three files
  expect(results.length).toBe(3)

  // Find story file analysis
  const storyAnalysis = results.find((r) => r.filePath.endsWith('test.stories.tsx'))
  expect(storyAnalysis).toBeDefined()

  if (storyAnalysis) {
    // Check story exports
    expect(storyAnalysis.exports.length).toBe(2)
    expect(storyAnalysis.exports[0].name).toBe('story1')
    expect(storyAnalysis.exports[0].description).toBe('Test story 1')
    expect(storyAnalysis.exports[0].embedding).toBeDefined()

    // Check imports
    expect(storyAnalysis.imports.length).toBe(2)
    expect(storyAnalysis.imports.some((i) => i.endsWith('fixture1.ts'))).toBe(true)
    expect(storyAnalysis.imports.some((i) => i.endsWith('fixture2.ts'))).toBe(true)

    // Check file embedding
    expect(storyAnalysis.fileEmbedding).toBeDefined()
  }

  // Find and check fixture files
  const fixtureAnalyses = results.filter((r) => r.filePath.includes('fixture'))
  expect(fixtureAnalyses.length).toBe(2)

  fixtureAnalyses.forEach((fixture) => {
    expect(fixture.exports.length).toBe(1)
    expect(fixture.exports[0].embedding).toBeDefined()
    expect(fixture.fileEmbedding).toBeDefined()
  })
})

test('parseCodeFiles handles non-existent files', async () => {
  const nonExistentPath = path.join(TEST_DIR, 'nonexistent.stories.tsx')
  await expect(parseCodeFiles([nonExistentPath])).rejects.toThrow()
})

test('parseCodeFiles handles duplicate imports', async () => {
  const storyPath = path.join(TEST_DIR, 'test.stories.tsx')
  const results = await parseCodeFiles([storyPath, storyPath])

  // Should still only process each file once
  const uniqueFilePaths = new Set(results.map((r) => r.filePath))
  expect(uniqueFilePaths.size).toBe(3)
})
