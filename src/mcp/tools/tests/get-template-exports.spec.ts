import { describe, test, expect } from 'bun:test'
import { getTemplateExports } from '../get-template-exports.js'

const fixturesPath = `${import.meta.dir}/fixtures`

describe('getTemplateExports', () => {
  test('should find FunctionTemplate exports', () => {
    const filePath = `${fixturesPath}/function-template.tsx`
    const result = getTemplateExports({ filePath })

    expect(result).toEqual([{ name: 'myFunctionTemplate', type: 'FunctionTemplate' }])
  })

  test('should find FT alias exports', () => {
    const filePath = `${fixturesPath}/ft-alias.tsx`
    const result = getTemplateExports({ filePath })

    expect(result).toEqual([{ name: 'shortNameTemplate', type: 'FunctionTemplate' }])
  })

  test('should find BehavioralTemplate exports', () => {
    const filePath = `${fixturesPath}/behavioral-template.tsx`
    const result = getTemplateExports({ filePath })

    expect(result).toEqual([{ name: 'myBehavioralTemplate', type: 'BehavioralTemplate' }])
  })

  test('should find multiple template exports in mixed file', () => {
    const filePath = `${fixturesPath}/mixed-exports.tsx`
    const result = getTemplateExports({ filePath })

    expect(result).toContainAllValues([
      { name: 'behavioralOne', type: 'BehavioralTemplate' },
      { name: 'templateOne', type: 'FunctionTemplate' },
      { name: 'templateTwo', type: 'FunctionTemplate' },
    ])
  })

  test('should return empty array for files with no template exports', () => {
    const filePath = `${fixturesPath}/no-templates.tsx`
    const result = getTemplateExports({ filePath })

    expect(result).toEqual([])
  })

  test('should handle default exports', () => {
    const filePath = `${fixturesPath}/default-export.tsx`
    const result = getTemplateExports({ filePath })

    expect(result).toEqual([{ name: 'default', type: 'FunctionTemplate' }])
  })

  test('should return empty array for non-existent file', () => {
    const filePath = `${fixturesPath}/non-existent.tsx`
    const result = getTemplateExports({ filePath })

    expect(result).toEqual([])
  })

  test('should return empty array for invalid TypeScript file', () => {
    const result = getTemplateExports({ filePath: '/invalid/path/file.ts' })

    expect(result).toEqual([])
  })

  test('should find functions that return TemplateObject', () => {
    const filePath = `${fixturesPath}/template-object-function.tsx`
    const result = getTemplateExports({ filePath })

    expect(result).toEqual([
      { name: 'simpleTemplate', type: 'FunctionTemplate' },
      { name: 'explicitTemplate', type: 'FunctionTemplate' },
      { name: 'arrowTemplate', type: 'FunctionTemplate' },
      { name: 'functionTemplate', type: 'FunctionTemplate' },
    ])
    expect(result.map((r) => r.name)).not.toContain('notATemplate')
  })
})
