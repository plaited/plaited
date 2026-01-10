#!/usr/bin/env bun
/**
 * Simple calculator MCP server for testing.
 *
 * @remarks
 * A minimal stdio-based MCP server that provides add/subtract/multiply/divide tools.
 * Used to verify ACP client works with MCP servers.
 */

type JsonRpcRequest = {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: unknown
}

type JsonRpcResponse = {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: { code: number; message: string }
}

type Tool = {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}

const tools: Tool[] = [
  {
    name: 'add',
    description: 'Add two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'subtract',
    description: 'Subtract two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'multiply',
    description: 'Multiply two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'divide',
    description: 'Divide two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'Dividend' },
        b: { type: 'number', description: 'Divisor' },
      },
      required: ['a', 'b'],
    },
  },
]

const handleRequest = (request: JsonRpcRequest): JsonRpcResponse => {
  const { id, method, params } = request

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'calculator-mcp', version: '1.0.0' },
      },
    }
  }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools } }
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params as { name: string; arguments: { a: number; b: number } }
    let result: number

    switch (name) {
      case 'add':
        result = args.a + args.b
        break
      case 'subtract':
        result = args.a - args.b
        break
      case 'multiply':
        result = args.a * args.b
        break
      case 'divide':
        if (args.b === 0) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Division by zero' },
          }
        }
        result = args.a / args.b
        break
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown tool: ${name}` },
        }
    }

    return {
      jsonrpc: '2.0',
      id,
      result: { content: [{ type: 'text', text: String(result) }] },
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Unknown method: ${method}` },
  }
}

// Stdio transport
const decoder = new TextDecoder()
let buffer = ''

const processLine = (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return

  try {
    const request = JSON.parse(trimmed) as JsonRpcRequest
    const response = handleRequest(request)
    console.log(JSON.stringify(response))
  } catch {
    // Ignore parse errors
  }
}

// Read from stdin
const stdin = Bun.stdin.stream()
const reader = stdin.getReader()

const read = async () => {
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      processLine(line)
    }
  }
}

read()
