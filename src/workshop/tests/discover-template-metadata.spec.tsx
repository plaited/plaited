import { test, expect } from 'bun:test'
import { join } from 'node:path'
import { discoverTemplateMetadata } from '../discover-template-metadata.js'
import type { TemplateExport } from '../workshop.types.js'

// Get absolute path to fixtures
const fixturesPath = join(import.meta.dir, 'fixtures', 'templates')

test('discoverTemplateMetadata: only returns BehavioralTemplate exports', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  // All returned templates should be BehavioralTemplate
  metadata.forEach((template) => {
    expect(template.type).toBe('BehavioralTemplate')
  })

  // Should NOT find FunctionTemplate exports
  const simpleTemplate = metadata.find((m) => m.exportName === 'SimpleTemplate')
  expect(simpleTemplate).toBeUndefined()

  const templateWithProps = metadata.find((m) => m.exportName === 'TemplateWithProps')
  expect(templateWithProps).toBeUndefined()

  // Should NOT find FT alias exports
  const ftSimple = metadata.find((m) => m.exportName === 'FTSimple')
  expect(ftSimple).toBeUndefined()
})

test('discoverTemplateMetadata: discovers BehavioralTemplate exports', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  const simpleTemplate = metadata.find((m) => m.exportName === 'SimpleBehavioralTemplate')
  expect(simpleTemplate).toBeDefined()
  expect(simpleTemplate?.type).toBe('BehavioralTemplate')
  expect(simpleTemplate?.filePath).toContain('behavioral-templates.tsx')

  const templateWithProgram = metadata.find((m) => m.exportName === 'BehavioralTemplateWithProgram')
  expect(templateWithProgram).toBeDefined()
  expect(templateWithProgram?.type).toBe('BehavioralTemplate')
})

test('discoverTemplateMetadata: filters out FunctionTemplate exports', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  // Should NOT find FunctionTemplate function declarations
  const functionDeclaration = metadata.find((m) => m.exportName === 'FunctionDeclarationTemplate')
  expect(functionDeclaration).toBeUndefined()

  // Should NOT find FunctionTemplate default exports
  const defaultExport = metadata.find((m) => m.exportName === 'default')
  expect(defaultExport).toBeUndefined()
})

test('discoverTemplateMetadata: filters mixed template types in one file', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  const mixedFile = metadata.filter((m) => m.filePath.includes('mixed.tsx'))

  // Should ONLY find BehavioralTemplate from mixed file
  const mixedBehavioralTemplate = mixedFile.find((m) => m.exportName === 'MixedBehavioralTemplate')
  expect(mixedBehavioralTemplate).toBeDefined()
  expect(mixedBehavioralTemplate?.type).toBe('BehavioralTemplate')

  // Should NOT find FunctionTemplate exports from mixed file
  const mixedFunctionTemplate = mixedFile.find((m) => m.exportName === 'MixedFunctionTemplate')
  expect(mixedFunctionTemplate).toBeUndefined()

  const mixedFTTemplate = mixedFile.find((m) => m.exportName === 'MixedFTTemplate')
  expect(mixedFTTemplate).toBeUndefined()

  const anotherTemplate = mixedFile.find((m) => m.exportName === 'AnotherTemplate')
  expect(anotherTemplate).toBeUndefined()

  // Should NOT find the regular helper function
  const regularHelper = mixedFile.find((m) => m.exportName === 'regularHelper')
  expect(regularHelper).toBeUndefined()
})

test('discoverTemplateMetadata: ignores non-template exports', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  // None of these should be found
  expect(metadata.find((m) => m.exportName === 'regularFunction')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'regularConst')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'objectLiteral')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'RegularClass')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'arrowFunction')).toBeUndefined()
})

test('discoverTemplateMetadata: excludes files matching pattern', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  // Should NOT find templates from the excluded file
  expect(metadata.find((m) => m.exportName === 'ExcludedTemplate')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'AnotherExcluded')).toBeUndefined()

  // Verify the excluded file exists (just to make sure the test is valid)
  const excludedFilePath = join(import.meta.dir, 'fixtures', 'templates', 'should-be-excluded.tpl.spec.tsx')
  expect(Bun.file(excludedFilePath).size).toBeGreaterThan(0)
})

test('discoverTemplateMetadata: returns array of BehavioralTemplate export objects', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  expect(Array.isArray(metadata)).toBe(true)
  expect(metadata.length).toBeGreaterThan(0)

  // Check structure of each metadata object
  metadata.forEach((item: TemplateExport) => {
    expect(item).toHaveProperty('exportName')
    expect(item).toHaveProperty('filePath')
    expect(item).toHaveProperty('type')
    expect(typeof item.exportName).toBe('string')
    expect(typeof item.filePath).toBe('string')
    expect(item.type).toBe('BehavioralTemplate')
  })
})

test('discoverTemplateMetadata: all filePaths are absolute paths', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  metadata.forEach((item) => {
    expect(item.filePath.startsWith('/')).toBe(true)
    expect(item.filePath).toContain(fixturesPath)
  })
})

test('discoverTemplateMetadata: discovers BehavioralTemplates from multiple files', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  const uniqueFiles = new Set(metadata.map((m) => m.filePath))

  // Should have BehavioralTemplates from multiple files (only 2 files have them)
  expect(uniqueFiles.size).toBeGreaterThanOrEqual(2)

  // Verify we have files with BehavioralTemplates
  const fileNames = Array.from(uniqueFiles).map((path) => path.split('/').pop())
  expect(fileNames).toContain('behavioral-templates.tsx')
  expect(fileNames).toContain('mixed.tsx')

  // Should NOT contain files with only FunctionTemplates
  expect(fileNames).not.toContain('function-templates.tsx')
  expect(fileNames).not.toContain('ft-alias.tsx')
  expect(fileNames).not.toContain('default-export.tsx')
})

test('discoverTemplateMetadata: throws error when no files found', async () => {
  // This should throw because all files will be excluded
  try {
    await discoverTemplateMetadata(fixturesPath, '**/*.tsx')
    expect(true).toBe(false) // Should not reach here
  } catch (error) {
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('No template files')
  }
})

test('discoverTemplateMetadata: counts BehavioralTemplate exports correctly', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  // Should NOT find FunctionTemplate files
  const functionTemplatesCount = metadata.filter((m) => m.filePath.includes('function-templates.tsx')).length
  const ftAliasCount = metadata.filter((m) => m.filePath.includes('ft-alias.tsx')).length
  expect(functionTemplatesCount).toBe(0)
  expect(ftAliasCount).toBe(0)

  // Should find BehavioralTemplate exports
  const behavioralCount = metadata.filter((m) => m.filePath.includes('behavioral-templates.tsx')).length
  expect(behavioralCount).toBeGreaterThanOrEqual(2) // SimpleBehavioralTemplate, BehavioralTemplateWithProgram
})

test('discoverTemplateMetadata: only returns BehavioralTemplate type', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  const functionTemplates = metadata.filter((m) => m.type === 'FunctionTemplate')
  const behavioralTemplates = metadata.filter((m) => m.type === 'BehavioralTemplate')

  expect(functionTemplates.length).toBe(0)
  expect(behavioralTemplates.length).toBeGreaterThan(0)

  // Verify all BehavioralTemplates are correct
  behavioralTemplates.forEach((bt) => {
    expect(['SimpleBehavioralTemplate', 'BehavioralTemplateWithProgram', 'MixedBehavioralTemplate']).toContain(
      bt.exportName,
    )
  })
})
