/**
 * Example MCP client implementation demonstrating common patterns
 */
import { defineMCPClient } from '../define-mcp-client.js'

// Custom event types for this client
type FileSystemEvents = {
  SEARCH_FILES: { pattern: string; directory?: string }
  CREATE_FILE: { path: string; content: string }
  FILE_CREATED: { path: string }
  SEARCH_RESULTS: { files: string[] }
}

/**
 * Creates a filesystem MCP client with advanced features
 */
export const createFileSystemClient = defineMCPClient<FileSystemEvents>({
  name: 'filesystem-client',
  version: '1.0.0',
  
  transport: {
    type: 'stdio',
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
  },
  
  publicEvents: [
    'SEARCH_FILES',
    'CREATE_FILE',
    'READ_RESOURCE',
    'CALL_TOOL',
  ],
  
  async bProgram({ 
    client, 
    tools, 
    resources,
    prompts, 
    trigger, 
    bThread, 
    bSync,
    disconnect: _disconnect 
  }) {
    // Thread 1: Auto-discover on connection
    bThread([
      bSync({ 
        waitFor: 'CLIENT_CONNECTED' 
      }),
      bSync({
        request: { type: 'DISCOVER_PRIMITIVES' }
      })
    ])
    
    // Thread 2: Log all discoveries
    bThread([
      bSync({
        waitFor: ['TOOLS_DISCOVERED', 'RESOURCES_DISCOVERED', 'PROMPTS_DISCOVERED']
      })
    ], true) // Repeat indefinitely
    
    // Thread 3: Rate limiting for tool calls
    let lastToolCall = 0
    const RATE_LIMIT_MS = 100
    
    bThread([
      bSync({
        waitFor: 'CALL_TOOL',
        block: tools.get()?.length === 0 ? 'CALL_TOOL' : undefined
      }),
      bSync({
        request: { type: 'ENFORCE_RATE_LIMIT' }
      })
    ], true)
    
    return {
      // Lifecycle handlers
      CLIENT_CONNECTED({ capabilities }) {
        console.log('Connected to MCP server:', capabilities)
      },
      
      CLIENT_DISCONNECTED({ reason }) {
        console.log('Disconnected:', reason)
      },
      
      CLIENT_ERROR({ error, operation }) {
        console.error(`Error in ${operation}:`, error)
      },
      
      // Discovery handlers
      async DISCOVER_PRIMITIVES() {
        const { discoverPrimitives } = await import('../mcp.utils.js')
        await discoverPrimitives(client, { tools, resources, prompts }, trigger)
      },
      
      TOOLS_DISCOVERED({ tools: discovered }) {
        console.log(`Discovered ${discovered.length} tools:`)
        discovered.forEach(tool => {
          console.log(`  - ${tool.name}: ${tool.description}`)
        })
      },
      
      RESOURCES_DISCOVERED({ resources: discovered }) {
        console.log(`Discovered ${discovered.length} resources:`)
        discovered.forEach(resource => {
          console.log(`  - ${resource.uri}: ${resource.description}`)
        })
      },
      
      PROMPTS_DISCOVERED({ prompts: discovered }) {
        console.log(`Discovered ${discovered.length} prompts:`)
        discovered.forEach(prompt => {
          console.log(`  - ${prompt.name}: ${prompt.description}`)
        })
      },
      
      // Rate limiting
      ENFORCE_RATE_LIMIT() {
        const now = Date.now()
        const elapsed = now - lastToolCall
        
        if (elapsed < RATE_LIMIT_MS) {
          const waitTime = RATE_LIMIT_MS - elapsed
          console.log(`Rate limiting: waiting ${waitTime}ms`)
          return new Promise(resolve => setTimeout(resolve, waitTime))
        }
        
        lastToolCall = now
      },
      
      // Tool operations
      async CALL_TOOL({ name, arguments: args }) {
        try {
          console.log(`Calling tool: ${name}`, args)
          const result = await client.callTool({ name, arguments: args as Record<string, unknown> })
          trigger({ type: 'TOOL_RESULT', detail: { name, result } })
        } catch (error) {
          trigger({ 
            type: 'CLIENT_ERROR', 
            detail: { 
              error: error instanceof Error ? error : new Error(String(error)), 
              operation: `callTool:${name}` 
            } 
          })
        }
      },
      
      TOOL_RESULT({ name, result }) {
        console.log(`Tool ${name} result:`, result)
      },
      
      // Resource operations
      async READ_RESOURCE({ uri }) {
        try {
          console.log(`Reading resource: ${uri}`)
          const result = await client.readResource({ uri })
          trigger({ type: 'RESOURCE_RESULT', detail: { uri, result } })
        } catch (error) {
          trigger({ 
            type: 'CLIENT_ERROR', 
            detail: { 
              error: error instanceof Error ? error : new Error(String(error)), 
              operation: `readResource:${uri}` 
            } 
          })
        }
      },
      
      RESOURCE_RESULT({ uri, result }) {
        console.log(`Resource ${uri} result:`, result)
      },
      
      // Custom high-level operations
      async SEARCH_FILES({ pattern, directory }) {
        // Use the search tool if available
        const searchTool = tools.get()?.find(t => t.name === 'search_files')
        
        if (!searchTool) {
          trigger({ 
            type: 'CLIENT_ERROR', 
            detail: { 
              error: new Error('search_files tool not available'), 
              operation: 'SEARCH_FILES' 
            } 
          })
          return
        }
        
        trigger({
          type: 'CALL_TOOL',
          detail: {
            name: 'search_files',
            arguments: { pattern, directory: directory || '.' }
          }
        })
      },
      
      async CREATE_FILE({ path, content }) {
        // Use the write_file tool if available
        const writeTool = tools.get()?.find(t => t.name === 'write_file')
        
        if (!writeTool) {
          trigger({ 
            type: 'CLIENT_ERROR', 
            detail: { 
              error: new Error('write_file tool not available'), 
              operation: 'CREATE_FILE' 
            } 
          })
          return
        }
        
        trigger({
          type: 'CALL_TOOL',
          detail: {
            name: 'write_file',
            arguments: { path, content }
          }
        })
      },
    }
  }
})

// Example usage:
if (import.meta.main) {
  const client = await createFileSystemClient()
  
  // Search for TypeScript files
  client({
    type: 'SEARCH_FILES',
    detail: {
      pattern: '**/*.ts',
      directory: './src'
    }
  })
  
  // Create a new file
  client({
    type: 'CREATE_FILE',
    detail: {
      path: './test.txt',
      content: 'Hello from MCP client!'
    }
  })
}