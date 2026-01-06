# Tool API Reference

Complete reference for the world agent tool system.

## Core Concepts

### Tool Registry

The tool registry manages tool registration and execution:

```typescript
import { createToolRegistry } from 'plaited/agent'

const registry = createToolRegistry()

// Register tools
registry.register(name, handler, schema)

// Execute function calls
const result = await registry.execute(functionCall)

// Get schemas for model context
const schemas = registry.schemas
```

### Function Call Format

Function calls from the model follow this structure:

```typescript
type FunctionCall = {
  name: string      // Tool name to execute
  arguments: string // JSON-encoded arguments
}
```

### Tool Result Format

Tool handlers return results in this format:

```typescript
type ToolResult = {
  success: boolean  // Whether execution succeeded
  data?: unknown    // Result data if successful
  error?: string    // Error message if failed
}
```

## Built-in Tools

### writeTemplate

Writes a JSX template file.

**Schema:**
```typescript
{
  name: 'writeTemplate',
  description: 'Write a JSX template file for a UI element',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative file path (e.g., "button.tsx")' },
      content: { type: 'string', description: 'JSX template content' }
    },
    required: ['path', 'content']
  }
}
```

**Example Call:**
```json
{
  "name": "writeTemplate",
  "arguments": "{\"path\": \"button.tsx\", \"content\": \"export const Button = () => <button>Click</button>\"}"
}
```

### writeStory

Writes a story file for testing.

**Schema:**
```typescript
{
  name: 'writeStory',
  description: 'Write a story file for testing a template',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative file path (e.g., "button.stories.tsx")' },
      content: { type: 'string', description: 'Story file content' }
    },
    required: ['path', 'content']
  }
}
```

### runStory

Executes a story and returns test results.

**Schema:**
```typescript
{
  name: 'runStory',
  description: 'Execute a story file and return test results',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the story file to run' }
    },
    required: ['path']
  }
}
```

**Result:**
```typescript
{
  success: true,
  data: {
    passed: true,
    totalAssertions: 5,
    passedAssertions: 5,
    a11yPassed: true,
    errors: []
  }
}
```

## Creating Custom Tools

### Basic Registration

```typescript
import { createToolRegistry, type ToolHandler, type ToolSchema } from 'plaited/agent'

const registry = createToolRegistry()

const handler: ToolHandler = async (args) => {
  const { input } = args as { input: string }

  try {
    const result = await doSomething(input)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

const schema: ToolSchema = {
  name: 'myTool',
  description: 'Description of what this tool does',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'The input to process' }
    },
    required: ['input']
  }
}

registry.register('myTool', handler, schema)
```

### Tool with Multiple Parameters

```typescript
registry.register('createStyle', async (args) => {
  const { selector, properties } = args as {
    selector: string
    properties: Record<string, string>
  }

  const css = `${selector} { ${
    Object.entries(properties)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ')
  } }`

  return { success: true, data: { css } }
}, {
  name: 'createStyle',
  description: 'Generate CSS for a selector',
  parameters: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector' },
      properties: {
        type: 'object',
        description: 'CSS property-value pairs'
      }
    },
    required: ['selector', 'properties']
  }
})
```

### Async Tool with External API

```typescript
registry.register('fetchDesignTokens', async (args) => {
  const { tokenSet } = args as { tokenSet: string }

  try {
    const response = await fetch(`https://api.tokens.dev/${tokenSet}`)
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const tokens = await response.json()
    return { success: true, data: tokens }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}, {
  name: 'fetchDesignTokens',
  description: 'Fetch design tokens from token API',
  parameters: {
    type: 'object',
    properties: {
      tokenSet: { type: 'string', description: 'Name of the token set to fetch' }
    },
    required: ['tokenSet']
  }
})
```

## Using createCoreTools

The `createCoreTools` factory creates a pre-configured registry:

```typescript
import { createCoreTools } from 'plaited/agent'

const tools = createCoreTools({
  outputDir: './generated',
  runStory: async (path) => {
    // Your story runner implementation
    const result = await myStoryRunner.run(path)
    return {
      passed: result.success,
      totalAssertions: result.total,
      passedAssertions: result.passed,
      a11yPassed: result.a11y,
      errors: result.errors
    }
  }
})

// Tools included: writeTemplate, writeStory, runStory
```

### Extending Core Tools

```typescript
const tools = createCoreTools({ outputDir: './generated' })

// Add custom tools to the registry
tools.register('customTool', handler, schema)
```

## Tool Execution Flow

```
Model Response
     │
     ▼
┌─────────────┐
│ FunctionCall │ { name: 'writeTemplate', arguments: '...' }
└─────────────┘
     │
     ▼
┌─────────────┐
│   registry  │ Parse JSON arguments
│   .execute  │ Find handler by name
└─────────────┘
     │
     ▼
┌─────────────┐
│   Handler   │ Execute tool logic
└─────────────┘
     │
     ▼
┌─────────────┐
│ ToolResult  │ { success: true, data: ... }
└─────────────┘
     │
     ▼
┌─────────────┐
│  BP Event   │ { type: 'toolResult', detail: { name, result } }
└─────────────┘
```

## Error Handling

### Unknown Tool

```typescript
const result = await registry.execute({
  name: 'unknownTool',
  arguments: '{}'
})
// { success: false, error: 'Unknown tool: unknownTool' }
```

### Invalid JSON Arguments

```typescript
const result = await registry.execute({
  name: 'writeTemplate',
  arguments: 'not valid json'
})
// { success: false, error: 'Unexpected token...' }
```

### Handler Throws

```typescript
registry.register('failingTool', async () => {
  throw new Error('Something went wrong')
}, schema)

const result = await registry.execute({
  name: 'failingTool',
  arguments: '{}'
})
// { success: false, error: 'Something went wrong' }
```

## Type Definitions

```typescript
// From plaited/agent

type FunctionCall = {
  name: string
  arguments: string
}

type ToolResult = {
  success: boolean
  data?: unknown
  error?: string
}

type ToolHandler = (
  args: Record<string, unknown>
) => ToolResult | Promise<ToolResult>

type ToolSchema = {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
    }>
    required?: string[]
  }
}

type ToolRegistry = {
  register: (name: string, handler: ToolHandler, schema: ToolSchema) => void
  execute: (call: FunctionCall) => Promise<ToolResult>
  schemas: ToolSchema[]
}

// Tool Discovery types
type ToolSource = 'local' | 'mcp' | 'a2a'

type IndexedTool = {
  name: string
  description: string
  keywords: string[]
  source: ToolSource
  sourceUrl?: string
  schema: ToolSchema
}

type ToolMatch = {
  tool: IndexedTool
  score: number        // Combined RRF score (0-1)
  ftsRank?: number     // FTS5 rank if keyword matched
  vectorDistance?: number  // Vector distance if semantically matched
}

type SearchOptions = {
  limit?: number       // Max results (default: 5)
  minScore?: number    // Score threshold (default: 0.001)
  source?: ToolSource  // Filter by provenance
  ftsWeight?: number   // Keyword search weight (default: 0.5)
  vectorWeight?: number // Vector search weight (default: 0.5)
}

type ToolDiscoveryConfig = {
  dbPath?: string      // SQLite path (default: ':memory:')
  enableVectorSearch?: boolean
  embedder?: (text: string) => Promise<Float32Array>
  vectorDimensions?: number  // Default: 384
}

type ToolDiscovery = {
  index: (tool: IndexedTool) => Promise<void>
  indexBatch: (tools: IndexedTool[]) => Promise<void>
  search: (intent: string, options?: SearchOptions) => Promise<ToolMatch[]>
  all: () => IndexedTool[]
  bySource: (source: ToolSource) => IndexedTool[]
  remove: (name: string) => void
  clearSource: (source: ToolSource) => void
  stats: () => ToolDiscoveryStats
  close: () => void
}
```
