---
name: node-auth
description: Authentication seam for Plaited nodes. Use when wiring the current server auth boundary, choosing among WebAuthn, platform JWT, enterprise OIDC, or dev-mode auth, or supplying auth facts to factory research lanes.
license: ISC
compatibility: Requires bun
---

# Node Auth

## Purpose

This skill is a slim implementation-context reference for the current server
auth seam.

Use it to decide which auth mode applies and how to wire the existing auth
boundary in code. Treat bundle-level auth policy as research work for
`dev-research/node-auth-factories/program.md`.

**Use when:**
- wiring `createServer` with `validateSession`
- choosing among sovereign/local, platform, enterprise, or dev auth modes
- generating or reviewing auth routes for a concrete deployment context
- supplying stable auth facts to A2A or three-axis factory research

**Not for:** deciding the full default auth-aware factory bundle. That belongs
in `dev-research/node-auth-factories/program.md`.

## The Seam

The framework's only auth surface is one optional parameter on `createServer`:

```typescript
createServer({
  trigger,
  routes: { ...authRoutes, ...appRoutes },
  validateSession: (sessionId: string) => boolean,  // ← the seam
})
```

`validateSession` is the stable seam. WebSocket upgrades are rejected with
`session_invalid` (401) if it returns `false` for the `sid` cookie value. For
dev mode, pass `() => true`.

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

- **modnet-factories** — node/A2A/module composition context for current
  factory-era architecture
- **behavioral-core** — BP engine the server bridges to
