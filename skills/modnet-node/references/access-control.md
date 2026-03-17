# Access Control

Implementation details for identity, authentication, and access control between modnet nodes. Design rationale is in `docs/MODNET-IMPLEMENTATION.md`. Trust store implementation is in `src/a2a/peers.ts`.

## Identity & Authentication

The framework does not define its own identity system. A2A handles authentication at the protocol layer via standard web security mechanisms. The framework adds a trust layer on top.

**What A2A provides:**

| Mechanism | What it does |
|---|---|
| **Agent Card signing (JWS)** | Card is signed with the node's private key. Any peer can verify the card is authentic and untampered. |
| **Security schemes** | Each card declares its required auth via `securitySchemes` — mTLS, OAuth 2.0, API key, HTTP Bearer, or OpenID Connect. Peers read the card to discover what's required. |
| **Extended Agent Card** | Authenticated peers call `get-extended-agent-card` to see additional capabilities. The public card shows broad strokes; the extended card shows detail. |

**What the framework adds:**

| Mechanism | What it does |
|---|---|
| **Known-peers table** | Local trust store — records which peers the owner has approved. Trust-on-first-use (TOFU), like SSH `known_hosts`. |
| **Owner approval** | First connection to a new peer requires owner confirmation (human in the loop). Subsequent connections verify automatically against stored keys. |
| **Access control** | After authentication, BP evaluates every request via DAC + MAC + ABAC (see below). |

## Known-Peers Schema

```sql
CREATE TABLE known_peers (
  public_key  TEXT PRIMARY KEY,   -- the peer's public key (from their Agent Card)
  card_url    TEXT,               -- where to fetch their Agent Card
  name        TEXT,               -- human-readable label
  trust_level TEXT NOT NULL,      -- 'tofu' | 'verified' | 'blocked'
  first_seen  INTEGER NOT NULL,   -- when we first connected
  last_seen   INTEGER             -- last successful interaction
);
```

## First Connection Flow (TOFU)

```
Node B fetches Node A's Agent Card from well-known URL
  → Verifies JWS signature (card is authentic)
  → Reads securitySchemes (e.g., mTLS required)
  → Node B's owner sees: "New peer: Node A. Approve?"
  → Owner approves → public key stored in known-peers
  → mTLS handshake completes (both sides verified)
  → Subsequent connections verify automatically
```

For sovereign nodes in a modnet, **mTLS is the natural fit** — both sides prove identity, no third party needed. For team deployments behind a shared auth server, OAuth 2.0 works. The framework is auth-scheme-agnostic — it reads whatever the peer's card declares.

## DAC + MAC + ABAC Implementation

**BP is the single policy engine.** The same `block` predicates that govern local tool execution govern inter-agent module sharing:

```typescript
bSync({
  block: ({ type, detail }) => {
    if (type !== 'share_module') return false
    const mod = getModule(detail.moduleId)
    const requester = detail.requesterCard

    // MAC: constitution blocks credentials regardless of owner setting
    if (mod.contentType === 'credentials') return true

    // DAC: owner's boundary decision
    if (mod.boundary === 'none') return true

    // ABAC: evaluate requester attributes when boundary is 'ask'
    if (mod.boundary === 'ask') {
      return !evaluatePolicy(requester, mod, detail.context)
    }

    return false
  }
})
```

**How the layers compose:**

```
Owner sets boundary: "all"
  → DAC: approved
  → MAC (constitution): blocks sharing of credentials module (mandatory)
  → Result: everything shared EXCEPT what the constitution protects

Owner sets boundary: "ask" + approves peer
  → DAC: approved
  → MAC: no mandatory block
  → ABAC: evaluates peer's card attributes against module boundary policy
  → Result: shared if attributes match policy

Owner sets boundary: "none"
  → DAC: blocked
  → No further evaluation needed
```

The MAC layer uses the same ratchet principle as the local constitution — mandatory bThreads only add, never remove. The security floor only rises.

## Payment (x402)

[x402](https://github.com/coinbase/x402) layers directly on HTTP via the `402 Payment Required` status code. Since A2A uses HTTP as its transport, x402 composes without a protocol bridge:

```
Agent A sends A2A request to Agent B
  → B evaluates access control (DAC + MAC + ABAC)
  → B determines this service requires payment
  → B returns HTTP 402 with x402 payment requirements header
  → A receives 402 → trigger({ type: 'payment_required', detail })
  → A's BP blocks until owner confirms payment
  → Owner approves → payment executes on-chain
  → A retries request with payment proof header
  → B verifies payment → processes request → returns result
```

**Payment is bidirectional.** A node can both charge for its services (selling) and pay for others' services (buying). The same agent that charges for module generation might pay another agent for specialized training data or domain knowledge.

**Payment as ABAC attribute.** In the access control model, payment status becomes another attribute the ABAC layer evaluates:

```typescript
bSync({
  block: ({ type, detail }) => {
    if (type !== 'share_module') return false
    const mod = getModule(detail.moduleId)

    // ABAC: module requires payment and payment not verified
    if (mod.boundary === 'paid' && !detail.paymentVerified) return true

    return false
  }
})
```

### Boundary Taxonomy

| Boundary | Meaning |
|---|---|
| `all` | Share freely |
| `ask` | Evaluate requester attributes |
| `paid` | Requires verified x402 payment |
| `none` | Never share |

**Owner approval maps to existing patterns.** The `payment_required` event follows the same human-in-the-loop flow as any other BP-gated action. No new approval mechanism needed — it's the same `trigger()` → bThread → owner confirmation flow used everywhere else.

## Inter-Agent Task Flow

When Agent A wants to work with Agent B's module:

1. **A sends a task** via A2A SendMessage — "I need validation for these form fields"
2. **A's BP evaluates the outbound request** — authority constraints, boundary checks
3. **B receives the task** — B's BP evaluates the inbound request via access control layers (DAC + MAC + ABAC)
4. **B's module processes internally** — the module is never exposed
5. **B returns artifacts** via streaming — generated code, validation result, whatever the module produces
6. **A receives artifacts** — SSE events become `trigger()` calls, bThreads process results

For **module transfer** (sending the module itself, not just output) — a higher-trust operation. Both agents' BP engines must approve: B's outbound sharing policy and A's inbound installation policy. Owner confirmation required on both sides.
