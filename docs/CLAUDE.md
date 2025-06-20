# Claude Development Context

This file contains important development context and patterns for working with the Plaited framework, particularly around MCP (Model Context Protocol) integration and behavioral programming principles.

## MCP Integration Implementation

### Overview
Successfully implemented MCP integration for the Plaited workshop using pure behavioral programming principles. The integration exposes workshop functionality as MCP tools while preserving all existing functionality.

### Architecture
- **Signal-Driven Coordination**: MCP requests coordinated through reactive signals with manual response generation (preventing infinite loops)
- **Behavioral Event Routing**: No conditionals - events route directly using existing `LOG_EVENT` pattern
- **B-Thread Orchestration**: Each MCP tool has its own coordinator b-thread for clean separation
- **Promise Management**: Centralized promise handling with timeout support (30 seconds)
- **Server Cleanup**: Proper server lifecycle management with disconnect callbacks

### Key Files Created
```
src/workshop/mcp/
├── mcp.constants.ts          # MCP event constants (MCP_EVENTS, MCP_TOOL_EVENTS)
├── mcp.types.ts              # Zod schemas and TypeScript types
├── mcp-server.ts             # MCP server implementation using @modelcontextprotocol/sdk
├── mcp-promise-manager.ts    # Promise coordination utilities
├── zod-to-json-schema.ts     # Schema conversion utility for MCP protocol
├── index.ts                  # Public exports
└── tests/                    # Comprehensive test suite
    ├── mcp-unit.spec.ts      # Fast unit tests (schemas, promise manager)
    ├── mcp-simple.spec.ts    # Basic validation tests
    ├── mcp-basic.spec.ts     # Import and functionality verification
    └── mcp-integration.spec.ts # Full workshop integration tests

scripts/
└── mcp-server.ts             # Server startup script
```

### Behavioral Programming Patterns Used

#### 1. Event Routing (Like LOG_EVENT Pattern)
```ts
// Route MCP tool calls to specific events without conditionals
async [MCP_EVENTS.MCP_TOOL_CALL]({ toolName, params, requestId }) {
  const toolEventMap: Record<string, string> = {
    'list_routes': MCP_TOOL_EVENTS.MCP_LIST_ROUTES,
    'test_all_stories': MCP_TOOL_EVENTS.MCP_TEST_ALL_STORIES,
    'test_story_set': MCP_TOOL_EVENTS.MCP_TEST_STORY_SET,
  }
  trigger({ type: toolEventMap[toolName], detail: { params, requestId } })
}
```

#### 2. Reusable Handler Functions (Like handleFailure Pattern)
```ts
// Reusable MCP request handler similar to handleFailure in testing
const handleMCPRequest = async (toolName: keyof typeof schemas, params: unknown, requestId: string) => {
  try {
    const validatedParams = schemas[toolName]?.parse(params) ?? params
    // Add to pending requests and manage coordination
  } catch (error) {
    // Handle validation errors through event system
  }
}
```

#### 3. B-Thread Coordination
```ts
// B-threads coordinate MCP requests with existing workshop behaviors
bThreads.set({
  mcpListRoutesCoordinator: bThread([
    bSync({ waitFor: (event) => event.type === MCP_TOOL_EVENTS.MCP_LIST_ROUTES }),
    bSync({ request: { type: PUBLIC_EVENTS.LIST_ROUTES } })
  ], true)
})
```

#### 4. Signal-Driven Automatic Responses
```ts
// Computed signal automatically matches data with pending requests
const mcpResponseSignal = useComputed(() => {
  const routes = routesDataSignal.get()
  const pending = pendingMCPRequestsSignal.get()
  // Match available data with pending requests
  return responses
}, [routesDataSignal, pendingMCPRequestsSignal])

// Automatic response triggering
mcpResponseSignal.listen(MCP_EVENTS.MCP_RESPONSE, trigger)
```

### Design Principles Followed

#### 1. Additive Behavior (Core BP Principle)
- **No modification of existing code** - MCP integration added without changing core workshop logic
- **New coordinating behaviors** - B-threads coordinate between MCP and existing events
- **Signal population** - Existing handlers enhanced to populate data signals while preserving original behavior

#### 2. No Conditionals in Handlers
- **Event routing** - Direct event triggering based on event type like `LOG_EVENT` pattern
- **B-thread coordination** - Logic expressed through behavioral threads, not if/else statements
- **Reusable functions** - Shared logic extracted to functions like `handleMCPRequest`

#### 3. Signal-Based Coordination
- **Automatic responses** - Computed signals detect when data is available for pending requests
- **Reactive updates** - Signal changes automatically trigger appropriate events
- **Cleanup management** - Signals track and clean up completed requests

### Testing Strategy

#### Fast Unit Tests (Recommended for Development)
```bash
bun test src/workshop/mcp/tests/mcp-unit.spec.ts src/workshop/mcp/tests/mcp-simple.spec.ts src/workshop/mcp/tests/mcp-basic.spec.ts
```

#### Full Integration Tests
```bash
bun test src/workshop/mcp/tests/
```

#### Verify Original Functionality
```bash
bun run scripts/runner.ts
```

### Server Configuration

#### Dynamic Port Assignment
Modified `use-server.ts` to use `port: 0` for automatic port assignment, eliminating port conflicts during testing:

```ts
const server = Bun.serve({
  port: 0, // Let system assign available port
  routes: await getRoutes(),
  // ... rest of configuration
})
```

### Available MCP Tools

1. **`list_routes`** - List available story routes with optional filtering
2. **`test_all_stories`** - Run tests for all stories with configurable options
3. **`test_story_set`** - Run tests for specific route sets

### Usage Examples

#### Start MCP Server
```bash
bun run scripts/mcp-server.ts
```

#### Tool Schemas (Zod + JSON Schema)
```ts
const ListRoutesSchema = z.object({
  filter: z.string().optional(),
  includeTests: z.boolean().default(true)
})
```

### Key Learnings

#### 1. Behavioral Programming Excellence
- **Pure coordination** - No switch statements or conditionals in event handling
- **Signal-driven automation** - Computed signals handle complex coordination automatically
- **B-thread orchestration** - Each concern gets its own coordinator thread

#### 2. Testing in Behavioral Systems
- **Dynamic ports** - Use `port: 0` to avoid conflicts when testing multiple server instances
- **Unit vs Integration** - Separate fast unit tests from slower integration tests
- **Mock-free testing** - Server instances naturally get different ports, no mocking needed

#### 3. TypeScript Integration
- **Zod for validation** - Runtime validation with compile-time types
- **Signal dependencies** - useComputed requires dependency array as second parameter
- **Type safety** - Maintain strict typing throughout the behavioral event system

### Commands for Future Development

#### Development Workflow
```bash
# Type checking
bun run check

# Fast tests during development
bun test src/workshop/mcp/tests/mcp-unit.spec.ts src/workshop/mcp/tests/mcp-simple.spec.ts src/workshop/mcp/tests/mcp-basic.spec.ts

# Verify original functionality
bun run scripts/runner.ts

# Full MCP integration test (slower)
bun test src/workshop/mcp/tests/mcp-integration.spec.ts
```

#### MCP Server Operations
```bash
# Start MCP server
bun run scripts/mcp-server.ts

# Test MCP server creation programmatically
node -e "import('./src/workshop/mcp/mcp-server.js').then(m => m.createMCPWorkshopServer({cwd: process.cwd() + '/src'}).then(() => console.log('✓ MCP server created')))"
```

### Integration Points

#### With defineWorkshop
- Extended `publicEvents` to include MCP events
- Added MCP coordination signals and computed responses
- Preserved all existing handler behavior
- Added b-thread coordinators for each MCP tool

#### With @modelcontextprotocol/sdk
- Clean separation: SDK handles protocol, behavioral program handles logic
- Promise-based bridge between MCP requests and behavioral events
- Automatic timeout handling (30 seconds)

#### With Zod v4
- Schema validation for all tool parameters
- JSON Schema generation for MCP tool definitions
- Type-safe parameter handling throughout

### Future Considerations

#### Extending MCP Tools
To add new MCP tools:
1. Add tool name to `MCP_TOOL_EVENTS` constants
2. Create Zod schema in `mcp.types.ts`
3. Add b-thread coordinator in `defineWorkshop`
4. Add tool handler that calls `handleMCPRequest`
5. Update MCP server tool definitions

#### Performance Optimization
- Signal-driven responses are efficient but could be optimized for high-volume scenarios
- B-thread coordination scales well with additional tools
- Promise cleanup happens automatically via timeout and response handling

#### Error Handling
- Zod validation errors are captured and returned as MCP tool errors
- Promise timeouts prevent hanging requests
- B-thread interruption patterns could be added for cancellation

This implementation serves as a reference for proper behavioral programming patterns and successful integration of external protocols while maintaining the core principles of the Plaited framework.