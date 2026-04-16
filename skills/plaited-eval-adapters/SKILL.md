---
name: plaited-eval-adapters
description: Guide for writing eval-compatible adapter scripts that emit TrialResult artifacts. Use when integrating external agents or scripts into the Plaited eval pipeline.
license: ISC
compatibility: Requires bun
---

# Plaited Eval Adapters

Guide for writing adapter scripts that integrate with the Plaited eval pipeline. External agents and scripts can emit eval-compatible artifacts for use with `bunx plaited eval`.

## When to use

- Integrating an external agent (You.com, OpenRouter, custom) into the eval pipeline
- Writing a script that wraps a model provider
- Emitting structured trial results for strategy comparison

## Adapter Interface

An adapter receives `AdapterInput` and must return `AdapterResult`.

### AdapterInput

```typescript
{
  /** Single or multi-turn prompt */
  prompt: string | string[]
  /** Working directory for the adapter */
  cwd?: string
  /** Optional scenario-specific system prompt override */
  systemPrompt?: string
}
```

### AdapterResult

```typescript
{
  /** Final agent response text (required) */
  output: string
  /** Optional structured trajectory */
  trajectory?: TrajectoryStep[]
  /** Optional capture evidence */
  capture?: CaptureEvidence
  /** Optional timing information */
  timing?: Timing
  /** Process exit code (null if signaled) */
  exitCode?: number | null
  /** Whether the adapter timed out */
  timedOut?: boolean
}
```

## Implementation Patterns

### TypeScript module adapter

Export `adapt` as a named function:

```typescript
// my-adapter.ts
import type { AdapterInput, AdapterResult } from 'plaited/cli'

export const adapt = async ({
  prompt,
  cwd,
}: AdapterInput): Promise<AdapterResult> => {
  const start = Date.now()
  
  // Call your agent/provider
  const response = await callMyAgent({
    prompt: Array.isArray(prompt) ? prompt.join('\n') : prompt,
    cwd,
  })
  
  return {
    output: response.text,
    timing: {
      total: Date.now() - start,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    },
    trajectory: response.steps.map((step) => ({
      type: step.type,
      status: step.status,
      timestamp: step.timestamp,
    })),
    capture: {
      source: 'my-adapter',
      format: 'chat-completion',
      eventCount: response.events.length,
      messageCount: response.messages.length,
      toolCallCount: response.toolCalls.length,
    },
  }
}
```

### Executable adapter

Any executable that reads `AdapterInput` from stdin and emits `AdapterResult` to stdout:

```bash
#!/bin/bash
# my-adapter.sh

read -r input
PROMPT=$(echo "$input" | jq -r '.prompt')

# Call your agent
RESULT=$(call_my_agent "$PROMPT")

# Emit JSON result
echo "{\"output\": \"$RESULT\", \"timing\": {\"total\": 1234}}"
```

## Trajectory Format

Trajectory steps provide structured insight into agent behavior:

```typescript
{
  /** Step type: message, tool_call, thought, plan, decision, event */
  type: string
  /** Optional status: pending, running, completed, failed */
  status?: string
  /** Optional timestamp (ms since epoch) */
  timestamp?: number
  // ... additional provider-specific fields preserved
}
```

### Common trajectory types

| Type | Description |
|------|-------------|
| `message` | User or assistant message |
| `tool_call` | Tool invocation |
| `thought` | Reasoning/thinking |
| `plan` | Execution plan |
| `decision` | Decision point |
| `event` | Other events |

## Capture Evidence

Model-agnostic evidence about what was captured during a run:

```typescript
{
  /** Adapter or capture source identifier */
  source: string
  /** Capture format */
  format: 'response-only' | 'chat-completion' | 'jsonl-event-stream' | 'mixed'
  /** Count of provider-native events */
  eventCount?: number
  /** Count of user/assistant messages */
  messageCount?: number
  /** Count of reasoning/thought segments */
  thoughtCount?: number
  /** Count of tool calls */
  toolCallCount?: number
  /** Short evidence snippets */
  snippets?: Array<{
    kind: 'message' | 'thought' | 'tool_call' | 'event' | 'stderr' | 'stdout' | 'usage'
    text: string
  }>
}
```

## Usage and Cost Fields

Include timing data for cost analysis:

```typescript
{
  timing: {
    /** Adapter-reported total duration in ms */
    total?: number
    /** Input tokens consumed */
    inputTokens?: number
    /** Output tokens generated */
    outputTokens?: number
  }
}
```

## Untrusted Retrieved Content

When adapters include retrieved content in the prompt (RAG, web search, etc.):

1. **Mark retrieved content** in the trajectory
2. **Include source references** in metadata
3. **Track retrieval counts** in capture evidence

```typescript
trajectory: [
  {
    type: 'retrieval',
    status: 'completed',
    timestamp: Date.now(),
    source: 'vector-db',
    docCount: 5,
  },
  {
    type: 'message',
    role: 'user',
    content: 'Context: [retrieved docs injected here]',
    hasRetrievedContent: true,
  },
]
```

## Error Handling

Return a valid result even on failure:

```typescript
export const adapt = async ({
  prompt,
}: AdapterInput): Promise<AdapterResult> => {
  try {
    const response = await callAgent(prompt)
    return { output: response.text }
  } catch (error) {
    return {
      output: '',
      exitCode: 1,
      capture: {
        source: 'my-adapter',
        format: 'response-only',
      },
    }
  }
}
```

## Multi-turn Support

For multi-turn conversations, pass an array of prompts:

```typescript
export const adapt = async ({
  prompt,
}: AdapterInput): Promise<AdapterResult> => {
  const turns = Array.isArray(prompt) ? prompt : [prompt]
  let context = ''
  
  for (const turn of turns) {
    const response = await callAgent(context + turn)
    context += `\nUser: ${turn}\nAssistant: ${response.text}`
  }
  
  return {
    output: context,
    trajectory: turns.map((_, i) => ({
      type: 'message',
      role: i % 2 === 0 ? 'user' : 'assistant',
    })),
  }
}
```

## Related Skills

- `plaited-eval` for running the eval CLI and comparing results
