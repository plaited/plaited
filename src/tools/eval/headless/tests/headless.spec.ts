/**
 * Unit tests for headless adapter factory.
 *
 * @remarks
 * Tests cover:
 * - Schema validation with Zod
 * - JSONPath extraction
 * - Output parsing with event mappings
 * - History building for iterative mode
 */

import { describe, expect, test } from 'bun:test'
import { HeadlessAdapterSchema, parseHeadlessConfig, safeParseHeadlessConfig } from '../headless.schemas.ts'
import { createHistoryBuilder } from '../headless-history-builder.ts'
import { createOutputParser, jsonPath, jsonPathString } from '../headless-output-parser.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const validClaudeSchema = {
  version: 1,
  name: 'claude-headless',
  command: ['claude'],
  sessionMode: 'stream',
  prompt: { flag: '-p' },
  output: { flag: '--output-format', value: 'stream-json' },
  autoApprove: ['--dangerously-skip-permissions'],
  resume: { flag: '--resume', sessionIdPath: '$.session_id' },
  outputEvents: [
    {
      match: { path: '$.type', value: 'assistant' },
      emitAs: 'message',
      extract: { content: '$.message.text' },
    },
    {
      match: { path: '$.type', value: 'tool_use' },
      emitAs: 'tool_call',
      extract: { title: '$.name', status: "'pending'", input: '$.input' },
    },
    {
      match: { path: '$.type', value: 'tool_result' },
      emitAs: 'tool_call',
      extract: { title: '$.name', status: "'completed'", output: '$.content' },
    },
  ],
  result: {
    matchPath: '$.type',
    matchValue: 'result',
    contentPath: '$.result',
  },
}

const validGeminiSchema = {
  version: 1,
  name: 'gemini-headless',
  command: ['gemini'],
  sessionMode: 'iterative',
  prompt: { flag: '--prompt' },
  output: { flag: '--output-format', value: 'json' },
  outputEvents: [
    {
      match: { path: '$.type', value: 'message' },
      emitAs: 'message',
      extract: { content: '$.content' },
    },
  ],
  result: {
    matchPath: '$.type',
    matchValue: 'result',
    contentPath: '$.response',
  },
  historyTemplate: 'User: {{input}}\nAssistant: {{output}}',
}

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('HeadlessAdapterSchema', () => {
  describe('valid schemas', () => {
    test('validates Claude headless schema', () => {
      const result = HeadlessAdapterSchema.safeParse(validClaudeSchema)
      expect(result.success).toBe(true)
    })

    test('validates Gemini headless schema', () => {
      const result = HeadlessAdapterSchema.safeParse(validGeminiSchema)
      expect(result.success).toBe(true)
    })
  })

  describe('validates schema files from disk', () => {
    const fixturesDir = 'src/headless/tests/fixtures'

    test('validates claude-headless.json from disk', async () => {
      const content = await Bun.file(`${fixturesDir}/claude-headless.json`).json()
      const result = HeadlessAdapterSchema.safeParse(content)
      expect(result.success).toBe(true)
    })

    test('validates gemini-headless.json from disk', async () => {
      const content = await Bun.file(`${fixturesDir}/gemini-headless.json`).json()
      const result = HeadlessAdapterSchema.safeParse(content)
      expect(result.success).toBe(true)
    })
  })

  describe('extract input/output fields', () => {
    test('validates schema with input and output in extract config', () => {
      const schemaWithIO = {
        ...validClaudeSchema,
        outputEvents: [
          ...validClaudeSchema.outputEvents,
          {
            match: { path: '$.type', value: 'custom' },
            emitAs: 'tool_call',
            extract: { title: '$.name', input: '$.args', output: '$.result' },
          },
        ],
      }
      const result = HeadlessAdapterSchema.safeParse(schemaWithIO)
      expect(result.success).toBe(true)
    })

    test('preserves extra extract fields via catchall', () => {
      const schemaWithExtras = {
        ...validClaudeSchema,
        outputEvents: [
          {
            match: { path: '$.type', value: 'tool_use' },
            emitAs: 'tool_call',
            extract: {
              title: '$.name',
              status: "'pending'",
              input: '$.input',
              toolName: '$.name',
              mcpServer: '$.server',
            },
          },
        ],
      }
      const result = HeadlessAdapterSchema.safeParse(schemaWithExtras)
      expect(result.success).toBe(true)
      if (result.success) {
        const extract = result.data.outputEvents![0]!.extract!
        expect(extract.title).toBe('$.name')
        expect(extract.input).toBe('$.input')
        // Catchall fields aren't in the inferred type — cast needed to access them
        expect((extract as Record<string, string>).toolName).toBe('$.name')
        expect((extract as Record<string, string>).mcpServer).toBe('$.server')
      }
    })

    test('rejects non-string extra extract fields', () => {
      const schemaWithBadExtras = {
        ...validClaudeSchema,
        outputEvents: [
          {
            match: { path: '$.type', value: 'tool_use' },
            emitAs: 'tool_call',
            extract: { title: '$.name', badField: 123 },
          },
        ],
      }
      const result = HeadlessAdapterSchema.safeParse(schemaWithBadExtras)
      expect(result.success).toBe(false)
    })
  })

  describe('minimal valid schema', () => {
    test('validates minimal required fields', () => {
      const minimal = {
        version: 1,
        name: 'minimal',
        command: ['agent'],
        sessionMode: 'iterative',
        prompt: {},
        output: { flag: '--format', value: 'json' },
        outputEvents: [],
        result: { matchPath: '$.type', matchValue: 'done', contentPath: '$.text' },
      }
      const result = HeadlessAdapterSchema.safeParse(minimal)
      expect(result.success).toBe(true)
    })
  })

  describe('stdin mode configuration', () => {
    test('validates schema with stdin: true', () => {
      const stdinSchema = {
        version: 1,
        name: 'stdin-agent',
        command: ['agent', 'exec', '-'],
        sessionMode: 'stream',
        prompt: { stdin: true },
        output: { flag: '--format', value: 'json' },
        outputEvents: [],
        result: { matchPath: '$.type', matchValue: 'done', contentPath: '$.text' },
      }
      const result = HeadlessAdapterSchema.safeParse(stdinSchema)
      expect(result.success).toBe(true)
    })

    test('validates schema with stdin: false', () => {
      const stdinSchema = {
        version: 1,
        name: 'stdin-agent',
        command: ['agent'],
        sessionMode: 'stream',
        prompt: { stdin: false, flag: '-p' },
        output: { flag: '--format', value: 'json' },
        outputEvents: [],
        result: { matchPath: '$.type', matchValue: 'done', contentPath: '$.text' },
      }
      const result = HeadlessAdapterSchema.safeParse(stdinSchema)
      expect(result.success).toBe(true)
    })

    test('validates schema with positional prompt and - in command', () => {
      const stdinSchema = {
        version: 1,
        name: 'codex-like',
        command: ['codex', 'exec', '--json', '-'],
        sessionMode: 'iterative',
        prompt: { stdin: true },
        output: { flag: '', value: '' },
        outputEvents: [
          {
            match: { path: '$.item.type', value: 'agent_message' },
            emitAs: 'message',
            extract: { content: '$.item.text' },
          },
        ],
        result: { matchPath: '$.type', matchValue: 'turn.completed', contentPath: '$.usage.output_tokens' },
      }
      const result = HeadlessAdapterSchema.safeParse(stdinSchema)
      expect(result.success).toBe(true)
    })
  })

  describe('invalid schemas', () => {
    test('rejects missing version', () => {
      const invalid = { ...validClaudeSchema, version: undefined }
      const result = HeadlessAdapterSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    test('rejects unsupported version', () => {
      const invalid = { ...validClaudeSchema, version: 2 }
      const result = HeadlessAdapterSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    test('rejects invalid sessionMode', () => {
      const invalid = { ...validClaudeSchema, sessionMode: 'batch' }
      const result = HeadlessAdapterSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    test('rejects missing command', () => {
      const invalid = { ...validClaudeSchema, command: undefined }
      const result = HeadlessAdapterSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    test('rejects both flag and stdin specified', () => {
      const invalid = {
        ...validClaudeSchema,
        prompt: {
          flag: '-p',
          stdin: true,
        },
      }
      const result = HeadlessAdapterSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      // Type assertion after checking success is false
      const error = (result as { success: false; error: { issues: Array<{ message: string }> } }).error
      expect(error.issues.length).toBeGreaterThan(0)
      expect(error.issues[0]!.message).toContain("Cannot specify both 'flag' and 'stdin' modes")
    })

    test('rejects invalid emitAs type', () => {
      const invalid = {
        ...validClaudeSchema,
        outputEvents: [
          {
            match: { path: '$.type', value: 'x' },
            emitAs: 'invalid_type',
          },
        ],
      }
      const result = HeadlessAdapterSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('parseHeadlessConfig', () => {
    test('returns parsed config for valid input', () => {
      const config = parseHeadlessConfig(validClaudeSchema)
      expect(config.name).toBe('claude-headless')
      expect(config.command).toEqual(['claude'])
      expect(config.sessionMode).toBe('stream')
    })

    test('throws for invalid input', () => {
      expect(() => parseHeadlessConfig({ version: 99 })).toThrow()
    })
  })

  describe('safeParseHeadlessConfig', () => {
    test('returns success for valid input', () => {
      const result = safeParseHeadlessConfig(validClaudeSchema)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('claude-headless')
      }
    })

    test('returns failure for invalid input', () => {
      const result = safeParseHeadlessConfig({ version: 99 })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================================================
// JSONPath Tests
// ============================================================================

describe('jsonPath', () => {
  const testObj = {
    type: 'message',
    message: {
      text: 'Hello world',
      nested: { value: 42 },
    },
    array: [1, 2, 3],
  }

  describe('basic extraction', () => {
    test('extracts root field', () => {
      expect(jsonPath(testObj, '$.type')).toBe('message')
    })

    test('extracts nested field', () => {
      expect(jsonPath(testObj, '$.message.text')).toBe('Hello world')
    })

    test('extracts deeply nested field', () => {
      expect(jsonPath(testObj, '$.message.nested.value')).toBe(42)
    })

    test('returns undefined for non-existent path', () => {
      expect(jsonPath(testObj, '$.missing')).toBeUndefined()
    })

    test('returns undefined for non-existent nested path', () => {
      expect(jsonPath(testObj, '$.message.missing.deep')).toBeUndefined()
    })
  })

  describe('literal strings', () => {
    test('returns literal string value', () => {
      expect(jsonPath(testObj, "'pending'")).toBe('pending')
    })

    test('returns empty literal string', () => {
      expect(jsonPath(testObj, "''")).toBe('')
    })

    test('returns literal with spaces', () => {
      expect(jsonPath(testObj, "'hello world'")).toBe('hello world')
    })
  })

  describe('edge cases', () => {
    test('handles null input', () => {
      expect(jsonPath(null, '$.type')).toBeUndefined()
    })

    test('handles undefined input', () => {
      expect(jsonPath(undefined, '$.type')).toBeUndefined()
    })

    test('handles non-object input', () => {
      expect(jsonPath('string', '$.type')).toBeUndefined()
    })

    test('handles invalid path format', () => {
      expect(jsonPath(testObj, 'type')).toBeUndefined()
    })
  })
})

describe('jsonPathString', () => {
  test('extracts string value', () => {
    expect(jsonPathString({ text: 'hello' }, '$.text')).toBe('hello')
  })

  test('converts number to string', () => {
    expect(jsonPathString({ num: 42 }, '$.num')).toBe('42')
  })

  test('returns undefined for missing path', () => {
    expect(jsonPathString({ x: 1 }, '$.y')).toBeUndefined()
  })

  test('returns undefined for null value', () => {
    expect(jsonPathString({ x: null }, '$.x')).toBeUndefined()
  })
})

// ============================================================================
// Output Parser Tests
// ============================================================================

describe('createOutputParser', () => {
  const config = parseHeadlessConfig(validClaudeSchema)
  const parser = createOutputParser(config)

  describe('parseLine', () => {
    test('maps assistant type to message', () => {
      const line = JSON.stringify({ type: 'assistant', message: { text: 'Hello' } })
      const result = parser.parseLine(line)
      expect(result).not.toBeNull()
      // Handle both single result and array of results
      const singleResult = Array.isArray(result) ? result[0] : result
      expect(singleResult?.type).toBe('message')
      expect(singleResult?.content).toBe('Hello')
    })

    test('maps tool_use type to tool_call', () => {
      const line = JSON.stringify({ type: 'tool_use', name: 'Read' })
      const result = parser.parseLine(line)
      expect(result).not.toBeNull()
      // Handle both single result and array of results
      const singleResult = Array.isArray(result) ? result[0] : result
      expect(singleResult?.type).toBe('tool_call')
      expect(singleResult?.title).toBe('Read')
      expect(singleResult?.status).toBe('pending')
    })

    test('returns null for unmapped event types', () => {
      const line = JSON.stringify({ type: 'unknown', data: 'test' })
      const result = parser.parseLine(line)
      expect(result).toBeNull()
    })

    test('returns null for invalid JSON', () => {
      const result = parser.parseLine('not valid json')
      expect(result).toBeNull()
    })

    test('returns null for empty line', () => {
      const result = parser.parseLine('')
      expect(result).toBeNull()
    })

    test('preserves raw event in result', () => {
      const event = { type: 'assistant', message: { text: 'Hi' } }
      const line = JSON.stringify(event)
      const result = parser.parseLine(line)
      // Handle both single result and array of results
      const singleResult = Array.isArray(result) ? result[0] : result
      expect(singleResult?.raw).toEqual(event)
    })

    test('extracts input from tool_use event', () => {
      const line = JSON.stringify({ type: 'tool_use', name: 'Read', input: { file_path: '/test.ts' } })
      const result = parser.parseLine(line)
      const singleResult = Array.isArray(result) ? result[0] : result
      expect(singleResult?.input).toEqual({ file_path: '/test.ts' })
    })

    test('extracts output from tool_result event', () => {
      const line = JSON.stringify({ type: 'tool_result', name: 'Read', content: 'file contents' })
      const result = parser.parseLine(line)
      const singleResult = Array.isArray(result) ? result[0] : result
      expect(singleResult?.output).toBe('file contents')
    })

    test('sets timestamp on parsed updates', () => {
      const before = Date.now()
      const line = JSON.stringify({ type: 'assistant', message: { text: 'Hello' } })
      const result = parser.parseLine(line)
      const after = Date.now()
      const singleResult = Array.isArray(result) ? result[0] : result
      expect(singleResult?.timestamp).toBeGreaterThanOrEqual(before)
      expect(singleResult?.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('parseLine with extra extract fields', () => {
    test('extra extract fields do not break parser', () => {
      const configWithExtras = parseHeadlessConfig({
        version: 1,
        name: 'extras-test',
        command: ['test'],
        sessionMode: 'stream',
        prompt: { flag: '-p' },
        output: { flag: '--output', value: 'json' },
        outputEvents: [
          {
            match: { path: '$.type', value: 'tool_use' },
            emitAs: 'tool_call',
            extract: {
              title: '$.name',
              status: "'pending'",
              input: '$.input',
              toolName: '$.name',
              mcpServer: '$.server',
            },
          },
        ],
        result: { matchPath: '$.type', matchValue: 'done', contentPath: '$.text' },
      })
      const extrasParser = createOutputParser(configWithExtras)
      const line = JSON.stringify({
        type: 'tool_use',
        name: 'WebSearch',
        input: { query: 'test' },
        server: 'mcp-search',
      })
      const result = extrasParser.parseLine(line)
      const singleResult = Array.isArray(result) ? result[0] : result
      expect(singleResult).not.toBeNull()
      expect(singleResult?.type).toBe('tool_call')
      expect(singleResult?.title).toBe('WebSearch')
      expect(singleResult?.input).toEqual({ query: 'test' })
    })
  })

  describe('parseLine with array wildcards', () => {
    const wildcardConfig = parseHeadlessConfig({
      version: 1,
      name: 'wildcard-test',
      command: ['test'],
      sessionMode: 'stream',
      prompt: { flag: '-p' },
      output: { flag: '--output', value: 'json' },
      outputEvents: [
        {
          match: { path: '$.message.content[*].type', value: 'tool_use' },
          emitAs: 'tool_call',
          extract: { title: '$.name', status: "'pending'" },
        },
        {
          match: { path: '$.items[*]', value: '*' },
          emitAs: 'message',
          extract: { content: '$.text' },
        },
      ],
      result: {
        matchPath: '$.type',
        matchValue: 'result',
        contentPath: '$.output',
      },
    })
    const wildcardParser = createOutputParser(wildcardConfig)

    test('returns array of updates for matching array items', () => {
      const line = JSON.stringify({
        message: {
          content: [
            { type: 'tool_use', name: 'Read', input: {} },
            { type: 'text', value: 'Hello' },
            { type: 'tool_use', name: 'Write', input: {} },
          ],
        },
      })
      const result = wildcardParser.parseLine(line)
      expect(Array.isArray(result)).toBe(true)
      if (Array.isArray(result)) {
        expect(result).toHaveLength(2)
        expect(result[0]!.type).toBe('tool_call')
        expect(result[0]!.title).toBe('Read')
        expect(result[0]!.status).toBe('pending')
        expect(result[1]!.type).toBe('tool_call')
        expect(result[1]!.title).toBe('Write')
        expect(result[1]!.status).toBe('pending')
      }
    })

    test('handles empty array gracefully', () => {
      const line = JSON.stringify({
        message: { content: [] },
      })
      const result = wildcardParser.parseLine(line)
      expect(result).toBeNull()
    })

    test('handles non-matching array items', () => {
      const line = JSON.stringify({
        message: {
          content: [
            { type: 'text', value: 'No tool use here' },
            { type: 'image', data: 'base64...' },
          ],
        },
      })
      const result = wildcardParser.parseLine(line)
      expect(result).toBeNull()
    })

    test('matches wildcard value for all non-null items', () => {
      const line = JSON.stringify({
        items: [{ text: 'Item 1' }, { text: 'Item 2' }, { text: 'Item 3' }],
      })
      const result = wildcardParser.parseLine(line)
      expect(Array.isArray(result)).toBe(true)
      if (Array.isArray(result)) {
        expect(result).toHaveLength(3)
        expect(result[0]!.content).toBe('Item 1')
        expect(result[1]!.content).toBe('Item 2')
        expect(result[2]!.content).toBe('Item 3')
      }
    })

    test('handles mixed array content with type guards', () => {
      const line = JSON.stringify({
        message: {
          content: [
            { type: 'tool_use', name: 'Valid' },
            'string-item',
            { no_type_property: true },
            null,
            { type: 'tool_use', name: 'AlsoValid' },
          ],
        },
      })
      const result = wildcardParser.parseLine(line)
      expect(Array.isArray(result)).toBe(true)
      if (Array.isArray(result)) {
        expect(result).toHaveLength(2)
        expect(result[0]!.title).toBe('Valid')
        expect(result[1]!.title).toBe('AlsoValid')
      }
    })
  })

  describe('jsonPath with array wildcard', () => {
    test('extracts array with [*] wildcard', () => {
      const obj = { items: [{ id: 1 }, { id: 2 }] }
      const result = jsonPath(obj, '$.items[*]')
      expect(Array.isArray(result)).toBe(true)
      if (Array.isArray(result)) {
        expect(result).toHaveLength(2)
      }
    })

    test('returns undefined for non-array at wildcard position', () => {
      const obj = { items: 'not-an-array' }
      const result = jsonPath(obj, '$.items[*]')
      expect(result).toBeUndefined()
    })

    test('handles empty array', () => {
      const obj = { items: [] }
      const result = jsonPath(obj, '$.items[*]')
      expect(result).toEqual([])
    })

    test('handles nested path to array', () => {
      const obj = { message: { content: [1, 2, 3] } }
      const result = jsonPath(obj, '$.message.content[*]')
      expect(result).toEqual([1, 2, 3])
    })

    test('returns undefined when path before wildcard is invalid', () => {
      const obj = { items: [1, 2, 3] }
      const result = jsonPath(obj, '$.missing[*]')
      expect(result).toBeUndefined()
    })
  })

  describe('parseResult', () => {
    test('detects result event', () => {
      const line = JSON.stringify({ type: 'result', result: 'Final answer' })
      const result = parser.parseResult(line)
      expect(result.isResult).toBe(true)
      if (result.isResult) {
        expect(result.content).toBe('Final answer')
      }
    })

    test('returns not-result for non-result events', () => {
      const line = JSON.stringify({ type: 'assistant', message: { text: 'Hi' } })
      const result = parser.parseResult(line)
      expect(result.isResult).toBe(false)
    })

    test('returns not-result for invalid JSON', () => {
      const result = parser.parseResult('invalid')
      expect(result.isResult).toBe(false)
    })

    test('handles missing content path', () => {
      const line = JSON.stringify({ type: 'result' })
      const result = parser.parseResult(line)
      expect(result.isResult).toBe(true)
      if (result.isResult) {
        expect(result.content).toBe('')
      }
    })
  })
})

// ============================================================================
// Passthrough Mode Tests
// ============================================================================

describe('passthrough mode', () => {
  const passthroughConfig = parseHeadlessConfig({
    version: 1,
    name: 'passthrough-test',
    command: ['test-agent'],
    sessionMode: 'stream',
    prompt: { flag: '-p' },
    output: { flag: '--output', value: 'json' },
    outputMode: 'passthrough',
    passthroughTypeMap: {
      typeField: 'type',
      typeValues: { tool_use: 'tool_call', tool_result: 'tool_call' },
    },
    result: { matchPath: '$.type', matchValue: 'result', contentPath: '$.content' },
  })
  const passthroughParser = createOutputParser(passthroughConfig)

  test('extracts input from tool_call event', () => {
    const line = JSON.stringify({ type: 'tool_use', name: 'Read', input: { file_path: '/test.ts' }, status: 'pending' })
    const result = passthroughParser.parseLine(line)
    const singleResult = Array.isArray(result) ? result[0] : result
    expect(singleResult?.type).toBe('tool_call')
    expect(singleResult?.input).toEqual({ file_path: '/test.ts' })
  })

  test('extracts output from tool_result event', () => {
    const line = JSON.stringify({ type: 'tool_result', name: 'Read', output: 'file contents', status: 'completed' })
    const result = passthroughParser.parseLine(line)
    const singleResult = Array.isArray(result) ? result[0] : result
    expect(singleResult?.type).toBe('tool_call')
    expect(singleResult?.output).toBe('file contents')
  })

  test('preserves object input type', () => {
    const line = JSON.stringify({ type: 'tool_use', name: 'Write', input: { path: '/a.ts', content: 'code' } })
    const result = passthroughParser.parseLine(line)
    const singleResult = Array.isArray(result) ? result[0] : result
    expect(singleResult?.input).toEqual({ path: '/a.ts', content: 'code' })
  })

  test('sets timestamp on passthrough updates', () => {
    const before = Date.now()
    const line = JSON.stringify({ type: 'message', content: 'Hello' })
    const result = passthroughParser.parseLine(line)
    const after = Date.now()
    const singleResult = Array.isArray(result) ? result[0] : result
    expect(singleResult?.timestamp).toBeGreaterThanOrEqual(before)
    expect(singleResult?.timestamp).toBeLessThanOrEqual(after)
  })

  test('handles absent input/output fields gracefully', () => {
    const line = JSON.stringify({ type: 'tool_use', name: 'Bash', status: 'pending' })
    const result = passthroughParser.parseLine(line)
    const singleResult = Array.isArray(result) ? result[0] : result
    expect(singleResult?.type).toBe('tool_call')
    expect(singleResult?.input).toBeUndefined()
    expect(singleResult?.output).toBeUndefined()
  })
})

// ============================================================================
// History Builder Tests
// ============================================================================

describe('createHistoryBuilder', () => {
  describe('basic operations', () => {
    test('starts with empty history', () => {
      const builder = createHistoryBuilder()
      expect(builder.getLength()).toBe(0)
      expect(builder.getHistory()).toEqual([])
    })

    test('adds turns to history', () => {
      const builder = createHistoryBuilder()
      builder.addTurn('Hello', 'Hi there')
      expect(builder.getLength()).toBe(1)
      expect(builder.getHistory()).toEqual([{ input: 'Hello', output: 'Hi there' }])
    })

    test('accumulates multiple turns', () => {
      const builder = createHistoryBuilder()
      builder.addTurn('Hello', 'Hi')
      builder.addTurn('How are you?', 'Fine')
      expect(builder.getLength()).toBe(2)
    })

    test('clears history', () => {
      const builder = createHistoryBuilder()
      builder.addTurn('Hello', 'Hi')
      builder.clear()
      expect(builder.getLength()).toBe(0)
    })
  })

  describe('formatHistory', () => {
    test('uses default template', () => {
      const builder = createHistoryBuilder()
      builder.addTurn('Hello', 'Hi there')
      const formatted = builder.formatHistory()
      expect(formatted).toBe('User: Hello\nAssistant: Hi there')
    })

    test('uses custom template', () => {
      const builder = createHistoryBuilder({
        template: 'Q: {{input}}\nA: {{output}}',
      })
      builder.addTurn('Question', 'Answer')
      const formatted = builder.formatHistory()
      expect(formatted).toBe('Q: Question\nA: Answer')
    })

    test('separates multiple turns with double newline', () => {
      const builder = createHistoryBuilder()
      builder.addTurn('First', 'One')
      builder.addTurn('Second', 'Two')
      const formatted = builder.formatHistory()
      expect(formatted).toBe('User: First\nAssistant: One\n\nUser: Second\nAssistant: Two')
    })

    test('returns empty string for no history', () => {
      const builder = createHistoryBuilder()
      expect(builder.formatHistory()).toBe('')
    })
  })

  describe('buildPrompt', () => {
    test('returns just input for first turn', () => {
      const builder = createHistoryBuilder()
      const prompt = builder.buildPrompt('Hello')
      expect(prompt).toBe('Hello')
    })

    test('includes history for subsequent turns', () => {
      const builder = createHistoryBuilder()
      builder.addTurn('Hello', 'Hi')
      const prompt = builder.buildPrompt('Next question')
      expect(prompt).toContain('User: Hello')
      expect(prompt).toContain('Assistant: Hi')
      expect(prompt).toContain('User: Next question')
    })

    test('builds complete context with multiple turns', () => {
      const builder = createHistoryBuilder()
      builder.addTurn('One', 'Reply one')
      builder.addTurn('Two', 'Reply two')
      const prompt = builder.buildPrompt('Three')
      expect(prompt).toContain('User: One')
      expect(prompt).toContain('User: Two')
      expect(prompt).toContain('User: Three')
    })
  })

  describe('getHistory returns copy', () => {
    test('modifying returned array does not affect internal state', () => {
      const builder = createHistoryBuilder()
      builder.addTurn('Hello', 'Hi')
      const history = builder.getHistory()
      history.push({ input: 'Fake', output: 'Fake' })
      expect(builder.getLength()).toBe(1)
    })
  })
})
