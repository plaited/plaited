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

// MCP stdio transport with Content-Length framing (like LSP)
const decoder = new TextDecoder()
const encoder = new TextEncoder()
let buffer = ''

/** Send a JSON-RPC response with Content-Length framing */
const sendResponse = (response: JsonRpcResponse) => {
  const json = JSON.stringify(response)
  const message = `Content-Length: ${encoder.encode(json).length}\r\n\r\n${json}`
  process.stdout.write(message)
}

/** Parse Content-Length header and extract message */
const parseMessage = (): JsonRpcRequest | null => {
  // Look for Content-Length header
  const headerEnd = buffer.indexOf('\r\n\r\n')
  if (headerEnd === -1) return null

  const header = buffer.slice(0, headerEnd)
  const match = header.match(/Content-Length:\s*(\d+)/i)
  if (!match) {
    // Invalid header, skip to next potential header
    buffer = buffer.slice(headerEnd + 4)
    return null
  }

  // match[1] is guaranteed to be the captured group from the regex
  const contentLength = parseInt(match[1] as string, 10)
  const messageStart = headerEnd + 4
  const messageEnd = messageStart + contentLength

  // Check if we have the full message
  if (buffer.length < messageEnd) return null

  const json = buffer.slice(messageStart, messageEnd)
  buffer = buffer.slice(messageEnd)

  try {
    return JSON.parse(json) as JsonRpcRequest
  } catch {
    return null
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

    // Process all complete messages in buffer
    let request = parseMessage()
    while (request !== null) {
      const response = handleRequest(request)
      sendResponse(response)
      request = parseMessage()
    }
  }
}

read()
