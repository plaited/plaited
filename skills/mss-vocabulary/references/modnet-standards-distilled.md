# Modnet Standards — Distilled for MSS

Distilled from Rachel Jaffe's *Past the Internet: The Emergence of the Modnet* (Modnet.md, 454 lines). Only actionable bridge-code rules and module patterns are extracted here.

## Core Concept

A **module** is a self-contained unit of front-end + back-end code where individuals own their data. Modules carry **bridge-code** — five MSS tags — that enable them to connect to other modules and form **modular networks (modnets)** without centralized platforms.

Key properties:
- Modules are **individually owned** (not platform-owned)
- Data updates in one place propagate to **all connected networks**
- Disconnecting from a network removes data from that network (no lock-in)
- Platform death does not mean data loss

## MSS Bridge-Code Tags (Modnet Design Standards)

### contentType
- Keyword identifying the module's domain
- Modules with same contentType can be manipulated together
- When modules connect to a block, same-contentType modules auto-group
- Example: all `#produce` modules form a list; all `#art` modules form a portfolio

### structure
- Shared identifier for the module's information organization
- Refers to the Structural IA vocabulary (list, collection, pool, stream, etc.)
- Modules of same structure type can also be manipulated together
- A block pattern can specify "accepts structure type `list`" — matching modules auto-populate

### mechanics
- Cross-cutting dynamics that **auto-populate** based on connected structures
- A module declares mechanic *capability* via tags (e.g., `mec.vote`)
- The mechanic UI only appears when connected to a structure that uses it
- **Bottom-up:** child module data can inherit mechanics from parent (food items → health tracking overlay)
- **Top-down:** parent structure can apply mechanics to child modules (urban planner density map over farmer stalls)

### boundary
- What information is shared between modules
- Four values: `all` | `none` | `ask` | `paid`
- Controls both: what flows OUT to larger networks, what flows IN from larger networks
- Boundary creates **tiered access**: private (farmer sees all) → supplier (sees subset) → public (sees less)
- **Search boundary** (for ephemeral networks): how far away you can discover vs. participate in a network

### scale
- Position in the nesting hierarchy (S1–S8)
- Modules at lower scale nest inside modules at higher scale
- `scale.rel` = relative scale, nests wherever contentType matches
- When diverse contentTypes connect at same scale, the network auto-promotes (farmer stalls + clothing → general market)

## Module Lifecycle

1. **Download** — user gets a module template from a crowd-sourced repository
2. **Fill** — user adds their content (stored locally or on private server)
3. **Connect** — module linked to networks via bridge-code compatibility
4. **Auto-update** — changes propagate to all connected networks
5. **Disconnect** — unlinking removes data from that network

## Network Formation Patterns

### Pre-Structured Networks
Platform patterns exist as templates (collection block, exhibition feed). Individual modules plug in where their contentType and structure match.

### Emergent Networks
No pre-existing pattern. Modules self-assemble:
1. Individual modules exist independently
2. Proximity or explicit connection triggers bridge-code comparison
3. Compatible modules group by contentType
4. Groups form blocks; blocks form module groups
5. Network shape emerges from individual interactions
6. **Autonomous assembly** — inspired by biological cell organization (homeobox genes → simple rules → complex structures)

### Ephemeral Networks
- Modules connect when within wifi/Bluetooth range
- Data disappears from network when user leaves range
- Search boundary ≠ participation boundary
- Example: farmer's market that exists only while farmers are in the plaza

## Crowd-Sourced Network Structures

Large-scale blocks designed for module plug-in:
- **Research platform** — scientists connect health-metric modules to longitudinal study
- **Discussion aggregator** — journalism modules connect to topic-based research blocks
- **Exhibition platform** — art portfolio modules connect to public display
- **Market structure** — product modules connect, auto-organizing by contentType

## Value and Power

- Traditional web: company aggregates user data → company has power
- Modnet: individuals control data → value captured at smaller scale
- Bridge-code interoperability → users can bargain with platforms (crowd-sourced alternatives exist)
- `boundary` tag is the primary mechanism for user data sovereignty
- Higher user control tiers correlate with less predictable but more equitable networks

## Implementation Notes for Code Generation

When generating modnet modules:
1. Every module MUST have all five MSS tags
2. `contentType` should be specific enough to auto-group correctly but general enough for reuse
3. `mechanics` is always an array (even if empty) — it's a capability declaration
4. `boundary` defaults to `ask` if not specified (conservative default)
5. `scale` determines valid nesting — validate against the S1-S8 hierarchy
6. Bridge-code tags go in module metadata, not in the module's internal logic
7. For Agent Cards, use `modnet:mss:contentType` and `modnet:mss:boundary` metadata keys
