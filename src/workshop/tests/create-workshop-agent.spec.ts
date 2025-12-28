import { expect, test } from 'bun:test'
import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod/v4'
import { createWorkshopMcpServer } from '../create-workshop-agent.ts'

test('createWorkshopMcpServer returns an MCP server configuration', () => {
  const server = createWorkshopMcpServer()

  expect(server).toBeDefined()
  expect(typeof server).toBe('object')
})

test('createWorkshopMcpServer accepts default parameters', () => {
  expect(() => createWorkshopMcpServer()).not.toThrow()
})

test('createWorkshopMcpServer accepts custom name and version', () => {
  expect(() =>
    createWorkshopMcpServer({
      name: 'custom-workshop',
      version: '2.0.0',
    }),
  ).not.toThrow()
})

test('createWorkshopMcpServer accepts empty additional tools', () => {
  expect(() =>
    createWorkshopMcpServer({
      additionalTools: [],
    }),
  ).not.toThrow()
})

test('createWorkshopMcpServer accepts additional tools', () => {
  const mockTool = tool(
    'mock_tool',
    'A mock tool for testing',
    {
      test: z.string().describe('Test parameter'),
    },
    async () => ({
      content: [{ type: 'text' as const, text: 'mock' }],
    }),
  ) as unknown as ReturnType<typeof tool>

  expect(() =>
    createWorkshopMcpServer({
      additionalTools: [mockTool],
    }),
  ).not.toThrow()
})

test('createWorkshopMcpServer accepts multiple additional tools', () => {
  const mockTool1 = tool(
    'mock_tool_1',
    'First mock tool',
    {
      param1: z.string().describe('Parameter 1'),
    },
    async () => ({
      content: [{ type: 'text' as const, text: 'mock1' }],
    }),
  ) as unknown as ReturnType<typeof tool>

  const mockTool2 = tool(
    'mock_tool_2',
    'Second mock tool',
    {
      param2: z.number().describe('Parameter 2'),
    },
    async () => ({
      content: [{ type: 'text' as const, text: 'mock2' }],
    }),
  ) as unknown as ReturnType<typeof tool>

  expect(() =>
    createWorkshopMcpServer({
      additionalTools: [mockTool1, mockTool2],
    }),
  ).not.toThrow()
})

test('createWorkshopMcpServer with all custom options', () => {
  const customTool = tool(
    'custom_tool',
    'Custom tool description',
    {
      cwd: z.string().describe('Working directory'),
    },
    async () => ({
      content: [{ type: 'text' as const, text: 'custom' }],
    }),
  ) as unknown as ReturnType<typeof tool>

  expect(() =>
    createWorkshopMcpServer({
      name: 'fully-custom-server',
      version: '3.0.0',
      additionalTools: [customTool],
    }),
  ).not.toThrow()
})
