# Constitution Rules

MAC bThread patterns for secret protection using Varlock.

## Core Rule: Block .env File Reads

A MAC bThread that blocks the agent from reading `.env` files — only `.env.schema` is safe. This prevents secret leakage into agent context, conversation history, or training data.

```typescript
import { bSync, bThread } from '../../src/behavioral/behavioral.utils.ts'
import { AGENT_EVENTS, BUILT_IN_TOOLS } from '../../src/agent/agent.constants.ts'
import { createConstitution } from '../../src/agent/agent.factories.ts'
import type { AgentToolCall } from '../../src/agent/agent.schemas.ts'

/**
 * Checks whether a tool call attempts to read a .env file (not .env.schema).
 */
const isEnvFileRead = (toolCall: AgentToolCall): boolean => {
  // Check read_file tool
  if (toolCall.name === BUILT_IN_TOOLS.read_file) {
    const path = (toolCall.arguments.path ?? toolCall.arguments.file_path) as string | undefined
    if (path && /\.env($|\.[^s])/.test(path)) return true
    if (path?.endsWith('.env')) return true
  }

  // Check bash commands that could read .env files
  if (toolCall.name === BUILT_IN_TOOLS.bash) {
    const command = toolCall.arguments.command as string | undefined
    if (command && /\bcat\b.*\.env\b/.test(command) && !command.includes('.env.schema')) return true
    if (command && /\bsource\b.*\.env\b/.test(command) && !command.includes('.env.schema')) return true
    if (command && /\bless\b.*\.env\b/.test(command) && !command.includes('.env.schema')) return true
  }

  return false
}

/**
 * MAC factory: blocks reading .env files.
 *
 * Only .env.schema is readable — it contains metadata, not secrets.
 * This is a MAC (Mandatory Access Control) rule — the agent cannot override it.
 */
export const noEnvFileReads = createConstitution(() => ({
  threads: {
    noEnvFileReads: bThread(
      [
        bSync({
          block: (e) =>
            e.type === AGENT_EVENTS.execute &&
            e.detail?.toolCall != null &&
            isEnvFileRead(e.detail.toolCall),
        }),
      ],
      true, // repeat forever
    ),
  },
}))
```

## How It Works

The bThread runs in an infinite loop (`true` repeat). At each BP synchronization point, it **blocks** any event where:
1. The event type is `execute` (agent is about to run a tool)
2. The tool call targets a `.env` file (but NOT `.env.schema`)

Because it's a **block** (not a `waitFor`), it doesn't consume events — it prevents them from being selected by the BP engine. The agent's proposed action is simply not executed.

## What Gets Blocked vs Allowed

| Action | Blocked? | Reason |
|--------|----------|--------|
| `read_file(".env")` | Yes | Direct secret access |
| `read_file(".env.production")` | Yes | Environment-specific secrets |
| `read_file(".env.local")` | Yes | Local overrides contain secrets |
| `read_file(".env.schema")` | No | Schema has metadata only |
| `bash("cat .env")` | Yes | Indirect secret access |
| `bash("cat .env.schema")` | No | Schema is safe |
| `bash("source .env")` | Yes | Loading secrets into shell |
| `read_file("src/.env.ts")` | No | Not a dotenv file |

## Integration with Node Setup

When generating a seed for a new node, include this MAC factory in the node's constitution:

```typescript
import { DEFAULT_MAC_FACTORIES } from '../../src/agent/agent.governance.ts'
import { noEnvFileReads } from './constitution/no-env-file-reads.ts'

// Add to default MAC factories at spawn
const macFactories = [...DEFAULT_MAC_FACTORIES, noEnvFileReads]
```

## Dual Representation

Following the constitution skill's dual representation principle, the MAC bThread should be paired with a skill instruction that teaches the model the same rule:

**bThread (symbolic):** Blocks `.env` reads structurally — the action physically cannot execute.

**Skill instruction (neural):** Teaches the model to read `.env.schema` instead — reduces wasted inference from proposing blocked actions.

Example skill instruction:
> When you need to understand a node's environment requirements, read `.env.schema` — never `.env`. The schema contains variable names, types, descriptions, and sensitivity markers. Actual values are resolved at runtime by Varlock and are never visible to you.

## Testing Pattern

Following the governance test pattern from `agent.governance.spec.ts`:

```typescript
import { describe, test, expect } from 'bun:test'
import { behavioral } from '../../src/behavioral/behavioral.ts'
import { AGENT_EVENTS } from '../../src/agent/agent.constants.ts'
import { noEnvFileReads } from './constitution/no-env-file-reads.ts'

describe('noEnvFileReads', () => {
  const setup = () => {
    const { bThreads, trigger, useFeedback } = behavioral()
    const { threads } = noEnvFileReads.create(trigger)
    if (threads) bThreads.set(threads)

    const selected: string[] = []
    useFeedback({
      [AGENT_EVENTS.execute]() {
        selected.push('execute')
      },
    })
    return { trigger, selected }
  }

  test('blocks reading .env file', () => {
    const { trigger, selected } = setup()
    trigger({
      type: AGENT_EVENTS.execute,
      detail: {
        toolCall: { name: 'read_file', arguments: { path: '.env' } },
      },
    })
    expect(selected).toEqual([]) // blocked
  })

  test('allows reading .env.schema', () => {
    const { trigger, selected } = setup()
    trigger({
      type: AGENT_EVENTS.execute,
      detail: {
        toolCall: { name: 'read_file', arguments: { path: '.env.schema' } },
      },
    })
    expect(selected).toEqual(['execute']) // allowed
  })
})
```
