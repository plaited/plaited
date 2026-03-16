---
name: mss-vocabulary
description: MSS (Modnet Structural Standard) bridge-code vocabulary for module generation. Defines valid tag values, composition rules, scale nesting, and boundary semantics. Use when generating modules, validating MSS tags, creating constitution bThreads that enforce MSS rules, or designing modnet node Agent Cards with MSS metadata.
---

# MSS Vocabulary

## Purpose

This skill teaches agents the **Modnet Structural Standard (MSS)** — a bridge-code vocabulary that enables modules to self-assemble into modular networks (modnets). MSS distills Rachel Jaffe's Structural Information Architecture into five machine-readable tags that govern how modules connect, nest, and share data.

**Use this when:**
- Generating modules with MSS bridge-code tags
- Validating MSS tag combinations for correctness
- Creating constitution bThreads that enforce MSS rules
- Designing Agent Card metadata with `modnet:mss:*` keys
- Reasoning about scale nesting and module composition

## The Five MSS Tags

Every module carries five bridge-code tags. Together they form the MSS envelope.

### 1. `contentType` (string)

**What it is:** A keyword identifying the module's domain/use-case. Modules with the same contentType can be manipulated together (sorted, filtered, grouped).

**Rules:**
- Free-form string, lowercase, no spaces (use hyphens)
- Must be unique per module within a network at the same scale
- Modules with matching contentType auto-group when connected to a shared block

**Canonical content types by domain:**

| Domain | contentType | NOT these alternatives |
|--------|------------|----------------------|
| Health/Fitness | `health` | ~~nutrition~~, ~~wellness~~, ~~fitness~~ |
| Social/Chat/Forum | `social` | ~~chat~~, ~~messaging~~, ~~discussion~~, ~~forum~~ |
| Science/Simulation | `science` | ~~physics~~, ~~chemistry~~, ~~statistics~~, ~~simulation~~ |
| Finance/Expenses | `finance` | ~~money~~, ~~expenses~~, ~~budget~~ |
| Logistics/Inventory | `logistics` | ~~inventory~~, ~~warehouse~~, ~~shipping~~ |
| Tools/Utilities | `tools` | ~~utility~~, ~~utilities~~, ~~converter~~ |
| Productivity/Calendar | `productivity` | ~~schedule~~, ~~events~~, ~~calendar~~, ~~tasks~~ |
| Art/Creative | `art` | ~~drawing~~, ~~graphics~~, ~~portfolio~~, ~~creative~~ |
| Entertainment/Music | `entertainment` | ~~music~~, ~~playlist~~, ~~media~~ |
| Education/Learning | `education` | ~~books~~, ~~reading~~, ~~study~~ |
| Data Visualization | `data-viz` | ~~visualization~~, ~~charts~~, ~~data-visualization~~ |
| Design/Color | `design` | ~~colors~~, ~~palette~~, ~~design-tools~~ |
| Geography/Maps | `geo` | ~~geospatial~~, ~~maps~~, ~~location~~ |
| Weather | `weather` | ~~forecast~~, ~~climate~~ |
| News | `news` | — |
| Real Estate | `real-estate` | — |
| Commerce | `commerce` | — |

Use the **canonical** value (left column). Agents that pick alternatives will fail modnet field validation.
- Examples: `produce`, `health`, `social`, `art`, `education`, `work`, `logistics`

### 2. `structure` (string)

**What it is:** The information organization pattern within the module.

**Valid values (from Structural IA):**

| Value | Description | Typical Scale |
|-------|-------------|---------------|
| `object` | Singular item | S1 |
| `list` | Ordered sequence of objects | S2 |
| `collection` | Unordered group of related objects | S2 |
| `steps` | Linked objects across pages (wizard/flow) | S2 |
| `pool` | Modules nested under hierarchy | S3 |
| `stream` | Chronologically ordered scrollable modules | S3 |
| `feed` | Algorithm-sorted stream | S3 |
| `wall` | Static profile info + collaborative stream | S3 |
| `thread` | Nested reply modules | S3 |
| `form` | Structured input (creation/manipulation) | S2-S3 |
| `daisy` | Central portal with secondary loops | S7 |
| `hierarchy` | Top-down strict pathways | S7 |
| `matrix` | Hierarchy + hypertext navigation | S7 |
| `hypertext` | User-generated search structures | S7 |

### 3. `mechanics` (string[])

**What it is:** Cross-cutting interaction dynamics that activate based on context. Mechanics are NOT always present — they auto-populate when a module connects to a structure that uses them.

**Valid values:**

| Value | Effect | Activates When |
|-------|--------|----------------|
| `vote` | Upvote/downvote on content | Connected to ranked structure (feed, pool) |
| `karma` | Accumulated reputation score | Connected to community with vote mechanic |
| `follow` | Subscribe to updates from a source | Connected to stream/feed structure |
| `like` | Single-direction approval signal | Connected to social content structure |
| `swipe` | Card-based binary decision | Structure presents one-at-a-time objects |
| `scarcity` | Limited interactions per period | Designer-imposed engagement cap |
| `limited-loops` | Turn-based messaging | Connected to 1:1 communication channel |
| `sort` | Reorder items by attribute | Connected to list/collection structure |
| `filter` | Show subset by criteria | Connected to list/collection/pool structure |
| `track` | Record data over time | Module has temporal content (health, metrics) |
| `chart` | Visualize tracked data | Combined with track mechanic |
| `post` | Create new content objects | Connected to stream/feed/wall structure |
| `reply` | Respond to existing content | Connected to thread structure |
| `share` | Export/link content externally | Module boundary is `all` or `ask` |
| `gold` | Premium award mechanic | Connected to community with karma |

**Auto-population rule:** A module's mechanics tags declare *potential* mechanics. They activate only when the module connects to a structure that uses them. An art portfolio module tagged `mechanics: ["vote"]` shows no vote UI standalone, but gains upvote/downvote when connected to an exhibition feed.

### 4. `boundary` (string)

**What it is:** What information the module shares with other modules in the network.

**Valid values:**

| Value | Semantics | A2A Mapping |
|-------|-----------|-------------|
| `all` | All data in the module is shared with connected modules | Data flows freely across A2A boundaries |
| `none` | No data leaves the module | Module is isolated; no A2A data sharing |
| `ask` | User is prompted before data is shared | Requires explicit consent per connection |
| `paid` | Data sharing requires payment/exchange | Commercial boundary; requires value exchange |

**Boundary inheritance:** Smaller-scale modules inherit the *most restrictive* boundary of their containing module. A `none` parent means all children are `none` regardless of their own tags.

**Boundary and publicness:** Boundary interacts with the cross-cutting pattern of *degree of publicness*:
- S1-S2 (bedroom scale): high privacy expected → typically `none` or `ask`
- S3-S5 (house/office scale): community trust → `ask` or `all` within group
- S6-S8 (neighborhood/city scale): expect information spillage → `all` or `paid`

### 5. `scale` (number)

**What it is:** Where the module sits in the nesting hierarchy. Determines what can contain it and what it can contain.

**Scale levels:**

| Scale | Name | Physical Analogy | Contains |
|-------|------|-----------------|----------|
| S1 | Singular Object | A chair | — |
| S2 | Object Group | A table setting | S1 objects in lists/collections/steps |
| S3 | Block | A room | S2 groups as pools/streams/feeds/walls/threads |
| S4 | Block Group | A suite of rooms | S3 blocks in spatial arrangements |
| S5 | Module | A house/building | S3-S4 blocks with loops forming interactive units |
| S6 | Module Group | A block/neighborhood | S5 modules in functional clusters |
| S7 | Platform Structure | A neighborhood | S5-S6 as daisy/hierarchy/matrix/hypertext |
| S8 | Super-structure | A city | S7 platforms in federated networks |

**Nesting rules:**
- A module at scale N can only be *contained by* modules at scale > N
- A module at scale N can only *contain* modules at scale < N
- `scale.rel` (relative) means the module nests wherever its contentType matches, regardless of scale
- Nesting is transitive: S1 inside S2 inside S3 is valid

## Composition Rules

### Rule 1: Content-Type Grouping
Modules with the same `contentType` auto-group when connected to a shared parent structure. A farmer's market block (S6) receiving three `produce` modules (S5) arranges them together.

### Rule 2: Structure Compatibility
Not all structures are valid at all scales:
- S1: `object` only
- S2: `list`, `collection`, `steps`, `form`
- S3: `pool`, `stream`, `feed`, `wall`, `thread`, `form`
- S4-S6: compositions of lower-scale structures
- S7: `daisy`, `hierarchy`, `matrix`, `hypertext`
- S8: federated compositions of S7

### Rule 3: Mechanics Activation
Mechanics tags are *declarations of capability*, not active features. They activate when:
1. The module connects to a structure that uses that mechanic
2. The parent scale's mechanics propagate down (top-down inheritance)
3. Child modules' mechanics propagate up to the parent view (bottom-up aggregation)

### Rule 4: Boundary Restriction Cascade
The effective boundary of a module is: `min(own_boundary, parent_boundary)` where the restriction order is: `none` > `paid` > `ask` > `all`.

### Rule 5: Emergent Network Formation
When modules with compatible contentType and structure connect without a pre-existing parent:
1. Two similar modules form an Object Group (S2)
2. Three or more form a Block (S3)
3. Diverse contentTypes at S5+ trigger automatic scale promotion (e.g., farmer stalls + clothing stalls → general market at S6)

## Agent Card Integration

MSS tags map to `modnet:mss:*` metadata keys on Agent Cards (see `src/modnet/modnet.constants.ts`):

```typescript
// From MODNET_METADATA
{
  mssContentType: 'modnet:mss:contentType',  // e.g., 'produce'
  mssBoundary: 'modnet:mss:boundary',        // e.g., 'ask'
}
```

When generating Agent Cards for modnet nodes, include MSS metadata to declare what the node offers and how it shares data.

## Pattern Examples (Content/Structure/Boundary/Scale)

See [references/valid-combinations.md](references/valid-combinations.md) for a full table of validated MSS tag combinations.

See [assets/mss-patterns.jsonl](assets/mss-patterns.jsonl) for machine-readable pattern data.

## References

- **[structural-ia-distilled.md](references/structural-ia-distilled.md)** — Distilled primitives from Structural-IA.md: objects, channels, levers, loops, modules, blocks, platforms as they map to MSS tags
- **[modnet-standards-distilled.md](references/modnet-standards-distilled.md)** — Distilled bridge-code syntax, module patterns, and crowd-sourced network structures from Modnet.md
- **[valid-combinations.md](references/valid-combinations.md)** — Table of valid MSS tag combinations with examples

## Related Skills

- **modnet-node** — Node architecture, A2A bindings, access control
- **behavioral-core** — BP patterns for constitution bThreads enforcing MSS rules
- **generative-ui** — Server-driven UI for rendering MSS-structured modules
