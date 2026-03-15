# Structural IA — Distilled for MSS

Distilled from Rachel Jaffe's *Structuralism and a Pattern Language for Online Environments* (Structural-IA.md, 1648 lines). Only actionable primitives that map to MSS tags are extracted here.

## Foundational Primitives

### Objects (→ MSS scale S1)
- **Anything conceived as one.** What counts as "one" depends on the system's goal.
- People can be objects (hospital system: patients are the primary object).
- Objects are the atomic unit — they are created, manipulated, or connected.

### Object Groups (→ MSS scale S2)
Four grouping patterns:
- **Relational** — objects placed visually beside each other
- **Nested** — objects collected within a larger grouping (songs in a playlist)
- **Structured Steps** — objects linked across pages toward a goal (wizard flows)
- **List** — objects in a defined order within one page

### Channels (→ MSS mechanics layer)
- Connections between objects that exchange information
- Can transmit low info (yes/no) to high info (video, touch, smell)
- **What info flows across channels determines who has power in the system**
- Maps to MSS: mechanics define *what interactions* channels enable

### Levers (→ MSS mechanics)
Tools to change energy demand or alter energy inputs:
- **Affordances** — properties making explicit how to engage (decrease energy)
- **Structural Cues** — visual design elements (drop-downs, text box size)
- **Mechanics** — designed presentation/interaction patterns (swipe, vote, scarcity)
- **Games** — system-wide rules and incentive structures (karma, gold, followers)

### Base Dynamics (→ MSS mechanics activation)
- `object + channel + lever = base dynamic` (one-directional transfer)
- Types: object↔object, object↔person, person↔person
- Scope: one-to-one, one-to-many
- These are the smallest unit of interaction on a platform

### Loops (→ MSS mechanics composition)
- `base dynamic + base dynamic = loop` (action + feedback)
- Feedback types: positive/negative × reinforcing/redirective
- Core loops = energy directly tied to user goals
- Non-core loops = friction (signup, page navigation)
- **Users gravitate to lowest-energy systems that achieve their goals**

### Modules (→ MSS scale S5)
- `objects + loops = module` (interactive unit)
- Physical analogy: chairs and tables
- Examples: comment block, email composition, social post
- Have a *primary* goal (Send, Reply, Share) with secondary actions

### Blocks (→ MSS scale S3)
- Multiple modules creating **emergent interactions**
- Two connectedness types: situational (visual layout) + system (dynamic between blocks)
- Block types:
  - **Pool** — modules nested under hierarchy
  - **Stream** — chronological scroll
  - **Feed** — algorithm-sorted stream
  - **Wall** — static profile + collaborative stream
  - **Thread** — nested reply modules
  - **Collection** — related objects with lasting relevance

### Platform Structures (→ MSS scale S7)
- **Strict Hierarchy** — all pathways delineated by designer (DMV website)
- **Hypertext** — user-generated search structures (Pinterest, Google)
- **Daisy** — central portal with secondary loops (health tracking apps)
- **Matrix** — hierarchy + hypertext combined (Wikipedia, Facebook)
- **Nested Pools** — hierarchical collections with user freedom (Google Drive)
- **Nested Channels** — layered communication (Slack: channels → threads → DMs)

## Pattern System (→ MSS Tag Structure)

Every pattern has four attributes — these became the MSS tags:

1. **Content** — what activities/interactions take place (→ `contentType`)
2. **Structure** — how information is organized, innate mechanics (→ `structure`)
3. **Boundary** — what info is shared in/out, user permissions (→ `boundary`)
4. **Scale** — where it sits in the nesting hierarchy (→ `scale`)

## Scale System (S1–S8)

| Scale | Name | Analogy | MSS Role |
|-------|------|---------|----------|
| S1 | Singular Object | A thing | Atomic content unit |
| S2 | Object Group | Table setting | Grouped content (list, collection, steps) |
| S3 | Block | Room | Interactive composition (pool, stream, feed, wall, thread) |
| S4 | Block Group | Suite | Spatial arrangement of blocks |
| S5 | Module | House/Building | Full interactive unit with loops |
| S6 | Module Group | City block | Functional cluster of modules |
| S7 | Platform Structure | Neighborhood | Navigation architecture |
| S8 | Super-structure | City | Federated network of platforms |

## Cross-Cutting Patterns

### Degree of Publicness (→ boundary semantics)
- Shaped by: number of people, entry requirements, data decay
- Small scale (S1-S2) → high privacy expectation
- Large scale (S6-S8) → expect information spillage/cascade
- **Clarity for the user is paramount** — ambiguous publicness kills engagement

### User Control Tiers (→ boundary + mechanics)
- Tier 1: Navigate only (strict hierarchy, `none` boundary)
- Tier 2: Create content (post objects, no control over audience)
- Tier 3: Module-level control (who sees, how they interact)
- Tier 4: Block-level design control (change system functionality)
- Tier 5: Platform governance (shape goals and ethics)

### Vulnerability (→ boundary `ask` + mechanics `limited-loops`)
- General vulnerability: anonymity (easy to design)
- Interpersonal vulnerability: built through mutual info exchange over time
- Requires: clear entry requirements, prompts for continued conversation, disincentives for sharing externally

## Validated Pattern Examples from Source

| Pattern | Content | Structure | Boundary | Scale |
|---------|---------|-----------|----------|-------|
| Desk | creation work | form + collection | private (none) | S3 |
| Table | evaluation work | pool of desk blocks | team (ask) | S5 |
| Meeting Room | coordination work | pool of table blocks | org (ask) | S6 |
| Office | distribution | nested rings of access | tiered (ask/all) | S7 |
| Bedroom | personal storage | long-term + short-term collections | private (none) | S3 |
| Living Room | shared family | collaborative collection | family (ask) | S5 |
| House | family platform | bedrooms + common areas | household (ask) | S6 |
| Reflection | individual study | notes + reaction objects | private → professor | S3 |
| Reaction | group discussion | auto-splitting threads | group (all within) | S5 |
| Marketplace of Learning | education platform | nested pools of classes | tiered (student/prof/mod) | S8 |
| Connected Play | co-creation | pass-back canvas | private → invited | S4 |
| Playground | community play | game module pool | verified age group | S6 |
| Carnival | entertainment | bi-level collaborative collection | tiered (owner/creator/attendee) | S7 |
