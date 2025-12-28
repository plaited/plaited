---
name: agent-generator
description: Generate AI agents using Claude Agent SDK and Plaited workshop infrastructure. Create MCP servers with custom tools, orchestrate agent workflows, and enable bidirectional client communication. Automatically invoked when creating agents for Plaited development.
---

# Agent Generator Skill

## Purpose

This skill provides patterns and utilities for building AI agents that work with Plaited projects using the Claude Agent SDK. Use this when:
- Creating MCP servers with workshop tools for Plaited development
- Building agent workflows with event-driven orchestration
- Implementing bidirectional communication between agents and clients
- Integrating agents with the workshop dev server
- Generating custom tools for specific Plaited workflows

## Core Infrastructure

### Workshop MCP Server

Create an MCP server with built-in workshop tools:

```typescript
import { createWorkshopMcpServer } from 'plaited/workshop'
import { query } from '@anthropic-ai/claude-agent-sdk'

// Create server with built-in tools
const workshopServer = createWorkshopMcpServer({
  name: 'plaited-workshop',  // Optional, defaults to 'plaited-workshop'
  version: '1.0.0',           // Optional, defaults to '1.0.0'
  additionalTools: []         // Optional custom tools
})

// Use with Agent SDK
const result = await query({
  prompt: 'Discover all stories in src/main and generate preview URLs',
  options: {
    mcpServers: {
      workshop: workshopServer
    }
  }
})
```

**Built-in tools:**
- `discover_stories` - Find all story files in specified paths
- `discover_behavioral_elements` - Find all bElement exports
- `get_story_url` - Generate preview URLs for stories

### Agent Orchestrator

Event-driven coordination for agent workflows:

```typescript
import { createAgentOrchestrator, AGENT_ORCHESTRATOR_EVENTS } from 'plaited/workshop'
import { collectStories, discoverBehavioralTemplateMetadata, getStoryUrl } from 'plaited/workshop'

const orchestrator = createAgentOrchestrator({
  // Story discovery workflow
  onDiscoverStories: async ({ cwd, paths }) => {
    const stories = await collectStories(cwd, paths)
    return Array.from(stories.values())
  },

  // Element discovery workflow
  onDiscoverElements: async ({ cwd }) => {
    return await discoverBehavioralTemplateMetadata(cwd)
  },

  // URL generation workflow
  onGetStoryUrl: async (params) => {
    return getStoryUrl(params)
  },

  // Client messaging (WebSocket)
  onSendToClient: (message) => {
    // Broadcast to all connected clients
    server.sendToClient(JSON.stringify(message))
  }
})

// Execute workflow
const stories = await orchestrator.execute({
  type: AGENT_ORCHESTRATOR_EVENTS.discover_stories_request,
  detail: { cwd: process.cwd(), paths: ['src/'] }
})
```

## Adding Custom Tools

### Via MCP Server

```typescript
import { createWorkshopMcpServer } from 'plaited/workshop'
import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

// Define custom tool
const analyzeStoryCoverage = tool(
  'analyze_story_coverage',
  'Analyze test coverage by comparing stories to source files',
  {
    cwd: z.string().describe('Project root directory'),
    sourcePath: z.string().describe('Path to source files')
  },
  async ({ cwd, sourcePath }) => {
    // Implementation
    const coverage = await calculateCoverage(cwd, sourcePath)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(coverage, null, 2)
      }]
    }
  }
)

// Add to workshop server
const server = createWorkshopMcpServer({
  additionalTools: [analyzeStoryCoverage]
})
```

### Tool Definition Pattern

Tools follow the Claude Agent SDK pattern:

```typescript
tool(
  name: string,              // Tool identifier (snake_case)
  description: string,       // What the tool does
  schema: ZodSchema,         // Zod schema for parameters
  handler: async (params) => CallToolResult
)
```

**Schema with Zod:**
- `z.string()` - String parameter
- `z.number()` - Number parameter
- `z.boolean()` - Boolean parameter
- `z.array(z.string())` - Array of strings
- `z.object({...})` - Nested object
- `.optional()` - Optional parameter
- `.describe('...')` - Parameter description for AI

**Return type (CallToolResult):**
```typescript
{
  content: [{
    type: 'text',
    text: string  // JSON.stringify for structured data
  }]
}
```

## WebSocket Communication

### Server Setup

Integrate with workshop dev server for bidirectional communication:

```typescript
import { getServer } from 'plaited/workshop'

const { server, sendToClient } = await getServer({
  cwd: process.cwd(),
  port: 3000,
  paths: ['src/'],
  colorScheme: 'dark',
  trigger: (event) => {
    // Handle events from client
    console.log('Received event:', event)
  }
})

// Send message to all connected clients
sendToClient(JSON.stringify({
  type: 'agent_message',
  detail: {
    content: 'Analysis complete',
    timestamp: Date.now(),
    agentId: 'coverage-analyzer'
  }
}))
```

### Client-Side Handling

Messages are automatically handled by `useWebSocket()` in story fixtures:

```typescript
// Client automatically:
// 1. Parses and validates agent messages
// 2. Logs to browser console: [Agent {id}] {time}: {content}
// 3. Dispatches custom event for UI components

// Listen in UI components:
window.addEventListener('agent_message', (event) => {
  const { content, agentId, timestamp } = event.detail
  // Update UI with agent message
})
```

### Message Schema

```typescript
type AgentMessage = {
  type: 'agent_message'
  detail: {
    content: string      // Message content
    timestamp: number    // Unix timestamp
    agentId?: string    // Optional agent identifier
  }
}
```

## Orchestrator Events

The orchestrator coordinates workflows through events:

```typescript
AGENT_ORCHESTRATOR_EVENTS = {
  // Story discovery
  discover_stories_request: 'discover_stories_request',
  discover_stories_response: 'discover_stories_response',

  // Element discovery
  discover_elements_request: 'discover_elements_request',
  discover_elements_response: 'discover_elements_response',

  // URL generation
  get_story_url_request: 'get_story_url_request',
  get_story_url_response: 'get_story_url_response',

  // Client messaging
  send_to_client: 'send_to_client',

  // Workflow control
  workflow_complete: 'workflow_complete'
}
```

## Complete Agent Example

### Story Coverage Analyzer Agent

```typescript
import { createWorkshopMcpServer, createAgentOrchestrator } from 'plaited/workshop'
import { collectStories, discoverBehavioralTemplateMetadata } from 'plaited/workshop'
import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

// Custom tool for coverage analysis
const analyzeCoverage = tool(
  'analyze_coverage',
  'Analyze test coverage by comparing stories to behavioral elements',
  {
    cwd: z.string().describe('Project root directory')
  },
  async ({ cwd }) => {
    const [stories, elements] = await Promise.all([
      collectStories(cwd, ['src/']),
      discoverBehavioralTemplateMetadata(cwd)
    ])

    const coverage = {
      totalElements: elements.length,
      totalStories: stories.size,
      uncoveredElements: elements.filter(el =>
        !Array.from(stories.values()).some(s =>
          s.filePath.replace('.stories.tsx', '.tsx') === el.filePath
        )
      )
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(coverage, null, 2)
      }]
    }
  }
)

// Create MCP server with workshop + custom tools
const server = createWorkshopMcpServer({
  name: 'coverage-analyzer',
  version: '1.0.0',
  additionalTools: [analyzeCoverage]
})

// Create orchestrator for workflow coordination
const orchestrator = createAgentOrchestrator({
  onDiscoverStories: async ({ cwd, paths }) => {
    const stories = await collectStories(cwd, paths)
    return Array.from(stories.values())
  },
  onDiscoverElements: async ({ cwd }) => {
    return await discoverBehavioralTemplateMetadata(cwd)
  },
  onSendToClient: (message) => {
    console.log('[Agent]', message.detail.content)
  }
})

export { server, orchestrator }
```

## Agent Patterns

### Discovery Agent

Specialized in exploring codebase structure:

```typescript
const discoveryAgent = createWorkshopMcpServer({
  name: 'plaited-discovery',
  // Uses built-in discovery tools
})

// Agent can discover:
// - All stories in project
// - All behavioral elements
// - Generate preview URLs
// - Map relationships between stories and elements
```

### Testing Agent

Specialized in test execution and reporting:

```typescript
const testingAgent = createWorkshopMcpServer({
  name: 'plaited-testing',
  additionalTools: [
    runTestsTool,
    generateReportTool,
    captureScreenshotsTool
  ]
})

// Orchestrate test workflow
const orchestrator = createAgentOrchestrator({
  onDiscoverStories: async ({ cwd, paths }) => {
    const stories = await collectStories(cwd, paths)
    return Array.from(stories.values()).filter(s => s.hasPlay)
  },
  onSendToClient: (message) => {
    // Send test progress to UI
    server.sendToClient(JSON.stringify(message))
  }
})
```

### Code Generation Agent

Specialized in generating Plaited code:

```typescript
const codeGenAgent = createWorkshopMcpServer({
  name: 'plaited-codegen',
  additionalTools: [
    generateBElementTool,
    generateStoryTool,
    generateStylesTool
  ]
})

// Use plaited-patterns skill for accurate code generation
// Use LSP verification for type checking
```

## Best Practices

### Tool Naming

```typescript
// ✅ Good - descriptive snake_case
tool('discover_behavioral_elements', ...)
tool('analyze_story_coverage', ...)
tool('generate_preview_url', ...)

// ❌ Bad - vague or inconsistent
tool('discover', ...)
tool('analyzeStoryCoverage', ...)  // camelCase
tool('get-url', ...)               // kebab-case
```

### Error Handling

```typescript
const myTool = tool(
  'my_tool',
  'Description',
  schema,
  async (params) => {
    try {
      const result = await doWork(params)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            type: 'tool_execution_error'
          }, null, 2)
        }],
        isError: true
      }
    }
  }
)
```

### Orchestrator Usage

```typescript
// ✅ Good - execute returns Promise
const result = await orchestrator.execute({
  type: AGENT_ORCHESTRATOR_EVENTS.discover_stories_request,
  detail: { cwd, paths }
})

// ❌ Bad - forgetting await
const result = orchestrator.execute({ ... })  // Returns Promise!
```

### Message Formatting

```typescript
// ✅ Good - structured agent messages
onSendToClient: (message) => {
  server.sendToClient(JSON.stringify({
    type: 'agent_message',
    detail: {
      content: 'Clear, actionable message',
      timestamp: Date.now(),
      agentId: 'my-agent'
    }
  }))
}

// ❌ Bad - raw strings
onSendToClient: (message) => {
  server.sendToClient('some message')  // Not validated
}
```

## Integration with Agent SDK

### Using query() Function

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'

const result = await query({
  prompt: 'Discover all stories in src/components and analyze their coverage',
  options: {
    mcpServers: {
      workshop: workshopServer
    }
  }
})

console.log(result.text)
```

### Multiple MCP Servers

```typescript
const result = await query({
  prompt: 'Generate a new button component with stories',
  options: {
    mcpServers: {
      workshop: workshopServer,
      codegen: codegenServer,
      filesystem: filesystemServer
    }
  }
})
```

## Related Skills

- **code-query** - Discovering and querying Plaited codebase
- **plaited-patterns** - Generating accurate Plaited code
- **code-documentation** - Writing TSDoc for agents and tools

## File Locations

**Agent infrastructure:**
- `src/workshop/create-workshop-agent.ts` - MCP server creation
- `src/workshop/agent-orchestrator.ts` - Event-driven orchestration
- `src/workshop/get-server.ts` - Dev server with WebSocket support
- `src/testing/use-web-socket.ts` - Client-side WebSocket handling

**Type definitions:**
- `src/testing/testing.schemas.ts` - AgentMessage schema
- `src/testing/testing.constants.ts` - AGENT_EVENTS constants
- `src/workshop/agent-orchestrator.ts` - AGENT_ORCHESTRATOR_EVENTS

**Examples:**
- Custom tools: See `src/workshop/collect-stories.ts` for discoverStoriesTool pattern
- MCP server: See `src/workshop/create-workshop-agent.ts` for implementation
- Orchestrator: See `src/workshop/tests/agent-orchestrator.spec.ts` for usage examples
