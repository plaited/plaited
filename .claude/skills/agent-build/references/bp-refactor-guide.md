# BP Refactor Guide for agent.ts

## Current State (Wave 2)

The agent loop in `src/agent/agent.ts` uses:
- `let done = false` flag checked in 11 handlers via `if (done) return`
- `checkComplete()` helper called from 3 handlers (gate_rejected, eval_rejected, tool_result)
- `pendingToolCallCount` for parallel multi-tool tracking
- 3 bThreads: maxIterations (one-shot), simulationGuard (persistent), symbolicSafetyNet (persistent)

## Target State (Post-Refactor)

### New bThreads

```typescript
bThreads.set({
  // REPLACES: done flag + 11 if (done) return guards
  // Blocks all task-related events between tasks; allows them during a task
  taskGate: bThread([
    bSync({
      waitFor: AGENT_EVENTS.task,
      block: (event) => TASK_EVENTS.has(event.type),
    }),
    bSync({ waitFor: AGENT_EVENTS.message }),
  ], true),

  // UNCHANGED: blocks execute during simulation
  simulationGuard: bThread([
    bSync({
      block: (event) => {
        if (event.type !== AGENT_EVENTS.execute) return false
        return simulatingIds.has(event.detail?.toolCall?.id)
      },
    }),
  ], true),

  // UNCHANGED: blocks execute on dangerous prediction
  symbolicSafetyNet: bThread([
    bSync({
      block: (event) => {
        if (event.type !== AGENT_EVENTS.execute) return false
        const prediction = simulationPredictions.get(event.detail?.toolCall?.id)
        if (!prediction) return false
        return checkSymbolicGate(prediction, patterns).blocked
      },
    }),
  ], true),
})
```

### Per-Task Dynamic Thread (added in task handler)

```typescript
// In the 'task' feedback handler:
bThreads.set({
  maxIterations: bThread([
    ...Array.from({ length: maxIterations }, () =>
      bSync({ waitFor: AGENT_EVENTS.tool_result, interrupt: [AGENT_EVENTS.message] })
    ),
    bSync({
      block: AGENT_EVENTS.execute,
      request: { type: AGENT_EVENTS.message, detail: { content: `Max iterations (${maxIterations}) reached` } },
      interrupt: [AGENT_EVENTS.message],
    }),
  ]),
})
```

### TASK_EVENTS Set

```typescript
const TASK_EVENTS = new Set([
  AGENT_EVENTS.model_response,
  AGENT_EVENTS.proposed_action,
  AGENT_EVENTS.gate_approved,
  AGENT_EVENTS.gate_rejected,
  AGENT_EVENTS.simulate_request,
  AGENT_EVENTS.simulation_result,
  AGENT_EVENTS.eval_approved,
  AGENT_EVENTS.eval_rejected,
  AGENT_EVENTS.execute,
  AGENT_EVENTS.tool_result,
  AGENT_EVENTS.save_plan,
  AGENT_EVENTS.plan_saved,
])
```

Note: `task` and `message` are NOT in TASK_EVENTS — they are the gate transitions.

### Handler Changes

**Remove from ALL handlers:**
```typescript
// DELETE these lines:
if (done) return
```

**task handler** — add dynamic maxIterations thread:
```typescript
[AGENT_EVENTS.task]: async (detail) => {
  // Add per-task maxIterations thread (interrupted by 'message' at end of task)
  bThreads.set({ maxIterations: bThread([...]) })

  history.push({ role: 'user', content: detail.prompt })
  // ... rest unchanged
},
```

**message handler** — remove `done = true`:
```typescript
[AGENT_EVENTS.message]: (detail) => {
  // taskGate advances to phase 1 (blocking) — no manual done flag needed
  recorder.addMessage(detail.content)
  resolveRun?.({ output: detail.content, trajectory: recorder.getSteps() })
},
```

**run()** — remove `done = false` reset:
```typescript
run: (prompt) => {
  recorder.reset()
  history.length = 0
  currentPlan = null
  rejections = []
  pendingToolCallCount = 0
  simulatingIds.clear()
  simulationPredictions.clear()
  // done = false — REMOVED, taskGate handles this

  return new Promise((resolve) => {
    resolveRun = resolve
    trigger({ type: AGENT_EVENTS.task, detail: { prompt } })
  })
},
```

**destroy()** — remove `done = true`:
```typescript
destroy: () => {
  // Trigger message to advance taskGate to blocking phase
  // Or just disconnect feedback directly
  disconnectFeedback()
  resolveRun?.({ output: '', trajectory: recorder.getSteps() })
  resolveRun = null
},
```

### Optional: invoke_inference Event

If we want full BP observability of inference re-invocation:

```typescript
// Add to AGENT_EVENTS:
'invoke_inference'

// Add to TASK_EVENTS set

// Replace checkComplete():
const onToolComplete = () => {
  pendingToolCallCount--
  if (pendingToolCallCount <= 0) {
    pendingToolCallCount = 0
    simulatingIds.clear()
    simulationPredictions.clear()
    rejections = []
    trigger({ type: AGENT_EVENTS.invoke_inference })
  }
}

// New handler:
[AGENT_EVENTS.invoke_inference]: async () => {
  try {
    const response = await callInference()
    trigger({ type: AGENT_EVENTS.model_response, detail: { parsed: parseModelResponse(response), raw: response } })
  } catch (error) {
    handleInferenceError(error)
  }
},
```

This makes inference re-invocation visible in `useSnapshot` — the model can see "invoke_inference was selected" in its event log.

## Test Impact

All 137 existing agent tests should pass unchanged because:
- The taskGate bThread produces the same observable behavior as `if (done) return`
- Events between tasks were already no-ops (the `done` flag prevented handler execution)
- The maxIterations thread still fires `message` at the same point
- `interrupt: ['message']` on maxIterations just adds defense-in-depth

New tests to add:
- taskGate blocks stale events between run() calls
- maxIterations interrupted by early message (model responds without tools)
- destroy() works correctly without done flag
- Multiple sequential run() calls on same agent loop instance
