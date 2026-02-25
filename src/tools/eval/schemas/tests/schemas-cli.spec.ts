import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { runSchemas } from '../schemas-cli.ts'

// ============================================================================
// runSchemas
// ============================================================================

describe('runSchemas', () => {
  const testOutputDir = '/tmp/agent-eval-harness-test-schemas'

  beforeEach(async () => {
    // Clean up test directory
    await Bun.$`rm -rf ${testOutputDir}`.nothrow()
  })

  afterEach(async () => {
    // Clean up test directory
    await Bun.$`rm -rf ${testOutputDir}`.nothrow()
  })

  describe('list mode', () => {
    test('returns array of schema names', async () => {
      const result = await runSchemas({ list: true })
      expect(Array.isArray(result)).toBe(true)
      const names = result as string[]
      expect(names).toContain('PromptCase')
      expect(names).toContain('CaptureResult')
      expect(names).toContain('GraderResult')
    })
  })

  describe('single schema mode', () => {
    test('returns single schema by name', async () => {
      const result = await runSchemas({ schemaName: 'PromptCase', json: true })
      expect(typeof result).toBe('object')
      const schemas = result as Record<string, object>
      expect(schemas.PromptCase).toBeDefined()
      expect(schemas.PromptCase).toHaveProperty('$schema')
      expect(schemas.PromptCase).toHaveProperty('title', 'PromptCase')
    })

    test('writes schema to file when outputPath provided', async () => {
      const outputPath = `${testOutputDir}/prompt-case.json`
      await Bun.$`mkdir -p ${testOutputDir}`

      await runSchemas({
        schemaName: 'GraderResult',
        outputPath,
      })

      const content = await Bun.file(outputPath).text()
      const schema = JSON.parse(content)
      expect(schema.title).toBe('GraderResult')
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    })
  })

  describe('all schemas mode', () => {
    test('returns all schemas as object', async () => {
      const result = await runSchemas({ json: true })
      expect(typeof result).toBe('object')
      const schemas = result as Record<string, object>

      // Check a sampling of expected schemas
      expect(schemas.PromptCase).toBeDefined()
      expect(schemas.CaptureResult).toBeDefined()
      expect(schemas.GraderResult).toBeDefined()
      expect(schemas.TrajectoryStep).toBeDefined()
      expect(schemas.Session).toBeDefined()
    })

    test('writes all schemas to single file', async () => {
      const outputPath = `${testOutputDir}/all-schemas.json`
      await Bun.$`mkdir -p ${testOutputDir}`

      await runSchemas({
        json: true,
        outputPath,
      })

      const content = await Bun.file(outputPath).text()
      const schemas = JSON.parse(content)
      expect(schemas.PromptCase).toBeDefined()
      expect(schemas.CaptureResult).toBeDefined()
    })

    test('splits schemas into separate files', async () => {
      await runSchemas({
        json: true,
        split: true,
        outputPath: testOutputDir,
      })

      // Check that individual files were created
      const promptCaseExists = await Bun.file(`${testOutputDir}/PromptCase.json`).exists()
      const captureResultExists = await Bun.file(`${testOutputDir}/CaptureResult.json`).exists()
      const graderResultExists = await Bun.file(`${testOutputDir}/GraderResult.json`).exists()

      expect(promptCaseExists).toBe(true)
      expect(captureResultExists).toBe(true)
      expect(graderResultExists).toBe(true)

      // Verify content
      const promptCaseContent = await Bun.file(`${testOutputDir}/PromptCase.json`).text()
      const promptCaseSchema = JSON.parse(promptCaseContent)
      expect(promptCaseSchema.title).toBe('PromptCase')
    })
  })

  describe('schema content validation', () => {
    test('PromptCase schema has correct structure', async () => {
      const result = await runSchemas({ schemaName: 'PromptCase', json: true })
      const schemas = result as Record<string, object>
      const schema = schemas.PromptCase as Record<string, unknown>

      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
      expect(schema.title).toBe('PromptCase')
      expect(schema.type).toBe('object')

      // Check properties exist
      const properties = schema.properties as Record<string, unknown>
      expect(properties).toBeDefined()
      expect(properties.id).toBeDefined()
      expect(properties.input).toBeDefined()
    })

    test('GraderResult schema has correct constraints', async () => {
      const result = await runSchemas({ schemaName: 'GraderResult', json: true })
      const schemas = result as Record<string, object>
      const schema = schemas.GraderResult as Record<string, unknown>

      expect(schema.type).toBe('object')
      const properties = schema.properties as Record<string, Record<string, unknown>>
      expect(properties.pass).toBeDefined()
      expect(properties.score).toBeDefined()
      expect(properties.pass?.type).toBe('boolean')
      expect(properties.score?.type).toBe('number')
      expect(properties.score?.minimum).toBe(0)
      expect(properties.score?.maximum).toBe(1)
    })
  })
})
