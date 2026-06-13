# WebSocket Architecture Decisions

## Overview

This reference captures the high-level decisions behind Plaited's UI WebSocket
layer.

## Key Decisions

### Single endpoint with scoped routing

Use a single WebSocket endpoint and scope messages logically rather than
multiplying transport endpoints. Controller islands connect to `/ws` and use
their `p-topic` value as the WebSocket subprotocol/topic.

### SSR is truth

The initial SSR HTML is the current state. WebSocket traffic applies deltas; it
does not re-hydrate a separate client state model. Server messages update
island-local `p-target` elements through `render` and `attrs`.

### Controller-owned reconnect behavior

Reconnect and retry logic belongs in the controller island layer, not a service
worker. Retry is bounded and triggered only for configured close codes.

### Session via cookie

Session identity should be carried through normal server-side session handling,
not URL parameters.

### Replay buffer for short disconnects

Use bounded replay where needed for reconnects instead of treating the socket as
the only source of truth. The browser controller should stay stateless enough
that the server can re-render the island when needed.

### Defense in depth

Protect the UI transport with:

- template escaping
- CSP
- origin validation
- cookie/session discipline

### JSON protocol

The payload is dominated by HTML strings, so human-readable JSON remains a good
tradeoff.

### Small browser controller

The browser controller should validate protocol messages, mutate island-local
DOM, load local controller modules, and report BP-shaped events. Server/agent
code remains the control center.

## Message Shape

Server to browser:

- `render`
- `attrs`
- `import`
- `disconnect`

Browser to server top-level envelopes:

- `ui_event`
- `error`

`ui_event.detail` is a BP event. Its `type` can be a `p-trigger` action,
an imported module event, or controller lifecycle events such as
`import_invoked`. `import_invoked` is not accepted as a top-level WebSocket
message by `ClientMessageSchema`; it is sent inside `ui_event`.

## Security Focus

Important protections include:

- `connect-src 'self'`
- origin validation at upgrade
- HttpOnly + SameSite cookies
- no client-side secrets for session auth
- site-root `.js` import paths for controller modules
- schema validation on both server-originated and browser-originated messages
