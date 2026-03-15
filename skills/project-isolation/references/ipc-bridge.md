# IPC Bridge Patterns

## Bun.spawn IPC

Bun's `Bun.spawn()` supports `ipc: true` for structured message passing between parent and child processes. Messages are serialized via `structuredClone`, which handles plain objects, arrays, typed arrays, Maps, Sets, Dates, RegExps, and nested combinations — but **not** functions, Symbols, or DOM nodes.

BP events `{ type: string, detail?: unknown }` are plain objects with serializable values, making them natively IPC-compatible.

## Orchestrator Side

```typescript
const project = Bun.spawn(['bun', 'run', projectEntry], {
  cwd: projectRoot,
  ipc(message) {
    // Validate before triggering — subprocess may send malformed data
    const event = BPEventSchema.safeParse(message)
    if (event.success) trigger(event.data)
  }
})

// Forward task to project subprocess
project.send({ type: 'task', detail: { prompt, context, sessionId } })
```

**Key points:**
- `ipc(message)` callback receives deserialized messages from the child
- `project.send(data)` sends serialized messages to the child
- The `cwd` option sets the subprocess working directory to the project root
- Always validate with a schema before triggering — defense in depth

## Subprocess Side

```typescript
// Receive events from orchestrator
process.on('message', (message) => {
  const event = BPEventSchema.safeParse(message)
  if (event.success) trigger(event.data)
})

// Send results back to orchestrator
useFeedback({
  tool_result({ detail }) {
    process.send!({ type: 'tool_result', detail })
  },
  message({ detail }) {
    process.send!({ type: 'message', detail })
  },
  error({ detail }) {
    process.send!({ type: 'error', detail })
  }
})
```

**Key points:**
- `process.on('message', cb)` receives from the parent
- `process.send!(data)` sends to the parent (non-null assertion because IPC is guaranteed when spawned with `ipc: true`)
- Feedback handlers bridge BP events to IPC — the subprocess's agent loop triggers BP events internally, and selected events are forwarded to the orchestrator

## structuredClone Serialization

What passes through IPC:

| Type | Supported | Notes |
|---|---|---|
| Plain objects | Yes | BP event `{ type, detail }` |
| Arrays | Yes | Tool call batches |
| Strings, numbers, booleans, null | Yes | Primitive detail values |
| Uint8Array, ArrayBuffer | Yes | Binary data (file contents) |
| Map, Set | Yes | But consider plain objects for portability |
| Date, RegExp | Yes | Serialized by value |
| **Functions** | **No** | Cannot send predicates over IPC |
| **Symbols** | **No** | Use string event types |
| **Class instances** | **No** | Loses prototype chain — use plain objects |

**Critical constraint:** Block predicates (functions) cannot cross the IPC boundary. Constitution rules that use predicate-based blocking must be defined in the subprocess, not sent from the orchestrator. The orchestrator sends constitution *configuration* (data), and the subprocess constructs the predicate bThreads locally.

## Error Handling

```typescript
// Orchestrator: detect subprocess crash
project.exited.then((exitCode) => {
  if (exitCode !== 0) {
    trigger({ type: 'subprocess_crashed', detail: { projectKey, exitCode } })
  }
})
```

Crash containment is a core isolation guarantee — a failing subprocess doesn't take down the orchestrator or other projects.
