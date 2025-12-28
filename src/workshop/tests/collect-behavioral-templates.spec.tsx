import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { discoverBehavioralTemplateMetadata } from '../collect-behavioral-templates.ts'
import type { TemplateExport } from '../workshop.types.ts'

// Get absolute path to fixtures
const fixturesPath = join(import.meta.dir, 'fixtures', 'templates')

test('discoverTemplateMetadata: only returns BehavioralTemplate exports and filters all other types', async () => {
  const metadata = await discoverBehavioralTemplateMetadata(fixturesPath)

  // All returned templates should be BehavioralTemplate
  metadata.forEach((template) => {
    expect(template.type).toBe('BehavioralTemplate')
  })
  expect(metadata.length).toBeGreaterThan(0)

  // Verify only expected BehavioralTemplate exports are present
  const exportNames = metadata.map((m) => m.exportName)
  expect(exportNames).toContain('SimpleBehavioralTemplate')
  expect(exportNames).toContain('BehavioralTemplateWithProgram')
  expect(exportNames).toContain('MixedBehavioralTemplate')

  // Should NOT find FunctionTemplate exports (explicit types)
  expect(metadata.find((m) => m.exportName === 'SimpleTemplate')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'TemplateWithProps')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'FunctionDeclarationTemplate')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'ArrowTemplate')).toBeUndefined()

  // Should NOT find FT alias exports
  expect(metadata.find((m) => m.exportName === 'FTSimple')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'FTWithProps')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'FTComplex')).toBeUndefined()

  // Should NOT find mixed file FunctionTemplates
  expect(metadata.find((m) => m.exportName === 'MixedFunctionTemplate')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'MixedFTTemplate')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'AnotherTemplate')).toBeUndefined()

  // Should NOT find default exports
  expect(metadata.find((m) => m.exportName === 'default')).toBeUndefined()

  // Should NOT find non-template exports
  expect(metadata.find((m) => m.exportName === 'regularFunction')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'regularConst')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'objectLiteral')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'RegularClass')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'arrowFunction')).toBeUndefined()
  expect(metadata.find((m) => m.exportName === 'regularHelper')).toBeUndefined()

  // Verify file exclusions - only BehavioralTemplate files present
  const uniqueFiles = new Set(metadata.map((m) => m.filePath))
  const fileNames = Array.from(uniqueFiles).map((path) => path.split('/').pop())
  expect(fileNames).toContain('behavioral-templates.tsx')
  expect(fileNames).toContain('mixed.tsx')
  expect(fileNames).not.toContain('function-templates.tsx')
  expect(fileNames).not.toContain('ft-alias.tsx')
  expect(fileNames).not.toContain('default-export.tsx')
  expect(fileNames).not.toContain('non-templates.tsx')

  // Should NOT contain .stories.tsx files
  expect(metadata.every((m) => !m.filePath.includes('.stories.'))).toBe(true)
})

test('discoverTemplateMetadata: discovers BehavioralTemplate exports', async () => {
  const metadata = await discoverBehavioralTemplateMetadata(fixturesPath)

  const simpleTemplate = metadata.find((m) => m.exportName === 'SimpleBehavioralTemplate')
  expect(simpleTemplate).toBeDefined()
  expect(simpleTemplate?.type).toBe('BehavioralTemplate')
  expect(simpleTemplate?.filePath).toContain('behavioral-templates.tsx')

  const templateWithProgram = metadata.find((m) => m.exportName === 'BehavioralTemplateWithProgram')
  expect(templateWithProgram).toBeDefined()
  expect(templateWithProgram?.type).toBe('BehavioralTemplate')
})

test('discoverTemplateMetadata: handles mixed template file correctly', async () => {
  const metadata = await discoverBehavioralTemplateMetadata(fixturesPath)
  const mixedFile = metadata.filter((m) => m.filePath.includes('mixed.tsx'))

  // Should ONLY find BehavioralTemplate from mixed file
  expect(mixedFile.length).toBe(1)
  expect(mixedFile[0]?.exportName).toBe('MixedBehavioralTemplate')
  expect(mixedFile[0]?.type).toBe('BehavioralTemplate')
})

test('discoverTemplateMetadata: returns array of BehavioralTemplate export objects', async () => {
  const metadata = await discoverBehavioralTemplateMetadata(fixturesPath)

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

test('discoverTemplateMetadata: returns absolute file paths', async () => {
  const metadata = await discoverBehavioralTemplateMetadata(fixturesPath)

  metadata.forEach((item) => {
    expect(item.filePath.startsWith('/')).toBe(true)
    expect(item.filePath).toContain(fixturesPath)
  })
})

test('discoverTemplateMetadata: throws error when no files found', async () => {
  // This should throw when directory has no .tsx files
  const emptyDir = join(import.meta.dir, 'fixtures', 'empty-dir')
  try {
    await discoverBehavioralTemplateMetadata(emptyDir)
    expect(true).toBe(false) // Should not reach here
  } catch (error) {
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('No template files')
  }
})

test('discoverTemplateMetadata: finds exactly 3 BehavioralTemplate exports', async () => {
  const metadata = await discoverBehavioralTemplateMetadata(fixturesPath)

  // Should find exactly 3 BehavioralTemplate exports
  expect(metadata.length).toBe(3)

  const exportNames = metadata.map((m) => m.exportName)
  expect(exportNames).toEqual(
    expect.arrayContaining(['SimpleBehavioralTemplate', 'BehavioralTemplateWithProgram', 'MixedBehavioralTemplate']),
  )

  // Count by file
  const behavioralTemplatesFile = metadata.filter((m) => m.filePath.includes('behavioral-templates.tsx'))
  const mixedFile = metadata.filter((m) => m.filePath.includes('mixed.tsx'))

  expect(behavioralTemplatesFile.length).toBe(2) // SimpleBehavioralTemplate, BehavioralTemplateWithProgram
  expect(mixedFile.length).toBe(1) // MixedBehavioralTemplate
})
