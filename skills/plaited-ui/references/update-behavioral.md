# Dynamic Behavioral Code Loading

## Overview

`update_behavioral` is the supported path for loading new client behavior after
initial page load.

It exists because scripts inserted through fragment parsing APIs like
`innerHTML` or `setHTMLUnsafe` are inert. Dynamic client logic must be loaded
through `import(url)`.

## Flow

```mermaid
sequenceDiagram
    participant Agent as Server Agent
    participant WS as WebSocket
    participant Controller as controller()
    participant Browser as Browser Runtime
    participant BP as BP Engine

    Agent->>WS: update_behavioral with module URL
    WS->>Controller: validated message
    Controller->>Browser: await import(url)
    Browser-->>Controller: module.default
    Controller->>Controller: install useUIModule(...) OR legacy compat factory
    Controller->>Controller: validate return value
    Controller->>BP: merge threads/handlers + declared actions metadata
```

## Module Contract

Preferred contract:

- default export from `useUIModule(name, callback)`
- callback receives listener-first helpers (`local`, `external`, `action`,
  wrapped `bSync`, wrapped `bThread`, wrapped `emit`, wrapped `addThreads`)
- callback returns optional `threads` and optional local-only `handlers`
- `action(schema)` declarations become explicit local p-trigger routing metadata

Legacy compatibility (temporary):

- raw `(trigger) => { threads?, handlers?, actions? }` module factories still load
- local p-trigger routing only uses explicit `actions` metadata in this path

Both contracts are validated before merging into the client BP engine.

Result fields:

- optional `threads`
- optional `handlers`
- optional `actions` (explicit p-trigger local routing interest)

## Operational Notes

- merge is silent; there is no explicit success acknowledgement
- observe success through subsequent behavior or snapshots
- import or schema failures surface through the controller/BP error path
- legacy compatibility installs emit `module_warning` snapshots to make migration
  explicit
