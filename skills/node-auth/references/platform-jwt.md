# Platform JWT Auth

For nodes running inside a hosted platform where a control plane handles user authentication.

## When to Use

- Node runs in a cloud sandbox (Modal, RunPod, Kubernetes)
- A control plane (Cloudflare Workers, Vercel Edge, etc.) sits between the user and the node
- The control plane authenticates the user and forwards requests with a signed JWT
- The node just needs to verify the JWT is valid and extract the user identity

## No Browser Auth Needed

The node never faces the user directly. The control plane handles:
- User login (email/password, SSO, etc.)
- Session management
- Routing authenticated requests to the correct agent sandbox

The node receives requests that are already authenticated. It only needs to verify the token.

## Architecture

```
User → Control Plane (authenticates) → Node (verifies JWT)
```

1. Control plane authenticates user via its own auth (email/password, SSO, etc.)
2. Control plane creates a JWT signed with a shared secret or RSA key
3. Control plane sends the JWT in an auth header or connection grant
4. Node's `authenticateConnection` decodes and verifies the JWT

## Implementation Pattern

```typescript
import { createServerFactory, SERVER_FACTORY_EVENTS } from 'plaited/factories'

// Shared secret between control plane and node
// Set via environment variable, never hardcoded
const JWT_SECRET = Bun.env.JWT_SECRET

const authenticateConnection = async ({ request }) => {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return null

    // Use crypto.subtle for HMAC verification, or `jose` for RSA/EC
    const payload = verifyJWT(token, JWT_SECRET)
    if (!payload || payload.exp <= Date.now() / 1000) return null

    return {
      principalId: payload.sub,
      connectionId: crypto.randomUUID(),
      capabilities: ['observe', 'control'],
    }
  } catch {
    return null
  }
}

const serverFactory = createServerFactory()

agent.trigger({
  type: SERVER_FACTORY_EVENTS.server_set_config,
  detail: {
    routes: {},  // No auth routes needed — control plane handles login
    authenticateConnection,
  },
})
```

## Dependencies

For HMAC-SHA256 (shared secret): none — use `crypto.subtle` built into Bun.

For RSA/EC (asymmetric keys): consider `jose` library.

```bash
bun add jose  # Only if using asymmetric keys
```

## Routes

Typically **none**. The control plane handles all auth UI and token issuance. The node only verifies.

If the node needs a health/status endpoint:

| Route | Method | Purpose |
|-------|--------|---------|
| `/health` | GET | Returns 200 for control plane health checks |

## Key Considerations

- **Secret rotation**: Support checking against both current and previous secret for zero-downtime rotation
- **Token expiry**: JWT `exp` claim should be short-lived (5-15 minutes) since the control plane can issue new ones
- **No session store needed**: JWT is self-contained — `authenticateConnection` is stateless verification
- **`destroy()` is a no-op**: No timers or stores to clean up
