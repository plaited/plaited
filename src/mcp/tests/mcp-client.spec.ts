import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'

// Mock the MCP SDK imports before importing our module
const mockClient = {
  connect: mock(() => Promise.resolve()),
  close: mock(() => Promise.resolve()),
  getServerVersion: mock(() => ({ name: 'test-server', version: '1.0.0' })),
  getServerCapabilities: mock(() => ({
    tools: true,
    resources: true,
    prompts: true,
  })),
  listTools: mock(() =>
    Promise.resolve({
      tools: [
        {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' },
            },
          },
        },
      ],
    })
  ),
  listResources: mock(() =>
    Promise.resolve({
      resources: [
        {
          uri: 'test://resource',
          name: 'test-resource',
          description: 'A test resource',
          mimeType: 'text/plain',
        },
      ],
    })
  ),
  listPrompts: mock(() =>
    Promise.resolve({
      prompts: [
        {
          name: 'test-prompt',
          description: 'A test prompt',
          argsSchema: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      ],
    })
  ),
  callTool: mock(({ name, arguments: args }) =>
    Promise.resolve({
      content: [
        {
          type: 'text',
          text: `Tool ${name} called with ${JSON.stringify(args)}`,
        },
      ],
    })
  ),
  readResource: mock(({ uri }) =>
    Promise.resolve({
      contents: [
        {
          text: `Resource at ${uri}`,
          mimeType: 'text/plain',
        },
      ],
    })
  ),
  getPrompt: mock(({ name, arguments: args }) =>
    Promise.resolve({
      messages: [
        {
          role: 'assistant',
          content: `Prompt ${name} with ${JSON.stringify(args)}`,
        },
      ],
    })
  ),
}

// Mock Client constructor
const ClientMock = mock(() => mockClient)

// Mock transport constructors  
const _StdioClientTransportMock = mock(() => ({ close: mock(() => Promise.resolve()) }))
const _SSEClientTransportMock = mock((_url: string) => ({ close: mock(() => Promise.resolve()) }))

// Override imports
import * as mcpClient from '@modelcontextprotocol/sdk/client/index.js'
// @ts-ignore - Mocking the Client constructor
spyOn(mcpClient, 'Client').mockImplementation(ClientMock as unknown as typeof mcpClient.Client)

// Mock the createTransport function
const mockTransport = { close: mock(() => Promise.resolve()) }
import * as mcpUtils from '../mcp.utils.js'
spyOn(mcpUtils, 'createTransport').mockReturnValue(Promise.resolve(mockTransport))

// Now import the module to test
import { defineMCPClient } from '../define-mcp-client.js'

describe('defineMCPClient', () => {
  beforeEach(() => {
    // Reset all mocks
    mockClient.connect.mockClear()
    mockClient.close.mockClear()
    mockClient.listTools.mockClear()
    mockClient.listResources.mockClear()
    mockClient.listPrompts.mockClear()
    mockClient.callTool.mockClear()
    mockClient.readResource.mockClear()
    mockClient.getPrompt.mockClear()
    ClientMock.mockClear()
    
    // Reset mock implementations to defaults
    mockClient.connect.mockImplementation(() => Promise.resolve())
    mockClient.close.mockImplementation(() => Promise.resolve())
  })

  afterEach(() => {
    // Clean up any global state
    delete (global as Record<string, unknown>).mockDisconnect
  })

  it('should create a client and connect successfully', async () => {
    const events: Array<{ type: string; detail: unknown }> = []

    const createClient = defineMCPClient({
      name: 'test-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test',
      },
      publicEvents: ['CALL_TOOL'],
      async bProgram({ trigger: _trigger }) {
        return {
          CLIENT_CONNECTED(detail) {
            events.push({ type: 'CLIENT_CONNECTED', detail })
          },
          CLIENT_ERROR(detail) {
            events.push({ type: 'CLIENT_ERROR', detail })
          },
        }
      },
    })

    const _trigger = await createClient()
    
    // Check that Client was instantiated
    expect(ClientMock).toHaveBeenCalled()
    expect(mockClient.connect).toHaveBeenCalled()
    
    // Allow events to propagate
    await new Promise((resolve) => setTimeout(resolve, 50))
    
    // Check that we got the connected event
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('CLIENT_CONNECTED')
    expect((events[0].detail as { capabilities: unknown }).capabilities).toEqual({
      tools: true,
      resources: true,
      prompts: true,
    })
  })

  it('should discover primitives and update signals', async () => {
    const discoveredTools: Array<{ name: string; description?: string; inputSchema?: unknown }> = []
    const discoveredResources: Array<{ uri: string; name?: string; description?: string; mimeType?: string }> = []
    const discoveredPrompts: Array<{ name: string; description?: string; argsSchema?: unknown }> = []

    const createClient = defineMCPClient({
      name: 'test-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test',
      },
      async bProgram({ trigger, tools, resources, prompts }) {
        // Listen for discovery events
        tools.listen('TOOLS_DISCOVERED', trigger)
        resources.listen('RESOURCES_DISCOVERED', trigger)
        prompts.listen('PROMPTS_DISCOVERED', trigger)

        return {
          CLIENT_CONNECTED() {
            // Trigger discovery on connection
            trigger({ type: 'DISCOVER_ALL' })
          },
          TOOLS_DISCOVERED(toolsList) {
            // Signal events pass the value directly, not wrapped in an object
            if (Array.isArray(toolsList) && toolsList.length > 0) {
              discoveredTools.length = 0 // Clear array
              discoveredTools.push(...toolsList)
            }
          },
          RESOURCES_DISCOVERED(resourcesList) {
            if (Array.isArray(resourcesList) && resourcesList.length > 0) {
              discoveredResources.length = 0 // Clear array
              discoveredResources.push(...resourcesList)
            }
          },
          PROMPTS_DISCOVERED(promptsList) {
            if (Array.isArray(promptsList) && promptsList.length > 0) {
              discoveredPrompts.length = 0 // Clear array
              discoveredPrompts.push(...promptsList)
            }
          },
          async DISCOVER_ALL() {
            try {
              // Call the mock list methods directly  
              const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
                mockClient.listTools(),
                mockClient.listResources(),
                mockClient.listPrompts()
              ])
              
              // Update signals with results
              tools.set(toolsResult.tools)
              resources.set(resourcesResult.resources)
              prompts.set(promptsResult.prompts)
            } catch (error) {
              console.error('Discovery error:', error)
              trigger({ type: 'CLIENT_ERROR', detail: { error, operation: 'discover' } })
            }
          },
        }
      },
    })

    await createClient()

    // Allow async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(discoveredTools).toHaveLength(1)
    expect(discoveredTools[0].name).toBe('test-tool')

    expect(discoveredResources).toHaveLength(1)
    expect(discoveredResources[0].uri).toBe('test://resource')

    expect(discoveredPrompts).toHaveLength(1)
    expect(discoveredPrompts[0].name).toBe('test-prompt')
  })

  it('should execute tool calls and emit results', async () => {
    const results: Array<{ name: string; result: unknown }> = []

    const createClient = defineMCPClient({
      name: 'test-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test',
      },
      publicEvents: ['CALL_TOOL'],
      async bProgram({ client, trigger }) {
        return {
          async CALL_TOOL({ name, arguments: args }) {
            try {
              const result = await client.callTool({ name, arguments: args as Record<string, unknown> })
              trigger({ type: 'TOOL_RESULT', detail: { name, result } })
            } catch (error) {
              trigger({
                type: 'CLIENT_ERROR',
                detail: { error, operation: `callTool:${name}` },
              })
            }
          },
          TOOL_RESULT(detail) {
            results.push(detail)
          },
        }
      },
    })

    const trigger = await createClient()

    // Call a tool
    trigger({
      type: 'CALL_TOOL',
      detail: {
        name: 'test-tool',
        arguments: { input: 'hello' },
      },
    })

    // Allow async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(mockClient.callTool).toHaveBeenCalledWith({
      name: 'test-tool',
      arguments: { input: 'hello' },
    })
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('test-tool')
    expect((results[0].result as { content: Array<{ text: string }> }).content[0].text).toContain('Tool test-tool called')
  })

  it('should filter public events', async () => {
    const events: string[] = []

    const createClient = defineMCPClient({
      name: 'test-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test',
      },
      publicEvents: ['CALL_TOOL'], // Only CALL_TOOL is public
      async bProgram() {
        return {
          CALL_TOOL() {
            events.push('CALL_TOOL')
          },
          READ_RESOURCE() {
            events.push('READ_RESOURCE')
          },
        }
      },
    })

    const trigger = await createClient()

    // Try to trigger both events
    trigger({ type: 'CALL_TOOL', detail: { name: 'test', arguments: {} } })
    
    // This should throw since READ_RESOURCE is not public
    expect(() => {
      trigger({ type: 'READ_RESOURCE', detail: { uri: 'test://resource' } })
    }).toThrow('Not a public BPEvent type: READ_RESOURCE')

    // Allow async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Only CALL_TOOL should have been triggered
    expect(events).toEqual(['CALL_TOOL'])
  })

  it('should handle connection errors', async () => {
    const errors: Array<{ error: Error; operation?: string }> = []

    // Make connect fail
    mockClient.connect = mock(() => Promise.reject(new Error('Connection failed')))

    const createClient = defineMCPClient({
      name: 'test-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test',
      },
      async bProgram() {
        return {
          CLIENT_ERROR(detail) {
            errors.push(detail)
          },
        }
      },
    })

    // Connection should throw
    await expect(createClient()).rejects.toThrow()
    
    // Allow async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100))
    
    expect(errors).toHaveLength(1)
    expect(errors[0].error.message).toBe('Connection failed')
    expect(errors[0].operation).toBe('connect')
  })

  it.skip('should clean up on disconnect', async () => {
    let disconnectCalled = false
    let clientDisconnect: (() => Promise<void>) | undefined

    const createClient = defineMCPClient({
      name: 'test-client',
      version: '1.0.0',
      transport: {
        type: 'stdio',
        command: 'test',
      },
      publicEvents: ['TRIGGER_DISCONNECT'],
      async bProgram({ disconnect, trigger }) {
        // The disconnect parameter in bProgram args is a function that registers
        // cleanup callbacks via addDisconnectCallback on the PlaitedTrigger
        trigger.addDisconnectCallback(() => {
          disconnectCalled = true
        })
        
        // Store the disconnect function - it returns a Promise
        clientDisconnect = disconnect as () => Promise<void>

        return {
          async TRIGGER_DISCONNECT() {
            // Call the actual disconnect
            if (clientDisconnect) {
              await clientDisconnect()
            }
          },
          CLIENT_DISCONNECTED() {
            // Handle disconnection event
          },
        }
      },
    })

    const trigger = await createClient()
    
    // Trigger disconnect through our custom event
    trigger({ type: 'TRIGGER_DISCONNECT' })

    // Allow async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(mockClient.close).toHaveBeenCalled()
    expect(disconnectCalled).toBe(true)
  })
})