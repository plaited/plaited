# Modnet Standards — Distilled for MSS

This file bridges older Modnet theory into the current agent-era runtime. Keep the core
sovereignty and composition ideas, but do not treat older repository, template, or platform
assumptions as current implementation truth.

Distilled from Rachel Jaffe's *Past the Internet: The Emergence of the Modnet* (Modnet.md, 454 lines). Only actionable bridge-code rules and module patterns are extracted here.

## Core Concept

A **module** was originally framed as a self-contained unit of front-end + back-end code where
individuals own their data. In the current interpretation, the durable idea is sovereignty plus
composability. The runtime surface exposed across agents is more often services, artifacts, and
negotiated capability than raw module code.

Key properties:
- Modules or artifacts are **individually owned** (not platform-owned)
- Connected systems should avoid lock-in
- Disconnecting should remove data or access from that network
- Platform death should not imply data loss
- Sovereign agents may expose services or artifacts without exposing all module internals

## MSS Bridge-Code Tags (Modnet Design Standards)

### contentType
- Keyword identifying the module's domain
- Compatible contentTypes can often be manipulated together
- Matching contentTypes are a strong grouping hint, not a rigid universal rule
- Example: all `#produce` modules form a list; all `#art` modules form a portfolio

### structure
- Identifier for the artifact's information organization in the current realization
- Refers to the Structural IA vocabulary (list, collection, pool, stream, etc.)
- Similar structures can often be composed or translated together
- In agent-mediated systems, structure may be generated rather than selected from a fixed template set

### mechanics
- Cross-cutting dynamics that may activate based on connected structures and agent mediation
- A module declares mechanic *capability* via tags (e.g., `mec.vote`)
- The mechanic UI only appears when connected to a structure that uses it
- **Bottom-up:** child module data can inherit mechanics from parent (food items → health tracking overlay)
- **Top-down:** parent structure can apply mechanics to child modules (urban planner density map over farmer stalls)

### boundary
- What information is shared between modules
- Four values: `all` | `none` | `ask` | `paid`
- Controls what may flow out to other systems and what may be accepted in
- Boundary creates **tiered access**: private (farmer sees all) → supplier (sees subset) → public (sees less)
- **Search boundary** (for ephemeral networks): how far away you can discover vs. participate in a network

### scale
- Position in the nesting hierarchy (S1–S8)
- Modules at lower scale nest inside modules at higher scale
- `scale.rel` remains useful as a relative-scale concept
- Promotion is a useful assembly heuristic, not an unconditional law

## Historical Module Lifecycle

This lifecycle is historically useful, but current systems may instead:
1. generate or fork artifacts locally,
2. expose services or artifacts through agents,
3. negotiate compatibility over A2A,
4. preserve sovereignty without relying on a crowd-sourced template repository.

## Network Formation Patterns

### Pre-Structured Networks
Platform patterns exist here as historical template metaphors. In the current architecture,
generated UI and negotiated capability often replace static template registries.

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

Large-scale blocks designed for module plug-in remain useful as design metaphors, but should
not be treated as requiring a centralized template marketplace:
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
2. `contentType` should be specific enough to align correctly but general enough for reuse
3. `mechanics` is always an array (even if empty) — it's a capability declaration
4. `boundary` defaults to `ask` if not specified (conservative default)
5. `scale` determines valid nesting — validate against the S1-S8 hierarchy
6. Bridge-code tags go in module metadata, not in the module's internal logic
7. For agent cards, the important signal is MSS support and any selected exported metadata, not
   a requirement to expose the full MSS ontology inline
