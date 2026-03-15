# WebAuthn Sovereign Auth

For nodes where the user connects directly — sovereign modnet nodes and local dev servers.

## When to Use

- The node IS the thing the user interacts with (no control plane in between)
- Single-tenant: one owner per node
- The owner has a device with WebAuthn support (biometric, hardware key)

## Dependency

```bash
bun add @simplewebauthn/server
```

This dep is added by the agent when generating auth — it is NOT a framework dependency.

## Architecture

1. **First visit** — no owner registered. Client POSTs to `/auth/register/options` with `{ userName }`.
2. **Claim the node** — server generates registration options, client completes WebAuthn ceremony, POSTs attestation to `/auth/register/verify`. First person to complete this becomes the owner.
3. **Subsequent visits** — owner logs in via `/auth/login/options` + `/auth/login/verify`.
4. **Second passkey** — requires an authenticated session (prevents hijacking).

## Routes

| Route | Method | Auth Required | Purpose |
|-------|--------|--------------|---------|
| `/auth/status` | GET | No | Returns `{ ownerExists, authenticated }` |
| `/auth/register/options` | POST | No (first) / Yes (add passkey) | Generates registration challenge |
| `/auth/register/verify` | POST | Has `sid` cookie | Verifies attestation, creates owner |
| `/auth/login/options` | POST | No | Generates authentication challenge |
| `/auth/login/verify` | POST | Has `sid` cookie | Verifies assertion, creates session |

## Internal Stores

- **challengeStore** — `Map<sid, { challenge, userName?, createdAt }>` — ephemeral, purged by timer
- **sessionStore** — `Map<sid, { userId, createdAt }>` — in-memory authenticated sessions
- **owner** — `OwnerRecord | null` — loaded from JSON file on init, saved on mutation

## Cookie Settings

`sid={uuid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400` + `Secure` when TLS.

## Credential File

Persisted to a configurable path (default `.auth/credentials.json`):

```json
{
  "owner": {
    "userId": "base64url-encoded-random-id",
    "userName": "owner-name",
    "credentials": [
      {
        "id": "credential-id",
        "publicKey": "base64url-encoded-public-key",
        "counter": 0,
        "transports": ["internal"],
        "createdAt": "2026-03-14T..."
      }
    ],
    "createdAt": "2026-03-14T..."
  }
}
```

`publicKey` is stored as base64url string. Convert via `isoBase64URL.toBuffer()` / `isoBase64URL.fromBuffer()` from `@simplewebauthn/server/helpers` before passing to verification functions.

## Testing

WebAuthn ceremonies require a real authenticator — not available in Bun's test runner. Use test-only verification overrides:

```typescript
const auth = await createAuthRoutes({
  rpName: 'Test',
  rpID: 'localhost',
  expectedOrigin: 'http://localhost',
  _verifyRegistration: async () => ({ verified: true, registrationInfo: { ... } }),
  _verifyAuthentication: async () => ({ verified: true, authenticationInfo: { ... } }),
})
```

See [assets/webauthn-auth-spec.reference.ts](../assets/webauthn-auth-spec.reference.ts) for complete test patterns.

## Unclaimed Window Mitigation

Between node startup and first registration, anyone can claim the node. For localhost this is acceptable (trust the network boundary). For internet-facing sovereign nodes, consider:

- Generate a one-time claim token at startup, print to stdout
- Require the token as a field in the first `/auth/register/options` request
- Or restrict `/auth/register/options` to localhost-only until first claim
