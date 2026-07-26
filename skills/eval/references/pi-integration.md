# Pi Integration Patterns

These are documented examples that a consumer adapts. Plaited never depends on pi. The patterns are "here's one way" — not a contract.

## Trajectory Event Shape

A pi extension captures user-assistant interaction events and collects them into a trajectory:

```ts
type TrajectoryEvent = {
  type: 'user_message' | 'assistant_message' | 'tool_call' | 'tool_result'
  timestamp: number
  content: string
  metadata?: Record<string, unknown>
}
```

For other SDKs, define your own `SDKEvent` and collector.

## Creating a Trajectory Collector

```ts
const createTrajectoryCollector = () => {
  const events: TrajectoryEvent[] = []

  return {
    onUserMessage: (text: string) => {
      events.push({ type: 'user_message', timestamp: Date.now(), content: text })
    },
    onAssistantMessage: (text: string) => {
      events.push({ type: 'assistant_message', timestamp: Date.now(), content: text })
    },
    onToolCall: (name: string, args: unknown) => {
      events.push({
        type: 'tool_call',
        timestamp: Date.now(),
        content: JSON.stringify({ name, args }),
      })
    },
    onToolResult: (result: unknown) => {
      events.push({
        type: 'tool_result',
        timestamp: Date.now(),
        content: JSON.stringify(result),
      })
    },
    getEvents: (): TrajectoryEvent[] => [...events],
    reset: () => { events.length = 0 },
  }
}
```

## Wiring with pi Session

```ts
import { createTrajectoryCollector } from './collector.ts'

const collector = createTrajectoryCollector()

// Subscribe to pi session events
pi.session.subscribe((event) => {
  if (event.type === 'user_message') {
    collector.onUserMessage(event.text)
  } else if (event.type === 'assistant_message') {
    collector.onAssistantMessage(event.text)
  }
  // ... handle other event types
})
```

## Behavioral-Extension Snapshot Capture

When using the Plaited behavioral extension inside pi, subscribe to snapshot events:

```ts
behavioral.snapshotPublisher.subscribe((snapshot) => {
  collector.onSnapshot(snapshot)
})
```

## Building an Eval Trial from Collected Events

```ts
import { buildEvalTrial } from 'plaited/eval'

const trial = buildEvalTrial({
  id: 'trial-1',
  cwd: process.cwd(),
  task: { id: 'task-1', prompt: 'the original prompt' },
  result: {
    status: 'completed',
    message: assistantResponse,
    metadata: { finishReason: 'stop' },
  },
  events: collector.getEvents(),
  metadata: {
    model: 'gpt-4',
    startTime: sessionStart,
    durationMs: Date.now() - sessionStart,
  },
})
```

## Grading the Trial

```ts
import { gradeEvalTrial } from 'plaited/eval'

const result = await gradeEvalTrial({
  trial,
  graders: [
    { id: 'process', type: 'json', result: { pass: true, score: 1 } },
    {
      id: 'custom-check',
      type: 'function',
      run: (ctx) => {
        const events = ctx.trial.events as TrajectoryEvent[]
        const hasToolCalls = events.some((e) => e.type === 'tool_call')
        return {
          pass: hasToolCalls,
          score: hasToolCalls ? 1 : 0,
          reasoning: hasToolCalls ? 'Tool was called' : 'No tool calls made',
        }
      },
    },
  ],
})
```

## Calibrating with the Diagnostic Predicate

For non-behavioral trials, define your own diagnostic predicate:

```ts
const isDiagnosticEvent = (event: TrajectoryEvent): boolean => {
  return event.type === 'tool_call' && event.content.includes('error')
}

const calibrated = calibrateEvalRun({
  bundle,
  isDiagnosticEvent,
})
```

## Full Extension Pattern

See `skills/eval/references/scaffold.md` for a runnable skeleton that walks through grill-me → TDD → implementation → calibration. Consumer adapts the pi wiring and event collector for their SDK.
