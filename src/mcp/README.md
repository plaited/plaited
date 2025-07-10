# Client features to build

## Discovering primitives
Will require us to list them and then alias them to avoid conflicting namespaces

### Example
This is simplified version and I honestly think I'd should probably move into handlers in bClient

```ts
export const createDiscoverySignals = (trigger: PlaitedTrigger) => {
  const prompts = useSignal<Awaited<ReturnType<Client['listPrompts']>>['prompts']>([])
  const resources = useSignal<Awaited<ReturnType<Client['listResources']>>['resources']>([])
  const resourceTemplates = useSignal<Awaited<ReturnType<Client['listResourceTemplates']>>['resourceTemplates']>([])
  const tools = useSignal<Awaited<ReturnType<Client['listTools']>>['tools']>([])

  // Set up discovery listeners
  prompts.listen(CLIENT_EVENTS.PROMPTS_DISCOVERED, trigger)
  resources.listen(CLIENT_EVENTS.RESOURCES_DISCOVERED, trigger)
  resourceTemplates.listen(CLIENT_EVENTS.RESOURCE_TEMPLATES_DISCOVERED, trigger)
  tools.listen(CLIENT_EVENTS.TOOLS_DISCOVERED, trigger)

  return { tools, resources, prompts, resourceTemplates }
}

export const discoverPrimitives = async ({
  client,
  trigger,
  prompts,
  resources,
  resourceTemplates,
  tools,
}: {
  client: Client
  trigger: PlaitedTrigger
  prompts: SignalWithInitialValue<Awaited<ReturnType<Client['listPrompts']>>['prompts']>
  resources: SignalWithInitialValue<Awaited<ReturnType<Client['listResources']>>['resources']>
  resourceTemplates: SignalWithInitialValue<Awaited<ReturnType<Client['listResourceTemplates']>>['resourceTemplates']>
  tools: SignalWithInitialValue<Awaited<ReturnType<Client['listTools']>>['tools']>
}) => {
  try {
    // Discover all primitives in parallel
    const [promptsResult, resourcesResult, resourceTemplatesResult, toolsResult, ,] = await Promise.allSettled([
      client.listPrompts(),
      client.listResources(),
      client.listResourceTemplates(),
      client.listTools(),
    ])

    promptsResult.status === 'fulfilled' ?
      prompts.set(promptsResult.value.prompts)
    : trigger({ type: CLIENT_ERROR_EVENTS.ERROR_LIST_PROMPTS, detail: promptsResult.reason })
    resourcesResult.status === 'fulfilled' ?
      resources.set(resourcesResult.value.resources)
    : trigger({
        type: CLIENT_ERROR_EVENTS.ERROR_LIST_RESOURCES,
        detail: resourcesResult.reason,
      })
    resourceTemplatesResult.status === 'fulfilled' ?
      resourceTemplates.set(resourceTemplatesResult.value.resourceTemplates)
    : trigger({
        type: CLIENT_ERROR_EVENTS.ERROR_LIST_RESOURCE_TEMPLATES,
        detail: resourceTemplatesResult.reason,
      })

    toolsResult.status === 'fulfilled' ?
      tools.set(toolsResult.value.tools)
    : trigger({
        type: CLIENT_ERROR_EVENTS.ERROR_LIST_TOOLS,
        detail: toolsResult.reason,
      })
  } catch (error) {
    trigger({
      type: CLIENT_ERROR_EVENTS.ERROR_DISCOVER_PRIMITIVES,
      detail: error instanceof Error ? error : new Error(`${error}`),
    })
  }
}
```

## Filtering primitives by context
Will definitetly need this for tools bay may need it for other primitives

### Example
Simple implementation filters tools based on conversation context and user intent. Uses simple keyword matching - can be enhanced with embeddings. AM considering using mediaPipe for this instead.

```ts
export const filterToolsByContext = (tools: Awaited<ReturnType<Client['listTools']>>['tools'], context: string) => {
  const contextLower = context.toLowerCase()

  // Define relevance scoring based on keywords
  const scoreRelevance = (tool: (typeof tools)[0]): number => {
    let score = 0
    const toolInfo = `${tool.name} ${tool.description || ''}`.toLowerCase()

    // Direct name match
    if (contextLower.includes(tool.name.toLowerCase())) {
      score += 10
    }

    // Keyword matching
    const keywords = contextLower.split(/\s+/)
    keywords.forEach((keyword) => {
      if (keyword.length > 3 && toolInfo.includes(keyword)) {
        score += 2
      }
    })

    // Description relevance
    if (tool.description) {
      const descWords = tool.description.toLowerCase().split(/\s+/)
      const contextWords = new Set(keywords)
      const overlap = descWords.filter((word) => contextWords.has(word)).length
      score += overlap
    }

    return score
  }

  // Score and sort tools
  const scoredTools = tools.map((tool) => ({
    tool,
    score: scoreRelevance(tool),
  }))

  // Return tools with score > 0, sorted by relevance
  return scoredTools
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ tool }) => tool)
}
```


## Formatting Primitive calls

### Example
This is one for tools Not sure about this.

```ts
// /**
//  * @internal
//  * Formats tool results for LLM consumption.
//  * Converts MCP tool results into readable text for the inference engine.
//  *
//  * @param toolName Name of the tool that was called
//  * @param result Result from the tool execution
//  * @returns Formatted string for LLM context
//  */
export const formatToolResult = (toolName: string, result: CallToolResult): string => {
  let formatted = `Tool "${toolName}" result:\n`

  if (result.content) {
    result.content.forEach((content, index) => {
      if (content.type === 'text') {
        formatted += content.text
        if (index < result.content!.length - 1) {
          formatted += '\n'
        }
      }
    })
  }

  if (result.isProgress) {
    formatted += '\n[In Progress...]'
  }

  return formatted
}
```


## Planning

### Example
This is not what we want I think this is where behavioral will make a difference
```ts
xport const createToolPlan = (
  tools: Awaited<ReturnType<Client['listTools']>>['tools'],
  goal: string,
): Array<{ tool: string; description: string; arguments?: unknown }> => {
  // This is a simplified planner - in practice, use LLM for planning
  const plan: Array<{ tool: string; description: string; arguments?: unknown }> = []

  // Example: If goal mentions "file", plan file operations
  if (goal.toLowerCase().includes('file')) {
    const readTool = tools.find((t) => t.name.includes('read'))
    if (readTool) {
      plan.push({
        tool: readTool.name,
        description: 'Read file contents',
        arguments: {}, // Would be populated by LLM
      })
    }
  }

  return plan
}
```


## Comapcting

## Example
Simple and can probably be done hella better
```ts
// /**
//  * @internal
//  * Manages conversation history with token limits.
//  * Ensures conversation doesn't exceed LLM context window.
//  *
//  * @param messages Current message history
//  * @param maxTokens Approximate max tokens (rough estimate: 1 token ≈ 4 chars)
//  * @returns Trimmed message history
//  */
export const trimConversationHistory = (
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 4000,
): typeof messages => {
  // Rough token estimation
  const estimateTokens = (text: string): number => Math.ceil(text.length / 4)

  const totalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0)

  if (totalTokens <= maxTokens) {
    return messages
  }

  // Keep system messages and recent messages
  const systemMessages = messages.filter((m) => m.role === 'system')
  const otherMessages = messages.filter((m) => m.role !== 'system')

  // Start with system messages
  const trimmed = [...systemMessages]
  let currentTokens = systemMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0)

  // Add recent messages until we hit the limit
  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const msg = otherMessages[i]
    const msgTokens = estimateTokens(msg.content)

    if (currentTokens + msgTokens <= maxTokens) {
      trimmed.splice(systemMessages.length, 0, msg)
      currentTokens += msgTokens
    } else {
      break
    }
  }

  return trimmed
}
```


## Types

Potential types for client and agent

```ts
/**
 * @internal
 * Event detail for tool execution requests.
 * Includes tool name and typed arguments.
 */
export type CallToolDetail = {
  name: string
  arguments: unknown
}

/**
 * @internal
 * Event detail for resource read requests.
 * Includes resource URI for fetching.
 */
export type ReadResourceDetail = {
  uri: string
}

/**
 * @internal
 * Event detail for prompt completion requests.
 * Includes prompt name and typed arguments.
 */
export type GetPromptDetail = {
  name: string
  arguments: unknown
}

/**
 * @internal
 * Inference engine interface for AI model integration.
 * Provides a standard interface for different LLM providers.
 */
export interface InferenceEngine {
  /**
   * Generate a chat completion with optional tool calling.
   * @param params Chat parameters including messages and available tools
   * @returns Promise resolving to the model's response
   */
  chat(params: {
    messages: Array<{ role: string; content: string }>
    tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>
    temperature?: number
    maxTokens?: number
    systemPrompt?: string
  }): Promise<InferenceResponse>

  /**
   * Optional: Get embedding for text
   */
  embed?(text: string): Promise<number[]>

  /**
   * Optional: Stream chat completion
   */
  streamChat?(params: {
    messages: Array<{ role: string; content: string }>
    tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>
    onChunk: (chunk: InferenceStreamChunk) => void
  }): Promise<void>
}

/**
 * @internal
 * Response from an inference engine.
 */
export interface InferenceResponse {
  content?: string
  toolCalls?: Array<{
    id?: string
    name: string
    arguments: unknown
  }>
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error'
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

/**
 * @internal
 * Chunk for streaming responses.
 */
export interface InferenceStreamChunk {
  content?: string
  toolCall?: {
    id?: string
    name?: string
    arguments?: string // Partial JSON string
  }
  finishReason?: string
}

/**
 * @internal
 * Built-in agent event types for intelligent behavior.
 * These events enable agent orchestration patterns.
 */
export type AgentEventDetails = {
  // High-level agent operations
  CHAT: { messages: Array<{ role: string; content: string }>; temperature?: number }
  THINK: { prompt: string; context?: unknown }
  PLAN: { goal: string; constraints?: string[] }
  EXECUTE_PLAN: { steps: Array<{ tool: string; arguments: unknown; description?: string }> }
  LEARN: { experience: unknown; outcome?: 'success' | 'failure' }

  // Agent state
  AGENT_STATE_CHANGED: { state: 'idle' | 'thinking' | 'executing' | 'error' }
  AGENT_CAPABILITY_ADDED: { capability: string; description?: string }
}

/**
 * @internal
 * Client event details for MCP operations.
 * Maps event types to their detail payloads.
 */
export type MCPClientEventDetails = {
  // Discovery events
  TOOLS_DISCOVERED: { tools: Array<{ name: string; description?: string; inputSchema?: unknown }> }
  RESOURCES_DISCOVERED: { resources: Array<{ uri: string; name?: string; description?: string; mimeType?: string }> }
  PROMPTS_DISCOVERED: { prompts: Array<{ name: string; description?: string; argsSchema?: unknown }> }

  // Operation events
  CALL_TOOL: CallToolDetail
  READ_RESOURCE: ReadResourceDetail
  GET_PROMPT: GetPromptDetail

  // Result events
  TOOL_RESULT: { name: string; result: CallToolResult }
  RESOURCE_RESULT: { uri: string; result: ReadResourceResult }
  PROMPT_RESULT: { name: string; result: GetPromptResult }

  // Lifecycle events
  CLIENT_CONNECTED: { capabilities: unknown }
  CLIENT_DISCONNECTED: { reason?: string }
  CLIENT_ERROR: { error: Error; operation?: string }
}
```
