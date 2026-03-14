# OIDC Enterprise Auth

For nodes in enterprise private networks where users authenticate via SSO (Okta, Azure AD, Google Workspace).

## When to Use

- Enterprise deployment with existing identity provider
- Users authenticate via corporate SSO
- Node receives OIDC tokens from an SSO gateway or reverse proxy
- Compliance requires audit logging of auth events

## Architecture

```
User → SSO Gateway (Okta/Azure AD) → Node (verifies OIDC token)
```

Two sub-patterns:

**A. Gateway-issued token** — An SSO-aware reverse proxy (e.g., OAuth2 Proxy, Cloudflare Access) sits in front of the node. It handles the OIDC flow and sets a signed cookie/header.

**B. Direct OIDC** — The node itself implements the OIDC callback flow (more complex, less common for agent nodes).

Pattern A is recommended. The node just verifies tokens, like the JWT pattern.

## Implementation Pattern (Gateway-Issued Token)

```typescript
import { createServer } from 'plaited'

// OIDC discovery endpoint for your IdP
const ISSUER = Bun.env.OIDC_ISSUER  // e.g., 'https://acme.okta.com'
const AUDIENCE = Bun.env.OIDC_AUDIENCE

// Fetch JWKS from discovery endpoint on startup
const jwks = await fetchJWKS(`${ISSUER}/.well-known/openid-configuration`)

const validateSession = (sessionId: string): boolean => {
  try {
    const payload = verifyOIDCToken(sessionId, jwks, { issuer: ISSUER, audience: AUDIENCE })
    return payload !== null
  } catch {
    return false
  }
}

const server = createServer({
  trigger,
  routes: {},
  validateSession,
})
```

## Dependencies

```bash
bun add jose  # For JWKS fetching and JWT verification
```

## Key Considerations

- **JWKS caching**: Fetch the JWKS (JSON Web Key Set) on startup, refresh periodically (hourly) or on verification failure
- **Issuer validation**: Always verify the `iss` claim matches your expected IdP
- **Audience validation**: Verify the `aud` claim matches your node's client ID
- **Token refresh**: OIDC tokens are typically short-lived; the gateway handles refresh transparently
- **Group claims**: Enterprise IdPs often include group memberships in the token — useful for access control
- **Audit trail**: Log auth events (token verification success/failure) for compliance
