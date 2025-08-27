# MCP (Model Context Protocol) Implementation Plan

## Overview
Complete implementation of MCP client and server functionality in Plaited, leveraging behavioral programming for advanced orchestration patterns. This plan incorporates existing draft features from `src/mcp/README.md` and adds missing MCP specification features.

## Current State
- ✅ Basic `bServer` implementation with tools, prompts, and resources
- ✅ Partial `bClient` implementation (structure only)
- ❌ Missing server capabilities: roots, completion
- ❌ Missing client capabilities: sampling, primitive discovery
- ❌ No behavioral orchestration patterns implemented

## Architecture Goals
1. **Full MCP Compliance**: Support all MCP specification features
2. **Behavioral Integration**: Leverage Plaited's behavioral programming for orchestration
3. **Type Safety**: End-to-end type safety from registration to execution
4. **Developer Experience**: Simple, declarative API with powerful capabilities

## Implementation Phases

### Phase 1: Complete Server Implementation

#### 1.1 Add Missing Server Capabilities

**Roots Support** (`b-server.ts` enhancement):
```typescript
// New in registry types
export type RootsEntry = {
  primitive: 'roots'
  config: {
    roots: Array<{
      uri: string
      name?: string
    }>
  }
}

// Server initialization
const roots = server.registerRoots(config.roots)
```

**Completion Support** (`b-server.ts` enhancement):
```typescript
export type CompletionEntry = {
  primitive: 'completion'
  config: {
    provider: 'resource' | 'prompt'
    handler: (params: CompletionParams) => Promise<CompletionResult>
  }
}

// Register completion providers
const completions = registerCompletions({ server, config, trigger })
```

#### 1.2 Server Enhancement Tasks
- [ ] Add roots registration to `b-server.ts`
- [ ] Implement completion providers for resources and prompts
- [ ] Update `mcp.types.ts` with new entry types
- [ ] Add lifecycle management for new capabilities
- [ ] Create test server demonstrating all capabilities

### Phase 2: Complete Client Implementation

#### 2.1 Core Client Features

**Primitive Discovery** (from README.md):
```typescript
export const createDiscoverySignals = (trigger: PlaitedTrigger) => {
  const prompts = useSignal<PromptList>([])
  const resources = useSignal<ResourceList>([])
  const resourceTemplates = useSignal<ResourceTemplateList>([])
  const tools = useSignal<ToolList>([])
  
  // Set up reactive discovery
  prompts.listen(CLIENT_EVENTS.PROMPTS_DISCOVERED, trigger)
  resources.listen(CLIENT_EVENTS.RESOURCES_DISCOVERED, trigger)
  resourceTemplates.listen(CLIENT_EVENTS.RESOURCE_TEMPLATES_DISCOVERED, trigger)
  tools.listen(CLIENT_EVENTS.TOOLS_DISCOVERED, trigger)
  
  return { tools, resources, prompts, resourceTemplates }
}
```

**Sampling Support** (new client capability):
```typescript
export const requestSampling = async ({
  client,
  messages,
  modelPreferences,
  systemPrompt,
  includeContext,
  temperature,
  maxTokens,
  stopSequences,
  metadata
}: SamplingRequest): Promise<SamplingResult> => {
  // Request LLM generation from client
  return client.sampling.create({
    messages,
    modelPreferences,
    systemPrompt,
    includeContext,
    temperature,
    maxTokens,
    stopSequences,
    metadata
  })
}
```

#### 2.2 Client Implementation Tasks
- [ ] Complete `b-client.ts` with full behavioral integration
- [ ] Implement primitive discovery with aliasing
- [ ] Add sampling request capability
- [ ] Implement transport creation (stdio and HTTP)
- [ ] Add connection lifecycle management
- [ ] Create primitive filtering by context

### Phase 3: Behavioral Orchestration Patterns

#### 3.1 Planning with Behavioral Programming

Replace simplistic planning with behavioral threads:
```typescript
export const createBehavioralPlan = ({
  goal,
  tools,
  resources,
  prompts
}: PlanningContext) => {
  return bThread([
    // Analyze goal
    bSync({ 
      request: { type: 'ANALYZE_GOAL', goal },
      waitFor: 'GOAL_ANALYZED'
    }),
    
    // Generate plan steps
    bSync({
      request: { type: 'GENERATE_STEPS' },
      waitFor: 'STEPS_GENERATED',
      block: 'TOOL_EXECUTION' // Don't execute yet
    }),
    
    // Validate plan
    bSync({
      request: { type: 'VALIDATE_PLAN' },
      waitFor: ['PLAN_VALID', 'PLAN_INVALID']
    }),
    
    // Execute plan steps
    bSync({
      request: { type: 'EXECUTE_PLAN' },
      block: 'PLAN_MODIFICATION' // No changes during execution
    })
  ])
}
```

#### 3.2 Intelligent Tool Selection

Using behavioral patterns for context-aware tool selection:
```typescript
export const toolSelectionThread = bThread([
  // Monitor context changes
  bSync({ 
    waitFor: 'CONTEXT_CHANGED',
    request: { type: 'ANALYZE_CONTEXT' }
  }),
  
  // Score tool relevance
  bSync({
    waitFor: 'CONTEXT_ANALYZED',
    request: { type: 'SCORE_TOOLS' }
  }),
  
  // Filter and rank tools
  bSync({
    waitFor: 'TOOLS_SCORED',
    request: { type: 'FILTER_TOOLS' }
  }),
  
  // Suggest tools to user
  bSync({
    waitFor: 'TOOLS_FILTERED',
    request: { type: 'SUGGEST_TOOLS' }
  })
], true) // Repeat indefinitely
```

#### 3.3 Orchestration Tasks
- [ ] Implement behavioral planning system
- [ ] Create context-aware tool selection
- [ ] Add conversation history management with compaction
- [ ] Implement result formatting for LLM consumption
- [ ] Create coordination patterns between multiple MCP servers

### Phase 4: Advanced Features

#### 4.1 Multi-Server Coordination

```typescript
export const multiServerCoordinator = async ({
  servers,
  goal
}: MultiServerContext) => {
  const { trigger, useFeedback } = behavioral()
  
  // Create threads for each server
  const serverThreads = servers.map(server => 
    bThread([
      bSync({
        request: { type: 'DISCOVER_CAPABILITIES', server },
        waitFor: `CAPABILITIES_${server.id}`
      }),
      bSync({
        request: { type: 'REGISTER_SERVER', server },
        waitFor: `SERVER_READY_${server.id}`
      })
    ])
  )
  
  // Coordination thread
  const coordinator = bThread([
    bSync({
      waitFor: servers.map(s => `SERVER_READY_${s.id}`),
      request: { type: 'ALL_SERVERS_READY' }
    }),
    bSync({
      request: { type: 'DISTRIBUTE_WORK', goal },
      block: 'SERVER_REGISTRATION' // No new servers during work
    })
  ])
  
  return { serverThreads, coordinator }
}
```

#### 4.2 Inference Engine Integration

```typescript
export interface InferenceEngine {
  chat(params: ChatParams): Promise<InferenceResponse>
  embed?(text: string): Promise<number[]>
  streamChat?(params: StreamChatParams): Promise<void>
}

export const createInferenceAdapter = (
  engine: InferenceEngine,
  client: MCPClient
) => {
  return {
    async process(messages: Message[]): Promise<Response> {
      // Get available tools from MCP
      const tools = await client.listTools()
      
      // Chat with tool support
      const response = await engine.chat({
        messages,
        tools: tools.map(formatToolForLLM),
        temperature: 0.7,
        maxTokens: 2000
      })
      
      // Execute tool calls
      if (response.toolCalls) {
        for (const call of response.toolCalls) {
          const result = await client.callTool(call.name, call.arguments)
          messages.push(formatToolResult(result))
        }
        
        // Continue conversation with tool results
        return this.process(messages)
      }
      
      return response
    }
  }
}
```

#### 4.3 Advanced Tasks
- [ ] Multi-server coordination patterns
- [ ] Inference engine adapters (OpenAI, Anthropic, local)
- [ ] Streaming response support
- [ ] Progress reporting for long operations
- [ ] Caching and memoization strategies

## Type System Enhancements

### Enhanced Event Types
```typescript
// Client events
export type MCPClientEventDetails = {
  // Discovery
  TOOLS_DISCOVERED: { tools: Tool[] }
  RESOURCES_DISCOVERED: { resources: Resource[] }
  PROMPTS_DISCOVERED: { prompts: Prompt[] }
  
  // Operations
  CALL_TOOL: CallToolDetail
  READ_RESOURCE: ReadResourceDetail
  GET_PROMPT: GetPromptDetail
  REQUEST_SAMPLING: SamplingDetail
  
  // Results
  TOOL_RESULT: { name: string; result: CallToolResult }
  RESOURCE_RESULT: { uri: string; result: ReadResourceResult }
  PROMPT_RESULT: { name: string; result: GetPromptResult }
  SAMPLING_RESULT: { result: SamplingResult }
  
  // Lifecycle
  CLIENT_CONNECTED: { capabilities: ClientCapabilities }
  CLIENT_DISCONNECTED: { reason?: string }
  CLIENT_ERROR: { error: Error; operation?: string }
}

// Agent events for orchestration
export type AgentEventDetails = {
  CHAT: { messages: Message[]; temperature?: number }
  THINK: { prompt: string; context?: unknown }
  PLAN: { goal: string; constraints?: string[] }
  EXECUTE_PLAN: { steps: PlanStep[] }
  LEARN: { experience: unknown; outcome: 'success' | 'failure' }
  
  AGENT_STATE_CHANGED: { state: AgentState }
  AGENT_CAPABILITY_ADDED: { capability: string; description?: string }
}
```

## Testing Strategy

### Unit Tests
- Test each primitive registration independently
- Mock MCP SDK for isolation
- Test behavioral patterns in isolation

### Integration Tests
- Test full client-server communication
- Test multi-server coordination
- Test inference engine integration

### End-to-End Tests
- Complete workflow tests
- Performance benchmarks
- Error recovery scenarios

## Migration Path

### For Existing Users
1. Current `bServer` implementations continue working
2. New features are opt-in via registry configuration
3. Gradual migration guide provided

### Breaking Changes
- None planned - all changes are additive
- Deprecation warnings for future removals

## Success Metrics

### Functional
- [ ] 100% MCP specification compliance
- [ ] All behavioral patterns implemented
- [ ] Full type safety maintained
- [ ] Zero breaking changes

### Performance
- [ ] < 10ms primitive registration overhead
- [ ] < 50ms discovery latency
- [ ] Efficient memory usage with large registries
- [ ] Streaming support for large responses

### Developer Experience
- [ ] Clear, comprehensive documentation
- [ ] Rich examples for all features
- [ ] Helpful error messages
- [ ] IDE autocomplete support

## Timeline

### Week 1-2: Server Enhancements
- Add roots and completion support
- Update type system
- Create comprehensive tests

### Week 3-4: Client Implementation
- Complete bClient with discovery
- Add sampling support
- Implement transports

### Week 5-6: Behavioral Patterns
- Planning system
- Tool selection
- Multi-server coordination

### Week 7-8: Polish and Documentation
- Performance optimization
- Documentation
- Examples and tutorials
- Migration guide

## References
- [MCP Specification](https://modelcontextprotocol.io/specification)
- `src/mcp/README.md` - Original client feature plans
- `src/behavioral/` - Behavioral programming patterns
- `src/mcp/b-server.ts` - Current server implementation
- `src/mcp/b-client.ts` - Current client stub