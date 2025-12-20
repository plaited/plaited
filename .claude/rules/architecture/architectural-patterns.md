# Key Architectural Patterns

## Event Flow Architecture

```
External Trigger → bProgram → Event Selection → Thread Notification → Feedback Handlers
                     ↑                              ↓
                  b-threads ←─────────────────── State Updates
```

## Template Lifecycle

1. Element defined with `bElement`
2. Shadow DOM created with template
3. `bProgram` initialized with threads
4. Elements bound via `p-target` attributes
5. Event triggers connected via `p-trigger`
6. Reactive updates through helper methods

## Signal Pattern

- `useSignal`: Creates reactive state containers
- `useComputed`: Derived state with automatic updates
- Signals integrate with PlaitedTrigger for automatic cleanup
