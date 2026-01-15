/**
 * Tests for model-specific formatters.
 */

import { describe, expect, test } from 'bun:test'
import {
  FUNCTION_GEMMA_TOKENS,
  formatForFunctionGemma,
  formatFunctionGemmaResponse,
  parseFunctionGemmaCall,
  scriptToToolDefinition,
  skillToToolDefinition,
  type ToolDefinition,
  toolSchemaToDefinition,
} from '../formatters.ts'
import type { SkillMetadata, SkillScript } from '../skill-discovery.ts'

describe('formatters', () => {
  describe('FUNCTION_GEMMA_TOKENS', () => {
    test('exports expected tokens', () => {
      expect(FUNCTION_GEMMA_TOKENS.DECLARATION_START).toBe('<start_function_declaration>')
      expect(FUNCTION_GEMMA_TOKENS.DECLARATION_END).toBe('<end_function_declaration>')
      expect(FUNCTION_GEMMA_TOKENS.CALL_START).toBe('<start_function_call>')
      expect(FUNCTION_GEMMA_TOKENS.CALL_END).toBe('<end_function_call>')
      expect(FUNCTION_GEMMA_TOKENS.RESPONSE_START).toBe('<start_function_response>')
      expect(FUNCTION_GEMMA_TOKENS.RESPONSE_END).toBe('<end_function_response>')
      expect(FUNCTION_GEMMA_TOKENS.ESCAPE).toBe('<escape>')
    })
  })

  describe('formatForFunctionGemma', () => {
    test('formats tool with no parameters', () => {
      const tools: ToolDefinition[] = [
        {
          name: 'test_tool',
          description: 'A test tool',
        },
      ]

      const result = formatForFunctionGemma(tools)

      expect(result).toContain('<start_function_declaration>')
      expect(result).toContain('<end_function_declaration>')
      expect(result).toContain('declaration:test_tool')
      expect(result).toContain('description:<escape>A test tool<escape>')
      expect(result).toContain('parameters:{properties:{},required:[],type:<escape>OBJECT<escape>}')
    })

    test('formats tool with parameters', () => {
      const tools: ToolDefinition[] = [
        {
          name: 'greet',
          description: 'Greet a user',
          parameters: [
            { name: 'name', type: 'STRING', required: true, description: 'User name' },
            { name: 'formal', type: 'BOOLEAN', required: false },
          ],
        },
      ]

      const result = formatForFunctionGemma(tools)

      expect(result).toContain('name:{type:<escape>STRING<escape>,description:<escape>User name<escape>}')
      expect(result).toContain('formal:{type:<escape>BOOLEAN<escape>}')
      expect(result).toContain('required:[<escape>name<escape>]')
    })

    test('formats multiple tools', () => {
      const tools: ToolDefinition[] = [
        { name: 'tool_a', description: 'First tool' },
        { name: 'tool_b', description: 'Second tool' },
      ]

      const result = formatForFunctionGemma(tools)
      const lines = result.split('\n')

      expect(lines.length).toBe(2)
      expect(lines[0]).toContain('declaration:tool_a')
      expect(lines[1]).toContain('declaration:tool_b')
    })

    test('returns empty string for empty array', () => {
      const result = formatForFunctionGemma([])
      expect(result).toBe('')
    })
  })

  describe('parseFunctionGemmaCall', () => {
    test('parses function call with string argument', () => {
      const output = '<start_function_call>call:greet{name:<escape>Alice<escape>}<end_function_call>'

      const result = parseFunctionGemmaCall(output)

      expect(result).toBeDefined()
      expect(result!.name).toBe('greet')
      expect(result!.args).toEqual({ name: 'Alice' })
    })

    test('parses function call with boolean arguments', () => {
      const output = '<start_function_call>call:toggle{enabled:true,visible:false}<end_function_call>'

      const result = parseFunctionGemmaCall(output)

      expect(result).toBeDefined()
      expect(result!.name).toBe('toggle')
      expect(result!.args).toEqual({ enabled: true, visible: false })
    })

    test('parses function call with number arguments', () => {
      const output = '<start_function_call>call:calculate{value:42,ratio:3.14}<end_function_call>'

      const result = parseFunctionGemmaCall(output)

      expect(result).toBeDefined()
      expect(result!.name).toBe('calculate')
      expect(result!.args).toEqual({ value: 42, ratio: 3.14 })
    })

    test('parses function call with mixed arguments', () => {
      const output =
        '<start_function_call>call:create{name:<escape>Test<escape>,count:5,active:true}<end_function_call>'

      const result = parseFunctionGemmaCall(output)

      expect(result).toBeDefined()
      expect(result!.args).toEqual({ name: 'Test', count: 5, active: true })
    })

    test('returns undefined for invalid output', () => {
      expect(parseFunctionGemmaCall('no function call here')).toBeUndefined()
      expect(parseFunctionGemmaCall('<start_function_call>invalid<end_function_call>')).toBeUndefined()
    })

    test('extracts call from surrounding text', () => {
      const output = 'Here is my response: <start_function_call>call:test{}<end_function_call> and more text.'

      const result = parseFunctionGemmaCall(output)

      expect(result).toBeDefined()
      expect(result!.name).toBe('test')
      expect(result!.args).toEqual({})
    })
  })

  describe('formatFunctionGemmaResponse', () => {
    test('formats string response', () => {
      const result = formatFunctionGemmaResponse('greet', { message: 'Hello, Alice!' })

      expect(result).toBe(
        '<start_function_response>response:greet{message:<escape>Hello, Alice!<escape>}<end_function_response>',
      )
    })

    test('formats boolean response', () => {
      const result = formatFunctionGemmaResponse('check', { valid: true })

      expect(result).toBe('<start_function_response>response:check{valid:true}<end_function_response>')
    })

    test('formats number response', () => {
      const result = formatFunctionGemmaResponse('calculate', { total: 42 })

      expect(result).toBe('<start_function_response>response:calculate{total:42}<end_function_response>')
    })

    test('formats complex response as escaped JSON', () => {
      const result = formatFunctionGemmaResponse('getData', { items: ['a', 'b', 'c'] })

      expect(result).toContain('items:<escape>')
      expect(result).toContain('["a","b","c"]')
      expect(result).toContain('<escape>}')
    })

    test('formats multiple fields', () => {
      const result = formatFunctionGemmaResponse('status', {
        success: true,
        count: 5,
        message: 'Done',
      })

      expect(result).toContain('success:true')
      expect(result).toContain('count:5')
      expect(result).toContain('message:<escape>Done<escape>')
    })
  })

  describe('scriptToToolDefinition', () => {
    test('converts script to tool definition', () => {
      const script: SkillScript = {
        name: 'analyze',
        qualifiedName: 'test-skill:analyze',
        description: 'Analyze input data',
        location: '/path/to/analyze.ts',
        skillName: 'test-skill',
        extension: '.ts',
        parameters: [
          { name: 'input', type: 'string', required: true, description: 'Input file path' },
          { name: 'verbose', type: 'boolean', required: false },
        ],
      }

      const result = scriptToToolDefinition(script)

      expect(result.name).toBe('test-skill:analyze')
      expect(result.description).toBe('Analyze input data')
      expect(result.parameters).toHaveLength(2)
      expect(result.parameters![0]).toEqual({
        name: 'input',
        type: 'STRING',
        required: true,
        description: 'Input file path',
      })
      expect(result.parameters![1]).toEqual({
        name: 'verbose',
        type: 'BOOLEAN',
        required: false,
        description: undefined,
      })
    })

    test('handles script with no parameters', () => {
      const script: SkillScript = {
        name: 'run',
        qualifiedName: 'skill:run',
        description: 'Run the process',
        location: '/path/to/run.sh',
        skillName: 'skill',
        extension: '.sh',
        parameters: [],
      }

      const result = scriptToToolDefinition(script)

      expect(result.name).toBe('skill:run')
      expect(result.parameters).toEqual([])
    })
  })

  describe('skillToToolDefinition', () => {
    test('converts skill metadata to tool definition', () => {
      const skill: SkillMetadata = {
        name: 'test-skill',
        description: 'A test skill for formatting',
        location: '/path/to/SKILL.md',
        skillDir: '/path/to',
      }

      const result = skillToToolDefinition(skill)

      expect(result.name).toBe('load_skill:test-skill')
      expect(result.description).toBe('Load the test-skill skill: A test skill for formatting')
      expect(result.parameters).toEqual([])
    })
  })

  describe('toolSchemaToDefinition', () => {
    test('converts OpenAI-style schema to tool definition', () => {
      const schema = {
        name: 'search',
        description: 'Search for files',
        parameters: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number' },
          },
          required: ['query'],
        },
      }

      const result = toolSchemaToDefinition(schema)

      expect(result.name).toBe('search')
      expect(result.description).toBe('Search for files')
      expect(result.parameters).toHaveLength(2)
      expect(result.parameters![0]).toEqual({
        name: 'query',
        type: 'STRING',
        required: true,
        description: 'Search query',
      })
      expect(result.parameters![1]).toEqual({
        name: 'limit',
        type: 'NUMBER',
        required: false,
        description: undefined,
      })
    })

    test('handles schema with no required properties', () => {
      const schema = {
        name: 'optional',
        description: 'All optional',
        parameters: {
          type: 'object' as const,
          properties: {
            value: { type: 'string' },
          },
        },
      }

      const result = toolSchemaToDefinition(schema)

      // When required array is missing, required is undefined (falsy)
      expect(result.parameters![0]!.required).toBeFalsy()
    })

    test('handles missing type as STRING', () => {
      const schema = {
        name: 'untyped',
        description: 'Missing types',
        parameters: {
          type: 'object' as const,
          properties: {
            field: { description: 'No type specified' },
          },
        },
      }

      const result = toolSchemaToDefinition(schema)

      expect(result.parameters![0]!.type).toBe('STRING')
    })
  })
})
