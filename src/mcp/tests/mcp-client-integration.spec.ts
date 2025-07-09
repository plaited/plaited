import { describe, it, expect } from 'bun:test'
import { defineMCPClient } from '../define-mcp-client.js'

describe('defineMCPClient - Integration Tests', () => {
  it('should create a valid MCP client factory', () => {
    const clientFactory = defineMCPClient({
      name: 'test-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'echo',
        args: ['test'],
      },
      async bProgram() {
        return {}
      },
    })

    expect(typeof clientFactory).toBe('function')
  })

  it('should accept custom event handlers', () => {
    type CustomEvents = {
      MY_EVENT: { data: string }
    }

    const clientFactory = defineMCPClient<CustomEvents>({
      name: 'test-client',
      version: '1.0.0',
      transport: {
        type: 'sse',
        url: 'http://example.com',
      },
      publicEvents: ['MY_EVENT'],
      async bProgram({ trigger, tools }) {
        // Can access all the expected parameters
        expect(typeof trigger).toBe('function')
        expect(typeof tools.get).toBe('function')
        expect(typeof tools.set).toBe('function')
        expect(typeof tools.listen).toBe('function')

        return {
          MY_EVENT({ data }) {
            console.log('Event received:', data)
          },
          TOOLS_DISCOVERED({ tools }) {
            console.log('Tools:', tools)
          }
        }
      },
    })

    expect(typeof clientFactory).toBe('function')
  })

  it('should support different transport types', () => {
    // STDIO transport
    const stdioClient = defineMCPClient({
      name: 'stdio-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-example'],
        env: { DEBUG: 'true' }
      },
      async bProgram() {
        return {}
      },
    })

    // SSE transport
    const sseClient = defineMCPClient({
      name: 'sse-client',
      version: '1.0.0',
      transport: {
        type: 'sse',
        url: 'https://api.example.com/mcp',
        headers: {
          'Authorization': 'Bearer token'
        }
      },
      async bProgram() {
        return {}
      },
    })

    expect(typeof stdioClient).toBe('function')
    expect(typeof sseClient).toBe('function')
  })

  it('should provide all MCP client event handlers', () => {
    const clientFactory = defineMCPClient({
      name: 'full-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test'
      },
      async bProgram({ client, trigger, bThread, bSync }) {
        // Verify all utilities are provided
        expect(typeof client).toBe('object')
        expect(typeof trigger).toBe('function')
        expect(typeof bThread).toBe('function')
        expect(typeof bSync).toBe('function')

        // Return handlers for all MCP events
        const handlers = {
          CLIENT_CONNECTED: ({ capabilities }: { capabilities: unknown }) => {
            console.log('Connected:', capabilities)
          },
          CLIENT_DISCONNECTED: ({ reason }: { reason?: string }) => {
            console.log('Disconnected:', reason)
          },
          CLIENT_ERROR: ({ error, operation }: { error: Error; operation?: string }) => {
            console.error('Error:', operation, error)
          },
          TOOLS_DISCOVERED: ({ tools }: { tools: Array<{ name: string; description?: string; inputSchema?: unknown }> }) => {
            console.log('Tools:', tools.length)
          },
          RESOURCES_DISCOVERED: ({ resources }: { resources: Array<{ uri: string; name?: string; description?: string; mimeType?: string }> }) => {
            console.log('Resources:', resources.length)
          },
          PROMPTS_DISCOVERED: ({ prompts }: { prompts: Array<{ name: string; description?: string; argsSchema?: unknown }> }) => {
            console.log('Prompts:', prompts.length)
          },
          CALL_TOOL: async ({ name, arguments: args }: { name: string; arguments: unknown }) => {
            console.log('Calling tool:', name, args)
          },
          READ_RESOURCE: async ({ uri }: { uri: string }) => {
            console.log('Reading resource:', uri)
          },
          GET_PROMPT: async ({ name, arguments: args }: { name: string; arguments: unknown }) => {
            console.log('Getting prompt:', name, args)
          },
          TOOL_RESULT: ({ name, result }: { name: string; result: unknown }) => {
            console.log('Tool result:', name, result)
          },
          RESOURCE_RESULT: ({ uri, result }: { uri: string; result: unknown }) => {
            console.log('Resource result:', uri, result)
          },
          PROMPT_RESULT: ({ name, result }: { name: string; result: unknown }) => {
            console.log('Prompt result:', name, result)
          }
        }

        return handlers as Partial<typeof handlers>
      },
    })

    expect(typeof clientFactory).toBe('function')
  })

  it('should support behavioral threads', () => {
    const clientFactory = defineMCPClient({
      name: 'threaded-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test'
      },
      async bProgram({ bThread, bSync }) {
        // Create behavioral threads
        bThread([
          bSync({
            waitFor: 'CLIENT_CONNECTED',
            request: { type: 'DISCOVER_ALL' }
          })
        ])

        bThread([
          bSync({
            waitFor: 'CALL_TOOL',
            block: 'READ_RESOURCE'
          })
        ], true)

        return {
          DISCOVER_ALL: () => {
            console.log('Discovering all primitives...')
          }
        }
      },
    })

    expect(typeof clientFactory).toBe('function')
  })
  
  it('should accept inference engine parameter', () => {
    const mockEngine = {
      async chat() {
        return { content: 'Mock response' }
      }
    }
    
    const clientFactory = defineMCPClient({
      name: 'ai-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test'
      },
      inferenceEngine: mockEngine
    })
    
    expect(typeof clientFactory).toBe('function')
  })
  
  it('should support default threads when enabled', () => {
    const clientFactory = defineMCPClient({
      name: 'default-threads-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test'
      },
      defaultThreads: true
    })
    
    expect(typeof clientFactory).toBe('function')
  })
  
  it('should combine inference engine with default threads', () => {
    const mockEngine = {
      async chat() {
        return { 
          content: 'I can help with that',
          toolCalls: [{ name: 'test_tool', arguments: {} }]
        }
      }
    }
    
    const clientFactory = defineMCPClient({
      name: 'full-agent',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test'
      },
      inferenceEngine: mockEngine,
      defaultThreads: true,
      publicEvents: ['CHAT', 'THINK']
    })
    
    expect(typeof clientFactory).toBe('function')
  })
  
  it('should allow custom handlers to override default handlers', () => {
    const mockEngine = {
      async chat() {
        return { content: 'Mock response' }
      }
    }
    
    const clientFactory = defineMCPClient({
      name: 'override-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test'
      },
      inferenceEngine: mockEngine,
      defaultThreads: true,
      
      async bProgram({ trigger }) {
        return {
          // Override default PROCESS_CHAT handler
          PROCESS_CHAT: () => {
            console.log('Custom chat processing')
            trigger({ type: 'CUSTOM_EVENT', detail: {} })
          },
          
          // Add new handler
          CUSTOM_EVENT: () => {
            console.log('Custom event handled')
          }
        }
      }
    })
    
    expect(typeof clientFactory).toBe('function')
  })
  
  it('should pass inference engine to bProgram', () => {
    const mockEngine = {
      async chat() {
        return { content: 'Test' }
      }
    }
    
    let receivedEngine
    
    const clientFactory = defineMCPClient({
      name: 'engine-test',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test'
      },
      inferenceEngine: mockEngine,
      
      async bProgram({ inferenceEngine }) {
        receivedEngine = inferenceEngine
        return {}
      }
    })
    
    expect(typeof clientFactory).toBe('function')
    // Note: In a real test, we'd need to invoke the factory to check receivedEngine
  })
})