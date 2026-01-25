# Loops

> Two connected base dynamics - action and response

## Definition

**A loop is two connected base dynamics: a user action and a system response.**

Loops are the fundamental unit of interaction. Every meaningful interaction completes a loop - if there's no response, the user doesn't know if their action worked.

## Loop Type Contract

```typescript
/** Base dynamic - one directional transfer */
type BaseDynamic = {
  source: 'user' | 'object' | 'system'
  target: 'user' | 'object' | 'system'
  channel: Channel
}

/** Loop - action + response */
type Loop = {
  action: string           // Event type that starts the loop
  response: string         // Event type that completes the loop
  feedbackModality?: 'visual' | 'audio' | 'haptic' | 'multi'
}
```

## Loop Composition

```
Action (Base Dynamic 1)     Response (Base Dynamic 2)
─────────────────────────   ─────────────────────────
User clicks button    →     System updates display
User types input      →     System validates field
User selects option   →     System filters results
```

## In Plaited

Every `p-trigger` starts a loop. The handler completes it.

```typescript
// LOOP: click → increment → display update
bProgram({ $, trigger }) {
  let count = 0

  return {
    // Action: DOM event triggers BP event
    clickIncrement() {
      trigger({ type: 'increment' })
    },

    // Response: BP event completes loop with feedback
    increment() {
      count++
      $('display')[0]?.render(<>{count}</>)  // Loop complete
    }
  }
}
```

### Explicit Loop Pattern

```typescript
// Template declares the action
<button p-trigger={{ click: 'clickIncrement' }}>+</button>
<span p-target="display">0</span>

// Handler completes the loop
clickIncrement() { trigger({ type: 'increment' }) }  // Action
increment() { $('display')[0]?.render(<>{count}</>) }  // Response
```

## Loop Types

### User → System → User

Most common. User acts, system responds with feedback to user.

```typescript
// User clicks → System increments → User sees new value
clickIncrement() { trigger({ type: 'increment' }) }
increment() {
  count++
  $('display')[0]?.render(<>{count}</>)
}
```

### User → Object → System

User acts on object, object notifies system.

```typescript
// User types → Input captures → System validates
inputChange(e: InputEvent) {
  const value = (e.target as HTMLInputElement).value
  trigger({ type: 'validate', detail: { value } })
}
validate({ value }) {
  const isValid = checkValidity(value)
  $('error')[0]?.attr('hidden', isValid)
}
```

### System → User (Notification)

System initiates, user receives.

```typescript
// System detects → User notified
onConnected() {
  websocket.onmessage = (msg) => {
    trigger({ type: 'notify', detail: msg.data })
  }
}
notify({ message }) {
  $('notification')[0]?.render(<>{message}</>)
}
```

## Feedback Modalities

How the response is perceived:

| Modality | Implementation | Example |
|----------|---------------|---------|
| **Visual** | DOM render/attr | Counter display updates |
| **Audio** | Web Audio API | Click sound, notification tone |
| **Haptic** | Vibration API | Mobile feedback |
| **Multi** | Combined | Visual + audio confirmation |

```typescript
// Multi-modal feedback
async submit() {
  // Visual feedback
  $('button')[0]?.attr('disabled', true)
  $('status')[0]?.render(<>Submitting...</>)

  // Audio feedback (if available)
  if ('AudioContext' in window) {
    playConfirmationTone()
  }

  // Complete the action
  await performSubmit()

  // Final feedback
  $('status')[0]?.render(<>Done!</>)
}
```

## Loop Validation via bThreads

bThreads can enforce loop completion:

```typescript
// Ensure every action gets a response
const enforceLoopCompletion = bThread([
  bSync({ waitFor: ({ type }) => type.startsWith('click') }),  // Action
  bSync({
    waitFor: ({ type }) => type === 'render' || type === 'update',  // Response
    block: ({ type }) => type.startsWith('click')  // Block new action until response
  })
], true)
```

## In Plaited Training

When extracting structural metadata, identify loops:

```typescript
type StructuralMetadata = {
  loops: Loop[]
  // ... other fields
}

// Detection:
// - p-trigger attribute → action event
// - Corresponding handler → action handler
// - render/attr call in handler → response
// - Feedback modality from API usage
```

### Example Extraction

```typescript
// From this bElement:
<button p-trigger={{ click: 'increment' }}>+</button>
// ...
increment() { $('display')[0]?.render(<>{count}</>) }

// Extract:
{
  loops: [{
    action: 'click',
    response: 'increment',
    feedbackModality: 'visual'
  }]
}
```

## Key Questions

When designing a pattern, ask:
1. What action starts the loop?
2. What response completes the loop?
3. What modality communicates the response?
4. Is the loop enforced (via bThread)?

## Related

- [objects.md](objects.md) - What loops act upon
- [channels.md](channels.md) - Information flowing through loops
- [levers.md](levers.md) - How levers shape loop experience
- [blocks.md](blocks.md) - How loops compose into modules
