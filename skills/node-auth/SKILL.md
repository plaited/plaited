---
name: node-auth
description: Generate authentication code for Plaited server nodes. Covers WebAuthn passkeys (sovereign/local), JWT verification (hosted platform), OIDC tokens (enterprise SSO), and dev-mode bypass. Activated when wiring createServer with session validation or setting up node authentication.
license: ISC
compatibility: Requires bun
---

# Node Auth

## Purpose

This skill teaches coding agents how to generate authentication code for Plaited server nodes. The framework provides a `validateSession` seam on `createServer` — this skill fills that seam based on the deployment context.

**Use when:**
- Setting up a new node that needs authentication
- Wiring `createServer` with `validateSession`
- A user asks "how do users authenticate to this node?"
- Generating auth routes for any deployment scenario

**Not for:** Authentication between agents (that's A2A mTLS — see `skills/modnet-node/` [access-control.md](../modnet-node/references/access-control.md)).

## The Seam

The framework's only auth surface is one optional parameter on `createServer`:

```typescript
createServer({
  trigger,
  routes: { ...authRoutes, ...appRoutes },
  validateSession: (sessionId: string) => boolean,  // ← the seam
})
```

`validateSession` is required. WebSocket upgrades are rejected with `session_invalid` (401) if it returns `false` for the `sid` cookie value. For dev mode, pass `() => true`.

## Decision: Deployment Context

Before generating auth code, determine the deployment context:

| Who connects to this node? | Strategy | Reference |
|---------------------------|----------|-----------|
| **User directly** (sovereign node, local dev server) | WebAuthn passkeys | [webauthn-sovereign.md](references/webauthn-sovereign.md) |
| **Control plane** (hosted platform, cloud sandbox) | JWT verification | [platform-jwt.md](references/platform-jwt.md) |
| **SSO gateway** (enterprise private network) | OIDC token verification | [oidc-enterprise.md](references/oidc-enterprise.md) |
| **Developer on localhost** (development/testing) | Auto-session or no auth | [dev-mode.md](references/dev-mode.md) |

If the context is unclear, ask the user.

## Common Contract

All auth strategies return the same shape:

```typescript
type AuthStrategy = {
  routes: ServeRoutes
  isValidSession: (sessionId: string) => boolean
  destroy: () => void
}
```

Wire into `createServer`:

```typescript
const auth = await createAuth(options)  // strategy-specific factory
const server = createServer({
  trigger,
  routes: { ...auth.routes, ...appRoutes },
  validateSession: auth.isValidSession,
})
```

`destroy()` cleans up timers and in-memory stores. Call it on server shutdown.

## Reference Implementations

Full working implementations are in `assets/`:

- **[assets/webauthn-auth.ts](assets/webauthn-auth.ts)** — Complete WebAuthn passkey auth (registration + login flows)
- **[assets/webauthn-schemas.ts](assets/webauthn-schemas.ts)** — Zod schemas for credential storage
- **[assets/webauthn-auth-spec.reference.ts](assets/webauthn-auth-spec.reference.ts)** — Integration tests with mock verification

These are reference code the agent should **adapt** to the project, not import directly. The agent copies and modifies what's needed.

## Related Skills

- **generative-ui** — The UI that the authenticated user sees
- **behavioral-core** — BP engine the server bridges to
