# Behavioral Programming: Foundations

Behavioral Programming (BP) is a general coordination mechanism for managing concurrent behaviors through event-driven synchronization. This document covers BP as a **foundational paradigm**, independent of UI concerns.

**For UI-specific BP usage**, see:
- `b-element.md` for integrating BP with custom elements
- `cross-island-communication.md` for coordinating multiple islands
- `form-associated-elements.md` for capturing user intent

## BP Paradigm Overview

Behavioral Programming enables declarative coordination of concurrent behaviors without direct function calls or shared state mutation.

### Super-Step Execution Model

The BP engine operates in a continuous cycle called the **super-step**:

```
┌─────────────────────────────────────────┐
│         SUPER-STEP EXECUTION            │
├─────────────────────────────────────────┤
│                                         │
│  1. RUN                                 │
│     └─ Resume all running threads       │
│        until next `yield`               │
│                                         │
│  2. COLLECT                             │
│     └─ Gather synchronization idioms:   │
│        • Requests (events to propose)   │
│        • WaitFor (events to wait for)   │
│        • Block (events to prevent)      │
│        • Interrupt (terminate thread)   │
│                                         │
│  3. SELECT                              │
│     └─ Choose next event:               │
│        • Apply blocking               │
│        • Select by priority             │
│        • External triggers = priority 0 │
│                                         │
│  4. NOTIFY                              │
│     └─ Resume threads waiting for       │
│        selected event                   │
│                                         │
└────────────┬────────────────────────────┘
             │
             ▼
        (Repeat cycle)
```

### Event-Driven Coordination vs Direct Calls

**Traditional approach** (direct coupling):
```typescript
function handleClick() {
  if (!isDisabled()) {          // Direct state check
    updateCounter()              // Direct function call
    validateForm()               // Direct function call
    if (shouldSubmit()) {
      submitForm()               // Direct function call
    }
  }
}
```

**Behavioral Programming** (declarative coordination):
```typescript
const { trigger, bThreads } = behavioral()

bThreads.set({
  // Independent thread: blocks clicks when disabled
  disableProtection: bThread([
    bSync({ block: ({ type }) => type === 'click' && isDisabled() })
  ], true),

  // Independent thread: counter logic
  counterLogic: bThread([
    bSync({ waitFor: 'click' }),
    bSync({ request: { type: 'updateCounter' } })
  ], true),

  // Independent thread: validation logic
  validationLogic: bThread([
    bSync({ waitFor: 'updateCounter' }),
    bSync({ request: { type: 'validate' } })
  ], true),

  // Independent thread: submission logic
  submissionLogic: bThread([
    bSync({ waitFor: 'validate' }),
    bSync({ request: { type: 'submit' }, waitFor: ({ type }) => type === 'submit' })
  ])
})

// Trigger external event
trigger({ type: 'click' })
// Threads coordinate automatically through event space
```

**Key Difference**: Threads coordinate through the event space, not through direct calls or shared state.

## Core Synchronization Idioms

BP threads coordinate using four synchronization idioms provided to each `yield` statement via `bSync()`:

### `request` - Propose Events

Proposes events to be selected during the SELECT phase:

```typescript
// Static request
bSync({ request: { type: 'submit' } })

// Request with detail
bSync({ request: { type: 'add', detail: { value: 42 } } })

// Dynamic request using template function
bSync({ request: ({ counter }) => ({ type: 'update', detail: { count: counter + 1 } }) })
```

**Template function** receives current state as first argument, enabling dynamic event generation.

### `waitFor` - Pause Until Matching Event

Pauses thread execution until a matching event is selected:

```typescript
// String matching (exact type match)
bSync({ waitFor: 'click' })

// Predicate function (dynamic matching)
bSync({
  waitFor: ({ type, detail }) =>
    type === 'input' && detail.value.length > 5
})

// Multiple threads can wait for same event
```

**Predicate-based waitFor** is powerful for state-dependent coordination (see Predicate-Based Event Matching section).

### `block` - Prevent Events

Blocks events from being selected, taking precedence over requests:

```typescript
// String blocking (exact type match)
bSync({ block: 'submit' })

// Predicate blocking (conditional)
bSync({
  block: ({ type }) => type === 'submit' && !isFormValid()
})

// Array of event types
bSync({ block: ['reset', 'clear'] })

// Array of predicates
bSync({
  block: [
    ({ type }) => type === 'save' && !hasChanges(),
    ({ type }) => type === 'delete' && isReadOnly()
  ]
})
```

**Blocking precedence**: If any thread blocks an event, it cannot be selected, regardless of how many threads request it.

### `interrupt` - Terminate Thread

Terminates the thread when a matching event is selected:

```typescript
bThread([
  bSync({ request: { type: 'poll' } }),
  bSync({ waitFor: 'response' }),
  // Repeat polling...
], true, {
  interrupt: 'cancel' // Terminate this thread if 'cancel' event occurs
})
```

**Use cases**: Cleanup, cancellation, timeout handling.

## Thread Composition with bThread/bSync

Threads are composed using generator functions wrapped by `bThread()` and yielding `bSync()` synchronization points.

### `bSync` - Single Synchronization Point

Creates a single synchronization point (one `yield`):

```typescript
import { bSync } from 'plaited'

// Single sync point with request
const syncPoint = bSync({ request: { type: 'event1' } })

// Single sync point with waitFor and block
const syncPoint2 = bSync({
  waitFor: 'event2',
  block: ({ type }) => type === 'unwanted'
})
```

**Important**: `bSync()` returns a `BSync` object that will be yielded inside a generator function, not a generator itself.

### `bThread` - Sequence Composition

Composes multiple `bSync` points into a sequential thread:

```typescript
import { bThread, bSync } from 'plaited'

// Finite sequence (runs once)
const oneShotThread = bThread([
  bSync({ request: { type: 'start' } }),
  bSync({ waitFor: 'ready' }),
  bSync({ request: { type: 'proceed' } })
])

// Infinite sequence (repeats)
const loopingThread = bThread([
  bSync({ request: { type: 'tick' } }),
  bSync({ waitFor: 'tock' })
], true)  // Second parameter: repeat = true

// Conditional repetition using predicate
let count = 0
const conditionalThread = bThread([
  bSync({ request: { type: 'increment' } }),
  bSync({ waitFor: 'incremented' })
], () => count < 10)  // Repeat while count < 10
```

**Repetition modes**:
- `false` (default): Run sequence once
- `true`: Repeat indefinitely
- `() => boolean`: Repeat while predicate returns true

### Generator Function Mechanics

Under the hood, `bThread` uses generator functions:

```typescript
// What bThread creates internally:
function* threadGenerator() {
  // Pause at first sync point
  yield bSync({ request: { type: 'event1' } })

  // Pause at second sync point
  yield bSync({ waitFor: 'event2' })

  // Pause at third sync point
  yield bSync({ request: { type: 'event3' } })
}
```

**Pause/Resume Flow**:
1. Thread yields `bSync` → becomes **pending**
2. SELECT phase chooses event
3. Threads waiting for selected event resume → become **running**
4. Running threads execute until next `yield`
5. Cycle repeats

**IMPORTANT**: Never expose raw `yield` statements in your code. Always use `bThread()` and `bSync()` factory functions.

## ⭐ Event Selection Strategy (KEY CAPABILITY 1)

Event selection is the core mechanism determining which event executes next. Understanding this is critical for Neuro-symbolic AI rule composition.

### Selection Algorithm

```
1. COLLECT candidate events from all pending threads
   └─ Requested events become candidates

2. APPLY BLOCKING
   └─ Remove any candidate that ANY thread blocks
   └─ Blocking takes precedence over requests

3. SELECT by PRIORITY
   └─ External triggers: priority 0 (highest)
   └─ Thread requests: priority based on registration order
   └─ Lower number = higher priority

4. NO SELECTION if all candidates blocked or none exist
   └─ Execution waits for external trigger
```

### Priority-Based Selection

```typescript
const { trigger, bThreads } = behavioral()

bThreads.set({
  thread1: bThread([bSync({ request: { type: 'event1' } })]),  // Priority 1
  thread2: bThread([bSync({ request: { type: 'event2' } })]),  // Priority 2
  thread3: bThread([bSync({ request: { type: 'event3' } })]),  // Priority 3
})

// All three events are candidates
// 'event1' is selected (lowest priority number = highest priority)
```

**Thread registration order determines initial priority**. Threads registered first get higher priority.

### External Triggers Get Priority 0

External events always have highest priority:

```typescript
const { trigger, bThreads } = behavioral()

bThreads.set({
  autoRequest: bThread([
    bSync({ request: { type: 'auto' } })
  ], true)
})

// External trigger beats internal request
trigger({ type: 'external' })  // Priority 0 - selected first

// Next super-step, 'auto' will be selected (priority 1)
```

### Blocking Precedence Over Requests

Even one blocking thread prevents event selection:

```typescript
const { trigger, bThreads } = behavioral()

bThreads.set({
  requester1: bThread([bSync({ request: { type: 'save' } })]),
  requester2: bThread([bSync({ request: { type: 'save' } })]),
  requester3: bThread([bSync({ request: { type: 'save' } })]),

  // Single blocker prevents all requests
  blocker: bThread([bSync({ block: 'save' })])
})

// 'save' is requested by 3 threads but blocked by 1
// Result: No event selected, execution waits
```

**Implication**: A single validation thread can veto any number of request threads.

## ⭐ Rule Composition Patterns (KEY CAPABILITY 2)

BP's power comes from composing independent threads that coordinate through the event space. Complex behavior emerges from simple thread interactions.

### Additive Composition

Add new rules without modifying existing ones:

```typescript
// Base rule: button click requests 'submit'
const baseRule = bThread([
  bSync({ waitFor: 'click' }),
  bSync({ request: { type: 'submit' } })
], true)

// Add validation rule (blocks submit if invalid)
const validationRule = bThread([
  bSync({ block: ({ type }) => type === 'submit' && !isValid() })
], true)

// Add confirmation rule (blocks submit without confirmation)
const confirmationRule = bThread([
  bSync({ waitFor: 'submit' }),
  bSync({ block: 'submit', request: { type: 'confirm' } }),
  bSync({ waitFor: 'confirmed' })
], true)

// Add rate limiting rule
const rateLimitRule = bThread([
  bSync({ waitFor: 'submit' }),
  bSync({ block: 'submit' }),  // Block immediate resubmit
  bSync({ waitFor: ({ type }) => type === 'timer', request: { type: 'timer' } })
], true)

const { bThreads } = behavioral()

// Compose all rules
bThreads.set({
  baseRule,
  validationRule,
  confirmationRule,
  rateLimitRule
})

// Complex submission flow emerges from independent rules
```

**Key principle**: Each thread represents one concern. Threads coordinate automatically through blocking and waiting.

### Tic-Tac-Toe Example: Independent Rule Coordination

A complete Tic-Tac-Toe game demonstrates additive composition:

```typescript
import { behavioral, bThread, bSync } from 'plaited'

const { trigger, bThreads, useFeedback } = behavioral()

const winConditions = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],  // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8],  // Columns
  [0, 4, 8], [2, 4, 6]              // Diagonals
]

const squares = [0, 1, 2, 3, 4, 5, 6, 7, 8]
let board = new Set(squares)

// Rule 1: Enforce turn-taking
const enforceTurns = bThread([
  bSync({ waitFor: 'X', block: 'O' }),
  bSync({ waitFor: 'O', block: 'X' })
], true)

// Rule 2: Prevent taking occupied squares (one thread per square)
const squaresTaken: Record<string, RulesFunction> = {}
for (const square of squares) {
  squaresTaken[`square_${square}`] = bThread([
    bSync({ waitFor: ({ detail }) => square === detail.square }),
    bSync({ block: ({ detail }) => square === detail.square })
  ])
}

// Rule 3: Detect wins for each player
const detectWins = (player: 'X' | 'O') => {
  const threads: Record<string, RulesFunction> = {}

  for (const [idx, condition] of winConditions.entries()) {
    threads[`${player}_win_${idx}`] = bThread([
      bSync({ waitFor: ({ type, detail }) =>
        type === player && condition.includes(detail.square)
      }),
      bSync({ waitFor: ({ type, detail }) =>
        type === player && condition.includes(detail.square)
      }),
      bSync({ waitFor: ({ type, detail }) =>
        type === player && condition.includes(detail.square)
      }),
      bSync({ request: { type: 'win', detail: { player } } })
    ])
  }

  return threads
}

// Compose all rules
bThreads.set({
  enforceTurns,
  ...squaresTaken,
  ...detectWins('X'),
  ...detectWins('O')
})

// Side effects via feedback handlers (NOT in threads)
useFeedback({
  X({ square }) {
    board.delete(square)
    console.log(`X takes square ${square}`)
  },
  O({ square }) {
    board.delete(square)
    console.log(`O takes square ${square}`)
  },
  win({ player }) {
    console.log(`${player} wins!`)
  }
})

// External triggers
trigger({ type: 'X', detail: { square: 0 } })
trigger({ type: 'O', detail: { square: 1 } })
trigger({ type: 'X', detail: { square: 4 } })
// ... game continues through thread coordination
```

**Emergent behavior**:
- Turn enforcement prevents out-of-turn moves
- Square occupation prevents duplicate moves
- Win detection coordinates with move events
- All rules work together without direct coupling

### Thread Independence

Each thread is self-contained:

```typescript
// Thread 1: Doesn't know about Thread 2
const thread1 = bThread([
  bSync({ request: { type: 'start' } }),
  bSync({ waitFor: 'ready' })
])

// Thread 2: Doesn't know about Thread 1
const thread2 = bThread([
  bSync({ waitFor: 'start' }),
  bSync({ request: { type: 'ready' } })
])

// Yet they coordinate perfectly through event space
bThreads.set({ thread1, thread2 })
```

## ⭐ Predicate-Based Event Matching (KEY CAPABILITY 3)

Predicates enable dynamic, state-dependent event handling beyond simple string matching.

### String Matching vs Predicate Matching

```typescript
// String matching: exact type match
bSync({ waitFor: 'click' })
bSync({ block: 'submit' })

// Predicate matching: dynamic logic
bSync({
  waitFor: ({ type, detail }) =>
    type === 'input' && detail.value.length > 5
})

bSync({
  block: ({ type, detail }) =>
    type === 'submit' && !validateEmail(detail.email)
})
```

### State-Dependent Event Handling

Predicates can reference external state:

```typescript
let formData = { email: '', password: '' }
let hasChanges = false

const { bThreads } = behavioral()

bThreads.set({
  // Block save if no changes
  preventUnnecessarySave: bThread([
    bSync({ block: ({ type }) => type === 'save' && !hasChanges })
  ], true),

  // Block submit if email invalid
  emailValidation: bThread([
    bSync({
      block: ({ type }) =>
        type === 'submit' && !formData.email.includes('@')
    })
  ], true),

  // Block submit if password too short
  passwordValidation: bThread([
    bSync({
      block: ({ type }) =>
        type === 'submit' && formData.password.length < 8
    })
  ], true)
})
```

### Dynamic Event Filtering

Use predicates to filter events based on detail payloads:

```typescript
type ItemEvent = { id: string; action: 'add' | 'remove' | 'update' }

const watchSpecificItem = (targetId: string) =>
  bThread([
    bSync({
      waitFor: ({ type, detail }: { type: string; detail: ItemEvent }) =>
        type === 'item' && detail.id === targetId
    }),
    bSync({ request: { type: 'processItem', detail: { id: targetId } } })
  ], true)

// Create threads for specific items
bThreads.set({
  watchItem1: watchSpecificItem('item-1'),
  watchItem2: watchSpecificItem('item-2')
})

// Only watchItem1 responds to this
trigger({ type: 'item', detail: { id: 'item-1', action: 'update' } })
```

### Complex Predicate Logic

Combine multiple conditions:

```typescript
bSync({
  waitFor: ({ type, detail }) => {
    if (type !== 'purchase') return false
    if (detail.amount <= 0) return false
    if (detail.userId !== currentUser.id) return false
    if (balance < detail.amount) return false
    return true
  }
})
```

### Predicate Performance Considerations

Predicates are evaluated during the COLLECT phase for EVERY pending thread. Keep them efficient:

```typescript
// ✅ Good: Simple checks
bSync({ waitFor: ({ type }) => type === 'click' })

// ✅ Good: Direct property access
bSync({ waitFor: ({ detail }) => detail.value > 100 })

// ❌ Avoid: Expensive computations in predicates
bSync({ waitFor: ({ detail }) => expensiveValidation(detail) })

// ✅ Better: Pre-compute and reference
let isValid = false
// Update isValid in feedback handlers
bSync({ waitFor: ({ type }) => type === 'submit' && isValid })
```

## ⭐ Thread Lifecycle & Runtime Management (KEY CAPABILITY 4)

Threads can be added, removed, and inspected at runtime, enabling dynamic rule composition.

### Thread States

Threads exist in two states:

```typescript
type ThreadState = 'running' | 'pending'
```

- **Running**: Currently executing (between resume and next yield)
- **Pending**: Waiting at a sync point (after yield, before resume)

### `bThreads.set()` - Add/Replace Threads

Add threads dynamically during execution:

```typescript
const { trigger, bThreads } = behavioral()

// Add initial threads
bThreads.set({
  thread1: bThread([bSync({ request: { type: 'event1' } })])
})

// Add more threads later
bThreads.set({
  thread2: bThread([bSync({ request: { type: 'event2' } })]),
  thread3: bThread([bSync({ request: { type: 'event3' } })])
})

// Replace thread (same key)
bThreads.set({
  thread1: bThread([bSync({ request: { type: 'event1_updated' } })])
  // Old thread1 is terminated, new one starts
})
```

**Key behavior**:
- Adding with existing key terminates old thread and starts new one
- Adding with new key adds thread to running set
- Threads start immediately (enter running state)

### `bThreads.has()` - Check Thread Status

Query if a thread exists and its state:

```typescript
const { bThreads } = behavioral()

bThreads.set({
  myThread: bThread([
    bSync({ request: { type: 'start' } }),
    bSync({ waitFor: 'continue' })
  ])
})

// Check if thread exists and is running
if (bThreads.has('myThread') === 'running') {
  console.log('Thread is executing')
}

// Check if thread exists and is pending
if (bThreads.has('myThread') === 'pending') {
  console.log('Thread is waiting at sync point')
}

// Check if thread doesn't exist
if (!bThreads.has('myThread')) {
  console.log('Thread not found or completed')
}
```

**Possible return values**:
- `'running'`: Thread exists and is currently executing
- `'pending'`: Thread exists and is waiting at yield
- `false`: Thread doesn't exist (never added or already completed)

### Runtime Rule Addition Pattern

Add rules based on application state:

```typescript
const { trigger, bThreads, useFeedback } = behavioral()

let currentMode: 'basic' | 'advanced' = 'basic'

// Start with basic rules
bThreads.set({
  basicValidation: bThread([
    bSync({ block: ({ type }) => type === 'submit' && !hasRequiredFields() })
  ], true)
})

useFeedback({
  switchToAdvanced() {
    currentMode = 'advanced'

    // Add advanced rules at runtime
    bThreads.set({
      advancedValidation: bThread([
        bSync({ block: ({ type }) => type === 'submit' && !hasComplexValidation() })
      ], true),

      autoSave: bThread([
        bSync({ request: { type: 'save' } }),
        bSync({ waitFor: 'saved' })
      ], true)
    })
  },

  switchToBasic() {
    currentMode = 'basic'

    // Check if advanced threads exist before removing
    if (bThreads.has('advancedValidation')) {
      // Terminate by replacing with no-op thread that immediately completes
      bThreads.set({
        advancedValidation: bThread([]),
        autoSave: bThread([])
      })
    }
  }
})
```

### Thread Removal via Interrupt

Use `interrupt` to terminate threads based on events:

```typescript
const { trigger, bThreads } = behavioral()

bThreads.set({
  pollingThread: bThread([
    bSync({ request: { type: 'poll' } }),
    bSync({ waitFor: 'polled' })
  ], true, {
    interrupt: 'stopPolling'  // Terminates when 'stopPolling' event occurs
  })
})

// Start polling
trigger({ type: 'poll' })

// Later, stop polling
trigger({ type: 'stopPolling' })
// pollingThread is now terminated
```

### Dynamic Thread Management Example

Real-world pattern from test orchestration:

```typescript
import { behavioral, bThread, bSync } from 'plaited'

const { trigger, bThreads, useFeedback } = behavioral()

let failedTests: string[] = []
let passedTests: string[] = []
let totalTests = 10

// Start with base threads
bThreads.set({
  onCountChange: bThread([
    bSync({
      waitFor: ({ type }) => {
        const events = ['test_fail', 'test_pass']
        if (!events.includes(type)) return false

        const completed = failedTests.length + passedTests.length
        const remaining = totalTests - completed
        return remaining === 1  // Wait for second-to-last test
      }
    }),
    bSync({ request: { type: 'report' } }),
    bSync({ request: { type: 'end' } })
  ])
})

useFeedback({
  test_fail({ testName }) {
    failedTests.push(testName)

    // Dynamically add failure handler if first failure
    if (failedTests.length === 1) {
      bThreads.set({
        failFast: bThread([
          bSync({ request: { type: 'abort' } })
        ])
      })
    }
  },

  test_pass({ testName }) {
    passedTests.push(testName)
  }
})
```

## Feedback Handlers for Side Effects

BP threads coordinate events, but **side effects** (DOM updates, API calls, state mutation) happen in **feedback handlers**.

### Separation of Coordination from Effects

```typescript
const { trigger, bThreads, useFeedback } = behavioral()

// Threads: COORDINATION ONLY (no side effects)
bThreads.set({
  workflow: bThread([
    bSync({ request: { type: 'loadData' } }),
    bSync({ waitFor: 'dataLoaded' }),
    bSync({ request: { type: 'processData' } }),
    bSync({ waitFor: 'processed' }),
    bSync({ request: { type: 'saveData' } })
  ])
})

// Feedback handlers: SIDE EFFECTS ONLY
useFeedback({
  async loadData() {
    const data = await fetch('/api/data')
    trigger({ type: 'dataLoaded', detail: await data.json() })
  },

  processData({ data }) {
    const processed = transform(data)
    trigger({ type: 'processed', detail: processed })
  },

  async saveData({ data }) {
    await fetch('/api/save', { method: 'POST', body: JSON.stringify(data) })
    trigger({ type: 'saved' })
  }
})

// Start the workflow
trigger({ type: 'loadData' })
```

**Why separate?**
- Threads remain pure and testable
- Side effects are isolated and explicit
- Easy to mock feedback handlers in tests
- Clear separation of concerns

### Type-Safe Handler Mapping

Feedback handlers are type-safe based on event types:

```typescript
type Events = {
  increment: number
  decrement: number
  reset: undefined
}

const { useFeedback } = behavioral<Events>()

useFeedback({
  increment(count) {
    // count is typed as number
    console.log('Incrementing:', count)
  },

  decrement(count) {
    // count is typed as number
    console.log('Decrementing:', count)
  },

  reset() {
    // No detail parameter
    console.log('Resetting')
  }
})
```

### Async Handler Support

Feedback handlers can be async:

```typescript
useFeedback({
  async fetchUser({ userId }) {
    const response = await fetch(`/api/users/${userId}`)
    const user = await response.json()
    trigger({ type: 'userLoaded', detail: user })
  },

  async saveUser({ user }) {
    await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(user)
    })
    trigger({ type: 'userSaved' })
  }
})
```

**IMPORTANT**: The BP engine doesn't wait for async handlers. If coordination depends on async results, handlers must trigger events when complete.

### Cleanup via Disconnect

Feedback handlers return cleanup functions:

```typescript
const disconnect = useFeedback({
  tick() {
    console.log('Tick')
  },

  tock() {
    console.log('Tock')
  }
})

// Later, remove all feedback handlers
disconnect()
```

## Snapshot Observation

`useSnapshot` provides visibility into the BP engine's decision-making process after each super-step.

### SnapshotMessage Structure

```typescript
type SnapshotMessage = {
  candidates: Array<{
    type: string
    detail?: unknown
    priority: number
  }>
  blocking: string[]
  selected: {
    type: string
    detail?: unknown
    priority: number
  } | null
}
```

### Observing Program State

```typescript
import { behavioral, bThread, bSync } from 'plaited'

const { trigger, bThreads, useSnapshot } = behavioral()

// Register snapshot observer
useSnapshot((snapshot) => {
  console.table({
    'Candidates': snapshot.candidates.map(c => c.type).join(', '),
    'Blocking': snapshot.blocking.join(', '),
    'Selected': snapshot.selected?.type ?? 'none'
  })
})

bThreads.set({
  thread1: bThread([bSync({ request: { type: 'event1' } })]),
  thread2: bThread([bSync({ request: { type: 'event2' } })]),
  blocker: bThread([bSync({ block: 'event2' })])
})

// Snapshot after this super-step:
// {
//   candidates: [
//     { type: 'event1', priority: 1 },
//     { type: 'event2', priority: 2 }
//   ],
//   blocking: ['event2'],
//   selected: { type: 'event1', priority: 1 }
// }
```

### Use Cases for Snapshot Observation

1. **Debugging**: Understand why events are blocked or selected
2. **Visualization**: Display program state in dev tools
3. **Testing**: Verify thread coordination logic
4. **Learning**: Observe how threads interact

## Non-UI Use Cases

BP is a general coordination mechanism, not limited to UI:

### Test Orchestration

From `src/workshop/use-runner.ts`:

```typescript
import { behavioral, bThread, bSync } from 'plaited'

const { trigger, bThreads, useFeedback } = behavioral()

let failedTests: string[] = []
let passedTests: string[] = []
let stories = new Set(['story1', 'story2', 'story3'])

bThreads.set({
  onCountChange: bThread([
    bSync({
      waitFor: ({ type }) => {
        const events = ['test_fail', 'test_pass']
        if (!events.includes(type)) return false
        const completed = failedTests.length + passedTests.length
        const remaining = stories.size - completed
        return remaining === 1
      }
    }),
    bSync({ request: { type: 'report' } }),
    bSync({ request: { type: 'end' } })
  ], true)
})

useFeedback({
  test_fail({ testName }) {
    failedTests.push(testName)
  },

  test_pass({ testName }) {
    passedTests.push(testName)
  },

  report() {
    console.log('Test Report:')
    console.log('Passed:', passedTests.length)
    console.log('Failed:', failedTests.length)
  },

  end() {
    process.exit(failedTests.length > 0 ? 1 : 0)
  }
})

// Trigger test events
trigger({ type: 'test_pass', detail: { testName: 'story1' } })
trigger({ type: 'test_fail', detail: { testName: 'story2' } })
trigger({ type: 'test_pass', detail: { testName: 'story3' } })
// 'report' and 'end' events automatically triggered
```

### Game Logic Coordination

Tic-Tac-Toe (see Rule Composition Patterns section above).

### Workflow Coordination

Multi-step business process:

```typescript
const { trigger, bThreads, useFeedback } = behavioral()

bThreads.set({
  orderWorkflow: bThread([
    bSync({ request: { type: 'validateOrder' } }),
    bSync({ waitFor: 'orderValid' }),
    bSync({ request: { type: 'processPayment' } }),
    bSync({ waitFor: 'paymentProcessed' }),
    bSync({ request: { type: 'shipOrder' } }),
    bSync({ waitFor: 'orderShipped' }),
    bSync({ request: { type: 'notifyCustomer' } })
  ]),

  // Concurrent fraud detection
  fraudCheck: bThread([
    bSync({ waitFor: 'processPayment' }),
    bSync({ request: { type: 'checkFraud' } }),
    bSync({ waitFor: 'fraudChecked' }),
    bSync({
      block: ({ type }) => type === 'shipOrder' && isFraudulent
    })
  ])
})

useFeedback({
  validateOrder({ order }) {
    const isValid = validateOrderData(order)
    trigger({ type: 'orderValid', detail: { isValid } })
  },

  async processPayment({ order }) {
    await paymentGateway.charge(order.total)
    trigger({ type: 'paymentProcessed' })
  },

  async checkFraud({ order }) {
    const result = await fraudService.check(order)
    isFraudulent = result.isFraudulent
    trigger({ type: 'fraudChecked', detail: result })
  },

  shipOrder({ order }) {
    shippingService.createShipment(order)
    trigger({ type: 'orderShipped' })
  },

  notifyCustomer({ order }) {
    emailService.send(order.email, 'Order confirmed!')
  }
})
```

### Resource Management

Connection pool coordination:

```typescript
const MAX_CONNECTIONS = 5
let activeConnections = 0

const { trigger, bThreads, useFeedback } = behavioral()

bThreads.set({
  connectionLimit: bThread([
    bSync({
      block: ({ type }) => type === 'acquireConnection' && activeConnections >= MAX_CONNECTIONS
    })
  ], true)
})

useFeedback({
  acquireConnection({ requestId }) {
    activeConnections++
    console.log(`Connection acquired: ${activeConnections}/${MAX_CONNECTIONS}`)
    // Provide connection to requester
  },

  releaseConnection({ requestId }) {
    activeConnections--
    console.log(`Connection released: ${activeConnections}/${MAX_CONNECTIONS}`)
  }
})
```

### Protocol Implementation

State machine via BP threads:

```typescript
type State = 'idle' | 'connecting' | 'connected' | 'disconnected'
let state: State = 'idle'

const { trigger, bThreads } = behavioral()

bThreads.set({
  stateTransitions: bThread([
    // Idle → Connecting
    bSync({ waitFor: 'connect' }),
    bSync({ request: { type: 'connecting' } }),

    // Connecting → Connected
    bSync({ waitFor: 'connectionEstablished' }),
    bSync({ request: { type: 'connected' } }),

    // Connected → Disconnected
    bSync({ waitFor: 'disconnect' }),
    bSync({ request: { type: 'disconnected' } })
  ]),

  preventInvalidTransitions: bThread([
    // Can't connect when already connected
    bSync({ block: ({ type }) => type === 'connect' && state === 'connected' }),

    // Can't disconnect when not connected
    bSync({ block: ({ type }) => type === 'disconnect' && state !== 'connected' })
  ], true)
})

useFeedback({
  connecting() {
    state = 'connecting'
  },

  connected() {
    state = 'connected'
  },

  disconnected() {
    state = 'disconnected'
  }
})
```

## Summary: BP for Neuro-Symbolic AI

The four key capabilities make BP ideal for Neuro-symbolic AI rule composition:

1. **⭐ Event Selection Strategy**: Priority-based selection with blocking precedence enables hierarchical rule systems
2. **⭐ Rule Composition Patterns**: Additive composition allows AI to add rules without modifying existing behavior
3. **⭐ Predicate-Based Event Matching**: Dynamic, state-dependent matching enables context-aware rules
4. **⭐ Thread Lifecycle & Runtime Management**: Runtime rule addition/removal enables adaptive behavior

**Next Steps**:
- See `b-element.md` for UI integration
- See `cross-island-communication.md` for coordination patterns
- See `form-associated-elements.md` for intent capture
