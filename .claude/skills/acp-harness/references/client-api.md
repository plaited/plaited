# ACP Client API

Programmatic usage of the ACP client (`plaited/acp`).

## ACP Adapter Requirement

Claude Code CLI does not speak ACP natively. You need an adapter that wraps it and exposes ACP over stdio:

```bash
# Install the Claude Code ACP adapter
npm install -g @zed-industries/claude-code-acp

# Run with API key
ANTHROPIC_API_KEY=sk-... claude-code-acp
```

See [ACP Agents](https://agentclientprotocol.com/overview/agents) for other ACP-compatible agents.

## createACPClient

Factory function that creates a headless ACP client for connecting to agents.

```typescript
import { createACPClient } from 'plaited/acp'

const client = createACPClient({
  command: ['claude-code-acp'],
  cwd: '/path/to/project',
  timeout: 60000,
  sandbox: { enabled: true }
})
```

### Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | `string[]` | Yes | ACP agent command (e.g., `['claude-code-acp']`) |
| `cwd` | `string` | No | Working directory for agent process |
| `env` | `Record<string, string>` | No | Environment variables |
| `timeout` | `number` | No | Request timeout in ms (default: 30000) |
| `sandbox` | `SandboxConfig` | No | OS-level restrictions |
| `clientInfo` | `{ name, version }` | No | Client identification |
| `capabilities` | `ClientCapabilities` | No | Advertised capabilities |
| `onPermissionRequest` | `function` | No | Custom permission handler |

### Methods

#### connect()

Establishes connection to the agent process.

```typescript
const initResult = await client.connect()
// initResult.agentCapabilities contains agent info
```

#### createSession(params)

Creates a new session. Accepts `NewSessionRequest` with optional `cwd` and `mcpServers`.

```typescript
const session = await client.createSession({
  cwd: '/project/path',
  mcpServers: [
    { type: 'stdio', name: 'fs', command: ['mcp-filesystem', '/data'] }
  ]
})
// session.id is the session identifier
```

#### promptSync(sessionId, content)

Sends a prompt and waits for complete response. Returns full trajectory in `updates`.

```typescript
const { result, updates } = await client.promptSync(session.id, content)
// updates is SessionNotification[] with full trajectory
// result is PromptResponse
```

#### prompt(sessionId, content)

AsyncGenerator for streaming updates. Use for real-time UI or incremental processing.

```typescript
for await (const event of client.prompt(session.id, content)) {
  if (event.type === 'update') {
    console.log('Update:', event.params.update)
  } else if (event.type === 'complete') {
    console.log('Done:', event.result)
  }
}
```

#### disconnect(graceful?)

Closes connection to the agent.

```typescript
await client.disconnect()
```

## Sandbox Configuration

OS-level restrictions using `@anthropic-ai/sandbox-runtime`.

```typescript
const client = createACPClient({
  command: ['claude-code-acp'],
  sandbox: {
    enabled: true,
    network: {
      allowedDomains: ['github.com', 'api.anthropic.com'],
      deniedDomains: [],
      allowUnixSockets: [],
      allowLocalBinding: false
    },
    filesystem: {
      denyRead: ['/etc/passwd', '/etc/shadow'],
      allowWrite: ['/tmp', './output'],
      denyWrite: []
    }
  }
})
```

| Field | Type | Description |
|-------|------|-------------|
| `network.allowedDomains` | `string[]` | Permitted domains (wildcards: `*.github.com`) |
| `network.deniedDomains` | `string[]` | Blocked domains (takes precedence) |
| `filesystem.denyRead` | `string[]` | Paths to deny read access |
| `filesystem.allowWrite` | `string[]` | Paths to allow write access |

## Permission Handling

Default: auto-approves using `allow_always` for headless evaluation. Custom handlers:

```typescript
const client = createACPClient({
  command: ['claude-code-acp'],
  onPermissionRequest: async (params) => {
    const allowOption = params.options.find(opt => opt.kind === 'allow_once')
    if (allowOption) {
      return { outcome: { outcome: 'selected', optionId: allowOption.optionId } }
    }
    return { outcome: { outcome: 'cancelled' } }
  }
})
```

## SessionNotification Structure

`updates` from `promptSync` contains `SessionNotification[]`:

```typescript
type SessionNotification = {
  sessionId: string
  update: SessionUpdate  // discriminated union
}
```

Update types (`update.sessionUpdate`):

| Type | Fields |
|------|--------|
| `agent_message_chunk` | `content: ContentBlock` |
| `agent_thought_chunk` | `content: ContentBlock` |
| `tool_call` | `toolCallId`, `title`, `status`, `rawInput`, `rawOutput`, `content` |
| `plan` | `entries: PlanEntry[]` |
| `user_message_chunk` | `content: ContentBlock` |

## ToolCall Fields

From `@agentclientprotocol/sdk`:

| Field | Type | Description |
|-------|------|-------------|
| `toolCallId` | `string` | Unique identifier |
| `title` | `string` | Human-readable description |
| `status` | `ToolCallStatus` | `pending`, `in_progress`, `completed`, `failed` |
| `rawInput` | `unknown` | Raw input parameters |
| `rawOutput` | `unknown` | Raw output from tool |
| `content` | `ToolCallContent[]` | Structured content blocks |
| `kind` | `ToolKind` | Tool category for UI |
| `locations` | `ToolCallLocation[]` | Affected file locations |

## Helper Utilities

Import from `plaited/acp`:

### Content Builders

```typescript
import {
  createPrompt,           // Simple text prompt
  createTextContent,      // Text content block
  createImageContent,     // Base64 image block
  createResourceLink,     // Resource link block
  createTextResource,     // Embedded text resource
  createPromptWithFiles,  // Prompt with file context
  createPromptWithImage   // Prompt with image
} from 'plaited/acp'
```

### Response Analysis

```typescript
import {
  summarizeResponse,        // Full response summary
  extractTextFromUpdates,   // Extract text from notifications
  extractToolCalls,         // Extract all tool calls
  extractLatestToolCalls,   // Deduplicated by toolCallId
  extractPlan,              // Extract plan entries
  filterToolCallsByStatus,  // Filter by status
  filterToolCallsByTitle,   // Filter by title
  hasToolCallErrors         // Check for failures
} from 'plaited/acp'

const summary = summarizeResponse(updates)
// summary.text, summary.completedToolCalls, summary.failedToolCalls, etc.
```

## MCP Server Configuration

```typescript
const session = await client.createSession({
  mcpServers: [
    // Stdio (required by all ACP agents)
    { type: 'stdio', name: 'fs', command: ['mcp-filesystem'], env: {}, cwd: '.' },
    // HTTP (optional, check agent capabilities)
    { type: 'http', name: 'api', url: 'http://localhost:3000', headers: {} }
  ]
})
```
