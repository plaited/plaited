# WebSocket Architecture Decisions

## Overview

This reference captures the high-level decisions behind Plaited's UI WebSocket
layer.

## Key Decisions

### Single endpoint with scoped routing

Use a single WebSocket endpoint and scope messages logically rather than
multiplying transport endpoints.

### SSR is truth

The initial SSR HTML is the current state. WebSocket traffic applies deltas; it
does not re-hydrate a separate client state model.

### Controller-owned reconnect behavior

Reconnect and retry logic belongs in the controller layer, not a service worker.

### Session via cookie

Session identity should be carried through normal server-side session handling,
not URL parameters.

### Replay buffer for short disconnects

Use bounded replay where needed for reconnects instead of treating the socket as
the only source of truth.

### Defense in depth

Protect the UI transport with:

- template escaping
- CSP
- origin validation
- cookie/session discipline

### JSON protocol

The payload is dominated by HTML strings, so human-readable JSON remains a good
tradeoff.

## Security Focus

Important protections include:

- `connect-src 'self'`
- origin validation at upgrade
- HttpOnly + SameSite cookies
- no client-side secrets for session auth
