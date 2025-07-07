#!/usr/bin/env bun
/**
 * Example demonstrating MCP client with inference engine integration
 * 
 * This example shows how to:
 * 1. Connect to multiple MCP servers
 * 2. Dynamically discover and filter tools
 * 3. Integrate with LLM inference
 * 4. Handle tool execution in conversations
 */

import { defineMCPClient } from '../define-mcp-client.js'

// Types for our custom events
type AgentEvents = {
  // Chat events
  CHAT: { messages: Array<{ role: string; content: string }> }
  CHAT_RESPONSE: { message: { role: string; content: string } }
  
  // Tool filtering
  FILTER_TOOLS: { query: string }
  TOOLS_FILTERED: { count: number }
  
  // Status events  
  STATUS: { message: string }
}

// Mock inference engine for demonstration
class MockInferenceEngine {
  async chat(params: {
    messages: Array<{ role: string; content: string }>
    tools?: Array<{ name: string; description?: string }>
    onToolCall?: (call: { name: string; arguments: unknown }) => Promise<unknown>
  }) {
    console.log('🤖 Processing chat with', params.tools?.length || 0, 'available tools')
    
    // Simulate tool usage based on message content
    const lastMessage = params.messages[params.messages.length - 1]
    
    if (lastMessage.content.includes('weather') && params.tools?.some(t => t.name === 'get_weather')) {
      // Simulate weather tool call
      if (params.onToolCall) {
        const result = await params.onToolCall({
          name: 'get_weather',
          arguments: { location: 'San Francisco' }
        })
        return {
          role: 'assistant',
          content: `Based on the weather data: ${JSON.stringify(result)}`
        }
      }
    }
    
    if (lastMessage.content.includes('file') && params.tools?.some(t => t.name === 'read_file')) {
      // Simulate file tool call
      if (params.onToolCall) {
        const result = await params.onToolCall({
          name: 'read_file',
          arguments: { path: './README.md' }
        })
        return {
          role: 'assistant',
          content: `File contents: ${JSON.stringify(result)}`
        }
      }
    }
    
    // Default response
    return {
      role: 'assistant',
      content: `I understand you said: "${lastMessage.content}". I have ${params.tools?.length || 0} tools available.`
    }
  }
}

/**
 * Create an intelligent agent with MCP integration
 */
export const createIntelligentAgent = defineMCPClient<AgentEvents>({
  name: 'intelligent-agent',
  version: '1.0.0',
  
  // For this example, we'll use a mock transport
  // In production, use: { type: 'stdio', command: 'npx', args: ['@modelcontextprotocol/server-everything'] }
  transport: {
    type: 'stdio',
    command: 'echo',
    args: ['mock-server']
  },
  
  publicEvents: [
    'CHAT',
    'FILTER_TOOLS',
    'CALL_TOOL',
  ],
  
  async bProgram({ 
    client: _client,
    tools,
    resources: _resources,
    prompts: _prompts,
    trigger,
    bThread,
    bSync,
    disconnect: _disconnect
  }) {
    // Initialize inference engine
    const inference = new MockInferenceEngine()
    
    // Thread 1: Auto-discover primitives on connection
    bThread([
      bSync({ 
        waitFor: 'CLIENT_CONNECTED',
        request: { type: 'DISCOVER_ALL' }
      })
    ])
    
    // Thread 2: Tool filtering based on conversation context
    let filteredTools: Array<{ name: string; description?: string }> = []
    
    bThread([
      bSync({
        waitFor: 'FILTER_TOOLS'
      }),
      bSync({
        request: { type: 'APPLY_FILTER' }
      })
    ], true)
    
    // Thread 3: Block tool calls when no tools are available
    bThread([
      bSync({
        block: filteredTools.length === 0 ? 'CALL_TOOL' : undefined,
        waitFor: ['TOOLS_DISCOVERED', 'TOOLS_FILTERED']
      })
    ], true)
    
    return {
      // Lifecycle handlers
      CLIENT_CONNECTED({ capabilities }) {
        trigger({ 
          type: 'STATUS', 
          detail: { message: `Connected with capabilities: ${JSON.stringify(capabilities)}` }
        })
      },
      
      CLIENT_ERROR({ error, operation }) {
        console.error(`❌ Error in ${operation}:`, error)
        trigger({ 
          type: 'STATUS', 
          detail: { message: `Error: ${error.message}` }
        })
      },
      
      // Discovery handlers
      async DISCOVER_ALL() {
        trigger({ 
          type: 'STATUS', 
          detail: { message: 'Discovering available tools...' }
        })
        
        // In a real implementation, this would call:
        // await discoverPrimitives(client, { tools, resources, prompts }, trigger)
        
        // For demo, simulate discovery
        tools.set([
          { name: 'get_weather', description: 'Get weather for a location' },
          { name: 'read_file', description: 'Read file contents' },
          { name: 'search_web', description: 'Search the web' },
          { name: 'send_email', description: 'Send an email' },
        ])
        
        trigger({ type: 'TOOLS_DISCOVERED', detail: { tools: tools.get() } })
      },
      
      TOOLS_DISCOVERED({ tools: discovered }) {
        trigger({ 
          type: 'STATUS', 
          detail: { message: `Discovered ${discovered.length} tools` }
        })
        
        // Start with all tools available
        filteredTools = discovered
      },
      
      // Tool filtering
      FILTER_TOOLS({ query }) {
        trigger({ 
          type: 'STATUS', 
          detail: { message: `Filtering tools for: "${query}"` }
        })
      },
      
      APPLY_FILTER() {
        const allTools = tools.get()
        
        // Simple keyword-based filtering
        // In production, use LLM to intelligently select relevant tools
        const keywords = ['weather', 'temperature', 'forecast']
        const hasWeatherQuery = keywords.some(k => 
          JSON.stringify(filteredTools).toLowerCase().includes(k)
        )
        
        if (hasWeatherQuery) {
          filteredTools = allTools.filter(t => 
            t.name === 'get_weather' || t.name === 'search_web'
          )
        } else {
          filteredTools = allTools
        }
        
        trigger({ 
          type: 'TOOLS_FILTERED', 
          detail: { count: filteredTools.length }
        })
      },
      
      TOOLS_FILTERED({ count }) {
        trigger({ 
          type: 'STATUS', 
          detail: { message: `Using ${count} relevant tools` }
        })
      },
      
      // Chat handling
      async CHAT({ messages }) {
        trigger({ 
          type: 'STATUS', 
          detail: { message: 'Processing chat...' }
        })
        
        // Filter tools based on the conversation
        const lastMessage = messages[messages.length - 1].content
        trigger({ type: 'FILTER_TOOLS', detail: { query: lastMessage } })
        
        // Wait a bit for filtering to complete
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Chat with filtered tools
        const response = await inference.chat({
          messages,
          tools: filteredTools,
          onToolCall: async (toolCall) => {
            trigger({ 
              type: 'STATUS', 
              detail: { message: `Calling tool: ${toolCall.name}` }
            })
            
            // Route to MCP server
            trigger({
              type: 'CALL_TOOL',
              detail: {
                name: toolCall.name,
                arguments: toolCall.arguments
              }
            })
            
            // In real implementation, wait for TOOL_RESULT
            // For demo, return mock result
            return { result: `Mock result for ${toolCall.name}` }
          }
        })
        
        trigger({ 
          type: 'CHAT_RESPONSE', 
          detail: { message: response }
        })
      },
      
      // Tool execution
      async CALL_TOOL({ name, arguments: args }) {
        trigger({ 
          type: 'STATUS', 
          detail: { message: `Executing ${name} with ${JSON.stringify(args)}` }
        })
        
        // In real implementation:
        // const result = await client.callTool({ name, arguments: args })
        // trigger({ type: 'TOOL_RESULT', detail: { name, result } })
        
        // For demo, we'll just log
        console.log(`🔧 Tool ${name} called with:`, args)
      },
      
      // Status logging
      STATUS({ message }) {
        console.log(`ℹ️  ${message}`)
      },
      
      CHAT_RESPONSE({ message }) {
        console.log(`💬 Assistant:`, message.content)
      }
    }
  }
})

// Example usage
async function main() {
  console.log('🚀 Starting Intelligent Agent with MCP...\n')
  
  try {
    // Initialize the agent
    const agent = await createIntelligentAgent()
    
    // Simulate a conversation
    const conversations = [
      {
        messages: [
          { role: 'user', content: "What's the weather like in San Francisco?" }
        ]
      },
      {
        messages: [
          { role: 'user', content: "Can you read my README file?" }
        ]
      },
      {
        messages: [
          { role: 'user', content: "Tell me a joke" }
        ]
      }
    ]
    
    for (const conv of conversations) {
      console.log(`\n👤 User: ${conv.messages[0].content}`)
      agent({ type: 'CHAT', detail: conv })
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log('\n✅ Demo complete!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Run if executed directly
if (import.meta.main) {
  main()
}