import { test, expect } from 'bun:test'
import { join } from 'node:path'
import { discoverTemplateMetadata } from '../discover-template-metadata.js'
import type { TemplateExport } from '../workshop.types.js'

// Get absolute path to fixtures
const fixturesPath = join(import.meta.dir, 'fixtures', 'templates')

test('discoverTemplateMetadata: discovers FunctionTemplate exports', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  const simpleTemplate = metadata.find((m) => m.exportName === 'SimpleTemplate')
  expect(simpleTemplate).toBeDefined()
  expect(simpleTemplate?.type).toBe('FunctionTemplate')
  expect(simpleTemplate?.filePath).toContain('function-templates.tsx')

  const templateWithProps = metadata.find((m) => m.exportName === 'TemplateWithProps')
  expect(templateWithProps).toBeDefined()
  expect(templateWithProps?.type).toBe('FunctionTemplate')
})

test('discoverTemplateMetadata: discovers FT alias exports', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  const ftSimple = metadata.find((m) => m.exportName === 'FTSimple')
  expect(ftSimple).toBeDefined()
  expect(ftSimple?.type).toBe('FunctionTemplate')
  expect(ftSimple?.filePath).toContain('ft-alias.tsx')

  const ftWithProps = metadata.find((m) => m.exportName === 'FTWithProps')
  expect(ftWithProps).toBeDefined()
  expect(ftWithProps?.type).toBe('FunctionTemplate')

  const ftComplex = metadata.find((m) => m.exportName === 'FTComplex')
  expect(ftComplex).toBeDefined()
  expect(ftComplex?.type).toBe('FunctionTemplate')
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

test('discoverTemplateMetadata: discovers function declaration templates', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  const functionDeclaration = metadata.find((m) => m.exportName === 'FunctionDeclarationTemplate')
  expect(functionDeclaration).toBeDefined()
  expect(functionDeclaration?.type).toBe('FunctionTemplate')
})

test('discoverTemplateMetadata: discovers default exports', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  const defaultExport = metadata.find((m) => m.exportName === 'default')
  expect(defaultExport).toBeDefined()
  expect(defaultExport?.type).toBe('FunctionTemplate')
  expect(defaultExport?.filePath).toContain('default-export.tsx')
})

test('discoverTemplateMetadata: handles mixed template types in one file', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  const mixedFile = metadata.filter((m) => m.filePath.includes('mixed.tsx'))

  // Should find all templates in the mixed file
  const mixedFunctionTemplate = mixedFile.find((m) => m.exportName === 'MixedFunctionTemplate')
  expect(mixedFunctionTemplate).toBeDefined()
  expect(mixedFunctionTemplate?.type).toBe('FunctionTemplate')

  const mixedFTTemplate = mixedFile.find((m) => m.exportName === 'MixedFTTemplate')
  expect(mixedFTTemplate).toBeDefined()
  expect(mixedFTTemplate?.type).toBe('FunctionTemplate')

  const mixedBehavioralTemplate = mixedFile.find((m) => m.exportName === 'MixedBehavioralTemplate')
  expect(mixedBehavioralTemplate).toBeDefined()
  expect(mixedBehavioralTemplate?.type).toBe('BehavioralTemplate')

  const anotherTemplate = mixedFile.find((m) => m.exportName === 'AnotherTemplate')
  expect(anotherTemplate).toBeDefined()
  expect(anotherTemplate?.type).toBe('FunctionTemplate')

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

test('discoverTemplateMetadata: returns array of TemplateExport objects', async () => {
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
    expect(['FunctionTemplate', 'BehavioralTemplate']).toContain(item.type)
  })
})

test('discoverTemplateMetadata: all filePaths are absolute paths', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  metadata.forEach((item) => {
    expect(item.filePath.startsWith('/')).toBe(true)
    expect(item.filePath).toContain(fixturesPath)
  })
})

test('discoverTemplateMetadata: discovers templates from multiple files', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  const uniqueFiles = new Set(metadata.map((m) => m.filePath))

  // Should have templates from multiple files
  expect(uniqueFiles.size).toBeGreaterThanOrEqual(5)

  // Verify we have files from different fixtures
  const fileNames = Array.from(uniqueFiles).map((path) => path.split('/').pop())
  expect(fileNames).toContain('function-templates.tsx')
  expect(fileNames).toContain('ft-alias.tsx')
  expect(fileNames).toContain('behavioral-templates.tsx')
  expect(fileNames).toContain('mixed.tsx')
  expect(fileNames).toContain('default-export.tsx')
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

test('discoverTemplateMetadata: counts templates correctly', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  // Count templates by file
  const functionTemplatesCount = metadata.filter((m) => m.filePath.includes('function-templates.tsx')).length
  const ftAliasCount = metadata.filter((m) => m.filePath.includes('ft-alias.tsx')).length
  const behavioralCount = metadata.filter((m) => m.filePath.includes('behavioral-templates.tsx')).length

  expect(functionTemplatesCount).toBeGreaterThanOrEqual(3) // SimpleTemplate, TemplateWithProps, FunctionDeclarationTemplate, ArrowTemplate
  expect(ftAliasCount).toBeGreaterThanOrEqual(3) // FTSimple, FTWithProps, FTComplex
  expect(behavioralCount).toBeGreaterThanOrEqual(2) // SimpleBehavioralTemplate, BehavioralTemplateWithProgram
})

test('discoverTemplateMetadata: verifies FunctionTemplate vs BehavioralTemplate classification', async () => {
  const metadata = await discoverTemplateMetadata(fixturesPath, '**/*.tpl.spec.{ts,tsx}')

  const functionTemplates = metadata.filter((m) => m.type === 'FunctionTemplate')
  const behavioralTemplates = metadata.filter((m) => m.type === 'BehavioralTemplate')

  expect(functionTemplates.length).toBeGreaterThan(0)
  expect(behavioralTemplates.length).toBeGreaterThan(0)

  // Verify FunctionTemplates don't include bElement templates
  functionTemplates.forEach((ft) => {
    expect(ft.exportName).not.toContain('Component') // Simple heuristic
  })

  // Verify BehavioralTemplates are behavioral templates
  behavioralTemplates.forEach((bt) => {
    expect(['SimpleBehavioralTemplate', 'BehavioralTemplateWithProgram', 'MixedBehavioralTemplate']).toContain(
      bt.exportName,
    )
  })
})
