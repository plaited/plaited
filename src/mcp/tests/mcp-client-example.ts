#!/usr/bin/env bun
/**
 * Example demonstrating MCP client with real inference engine integration
 * 
 * This example shows how to:
 * 1. Use defineMCPClient with inference engines (OpenAI, Anthropic, local)
 * 2. Leverage default threads for automatic agent behavior
 * 3. Extend default behavior with custom handlers
 * 4. Connect to real MCP servers
 */

import { defineMCPClient } from '../define-mcp-client.js'
import type { InferenceEngine, InferenceResponse } from '../mcp.types.js'

/**
 * OpenAI inference engine implementation
 */
class OpenAIEngine implements InferenceEngine {
  private apiKey: string
  private model: string
  
  constructor({ apiKey, model = 'gpt-4' }: { apiKey: string; model?: string }) {
    this.apiKey = apiKey
    this.model = model
  }
  
  async chat(params: {
    messages: Array<{ role: string; content: string }>
    tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>
    temperature?: number
    maxTokens?: number
  }): Promise<InferenceResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: params.messages,
        tools: params.tools?.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema || { type: 'object', properties: {} }
          }
        })),
        temperature: params.temperature,
        max_tokens: params.maxTokens
      })
    })
    
    const data = await response.json()
    const choice = data.choices[0]
    
    return {
      content: choice.message.content,
      toolCalls: choice.message.tool_calls?.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments)
      })),
      finishReason: choice.finish_reason,
      usage: data.usage
    }
  }
}

/**
 * Anthropic Claude inference engine implementation
 */
class AnthropicEngine implements InferenceEngine {
  private apiKey: string
  private model: string
  
  constructor({ apiKey, model = 'claude-3-sonnet-20240229' }: { apiKey: string; model?: string }) {
    this.apiKey = apiKey
    this.model = model
  }
  
  async chat(params: {
    messages: Array<{ role: string; content: string }>
    tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>
    temperature?: number
    maxTokens?: number
    systemPrompt?: string
  }): Promise<InferenceResponse> {
    // Extract system message if present
    const systemMessage = params.messages.find(m => m.role === 'system')
    const otherMessages = params.messages.filter(m => m.role !== 'system')
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        messages: otherMessages,
        system: systemMessage?.content || params.systemPrompt,
        tools: params.tools?.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema || { type: 'object', properties: {} }
        })),
        temperature: params.temperature,
        max_tokens: params.maxTokens || 1024
      })
    })
    
    const data = await response.json()
    
    // Convert Anthropic's response format
    const toolCalls = data.content?.filter((c: { type: string }) => c.type === 'tool_use')?.map((tc: { id: string; name: string; input: unknown }) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.input
    }))
    
    const textContent = data.content?.filter((c: { type: string }) => c.type === 'text')
      ?.map((c: { text: string }) => c.text)
      ?.join('\n')
    
    return {
      content: textContent,
      toolCalls,
      finishReason: data.stop_reason,
      usage: {
        promptTokens: data.usage?.input_tokens,
        completionTokens: data.usage?.output_tokens,
        totalTokens: data.usage?.input_tokens + data.usage?.output_tokens
      }
    }
  }
}

/**
 * Local Ollama inference engine implementation
 */
class OllamaEngine implements InferenceEngine {
  private baseUrl: string
  private model: string
  
  constructor({ baseUrl = 'http://localhost:11434', model = 'llama2' }: { baseUrl?: string; model?: string } = {}) {
    this.baseUrl = baseUrl
    this.model = model
  }
  
  async chat(params: {
    messages: Array<{ role: string; content: string }>
    tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>
    temperature?: number
  }): Promise<InferenceResponse> {
    // Ollama doesn't support function calling natively yet
    // So we'll simulate it by including tools in the prompt
    let systemPrompt = 'You are a helpful assistant.'
    
    if (params.tools && params.tools.length > 0) {
      systemPrompt += '\n\nYou have access to the following tools:\n'
      params.tools.forEach(tool => {
        systemPrompt += `- ${tool.name}: ${tool.description}\n`
      })
      systemPrompt += '\nTo use a tool, respond with: TOOL_CALL: {"name": "tool_name", "arguments": {...}}'
    }
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...params.messages
    ]
    
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: params.temperature,
        stream: false
      })
    })
    
    const data = await response.json()
    
    // Parse tool calls from response
    const toolCallMatch = data.message?.content?.match(/TOOL_CALL: ({.*?})/s)
    let toolCalls
    if (toolCallMatch) {
      try {
        const toolCall = JSON.parse(toolCallMatch[1])
        toolCalls = [{ name: toolCall.name, arguments: toolCall.arguments }]
      } catch (_e) {
        // Invalid JSON, ignore
      }
    }
    
    return {
      content: data.message?.content,
      toolCalls,
      finishReason: 'stop'
    }
  }
}

// Custom events for our advanced example
type CustomAgentEvents = {
  ANALYZE_CODE: { filePath: string }
  CODE_ANALYSIS_COMPLETE: { analysis: string }
  SUMMARIZE_ERRORS: { errors: string[] }
}

/**
 * Example 1: Simple agent with OpenAI and default threads
 */
export const createSimpleAgent = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('⚠️  No OpenAI API key found. Using mock engine.')
    return createMockAgent()
  }
  
  return defineMCPClient({
    name: 'simple-agent',
    version: '1.0.0',
    transport: {
      type: 'stdio',
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
    },
    inferenceEngine: new OpenAIEngine({ apiKey }),
    defaultThreads: true, // All agent behavior handled automatically!
    publicEvents: ['CHAT']
  })
}

/**
 * Example 2: Advanced agent with Anthropic and custom behavior
 */
export const createAdvancedAgent = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('⚠️  No Anthropic API key found. Using mock engine.')
    return createMockAgent()
  }
  
  return defineMCPClient<CustomAgentEvents>({
    name: 'advanced-agent',
    version: '1.0.0',
    transport: {
      type: 'stdio',
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
    },
    inferenceEngine: new AnthropicEngine({ apiKey, model: 'claude-3-opus-20240229' }),
    defaultThreads: true,
    publicEvents: ['CHAT', 'ANALYZE_CODE', 'SUMMARIZE_ERRORS'],
    
    async bProgram({ trigger, bThread, bSync, tools: _tools, inferenceEngine }) {
      // Add custom thread for code analysis
      bThread([
        bSync({
          waitFor: 'ANALYZE_CODE',
          request: { type: 'PERFORM_CODE_ANALYSIS' }
        })
      ], true)
      
      // Add error summarization thread
      bThread([
        bSync({
          waitFor: 'CLIENT_ERROR',
          request: { type: 'COLLECT_ERROR' }
        })
      ], true)
      
      const errorLog: string[] = []
      
      return {
        // Custom code analysis handler
        async PERFORM_CODE_ANALYSIS({ filePath }: CustomAgentEvents['ANALYZE_CODE']) {
          // First, read the file
          trigger({
            type: 'READ_RESOURCE',
            detail: { uri: `file://${filePath}` }
          })
          
          // Wait for result (in real app, use proper event coordination)
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Analyze with LLM
          if (inferenceEngine) {
            const response = await inferenceEngine.chat({
              messages: [
                { role: 'system', content: 'You are a code reviewer. Analyze the code for potential issues, patterns, and improvements.' },
                { role: 'user', content: `Analyze this code: [file content would be here]` }
              ]
            })
            
            trigger({
              type: 'CODE_ANALYSIS_COMPLETE',
              detail: { analysis: response.content || 'No analysis available' }
            })
          }
        },
        
        // Error collection
        COLLECT_ERROR({ error }: { error: Error }) {
          errorLog.push(error.message)
          
          // Summarize every 5 errors
          if (errorLog.length >= 5) {
            trigger({
              type: 'SUMMARIZE_ERRORS',
              detail: { errors: [...errorLog] }
            })
            errorLog.length = 0
          }
        },
        
        // Error summarization
        async SUMMARIZE_ERRORS({ errors }: CustomAgentEvents['SUMMARIZE_ERRORS']) {
          if (inferenceEngine) {
            const response = await inferenceEngine.chat({
              messages: [
                { role: 'system', content: 'Summarize these errors and suggest common fixes.' },
                { role: 'user', content: `Errors:\n${errors.join('\n')}` }
              ]
            })
            
            console.log('📊 Error Summary:', response.content)
          }
        },
        
        // Log custom events
        CODE_ANALYSIS_COMPLETE({ analysis }: CustomAgentEvents['CODE_ANALYSIS_COMPLETE']) {
          console.log('📝 Code Analysis:', analysis)
        }
      }
    }
  })
}

/**
 * Example 3: Local agent with Ollama
 */
export const createLocalAgent = () => {
  return defineMCPClient({
    name: 'local-agent',
    version: '1.0.0',
    transport: {
      type: 'stdio',
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
    },
    inferenceEngine: new OllamaEngine({ model: 'codellama' }),
    defaultThreads: true,
    publicEvents: ['CHAT', 'THINK']
  })
}

/**
 * Mock agent for testing without API keys
 */
function createMockAgent() {
  // Mock implementation that simulates responses
  const mockEngine: InferenceEngine = {
    async chat(params) {
      console.log('🤖 Mock inference with', params.tools?.length || 0, 'tools')
      
      // Simulate tool usage
      if (params.messages.some(m => m.content.includes('file'))) {
        return {
          content: 'I would read the file for you.',
          toolCalls: [{ name: 'read_file', arguments: { path: './README.md' } }]
        }
      }
      
      return {
        content: `Mock response to: "${params.messages[params.messages.length - 1].content}"`
      }
    }
  }
  
  return defineMCPClient({
    name: 'mock-agent',
    version: '1.0.0',
    transport: {
      type: 'stdio',
      command: 'echo',
      args: ['mock']
    },
    inferenceEngine: mockEngine,
    defaultThreads: true,
    publicEvents: ['CHAT']
  })
}

// Demo script
async function main() {
  console.log('🚀 MCP Client with Inference Engines Demo\n')
  
  // Choose which agent to demo
  const agentType = process.argv[2] || 'simple'
  
  let createAgent
  switch (agentType) {
    case 'advanced':
      console.log('Using Advanced Agent with Anthropic...')
      createAgent = createAdvancedAgent()
      break
    case 'local':
      console.log('Using Local Agent with Ollama...')
      createAgent = createLocalAgent()
      break
    default:
      console.log('Using Simple Agent with OpenAI...')
      createAgent = createSimpleAgent()
  }
  
  try {
    const agent = await createAgent
    const trigger = await agent()
    
    // Example conversations
    console.log('\n💬 Starting conversations...\n')
    
    // Conversation 1: File operations
    console.log('👤 User: What files are in the current directory?')
    trigger({
      type: 'CHAT',
      detail: {
        messages: [
          { role: 'user', content: 'What files are in the current directory?' }
        ]
      }
    })
    
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Conversation 2: Code analysis (for advanced agent)
    if (agentType === 'advanced') {
      console.log('\n👤 User: Analyze the code in src/index.ts')
      trigger({
        type: 'ANALYZE_CODE',
        detail: { filePath: 'src/index.ts' }
      })
      
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // Conversation 3: General question
    console.log('\n👤 User: Can you help me write a README file?')
    trigger({
      type: 'CHAT',
      detail: {
        messages: [
          { role: 'user', content: 'Can you help me write a README file?' }
        ]
      }
    })
    
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('\n✅ Demo complete!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Run demo if executed directly
if (import.meta.main) {
  main().catch(console.error)
}