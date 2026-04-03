---
name: mss
description: MSS (Modnet Structural Standard) semantics for modular and agent-mediated systems. Defines the five fixed MSS field names, their composition meaning, scale nesting, and boundary semantics. Use when generating modules, validating MSS tags, creating constitution bThreads that enforce MSS rules, or designing agents that support MSS-aware composition.
---

# MSS

## Purpose

This skill teaches agents the **Modnet Structural Standard (MSS)** — a composition grammar
for modular and agent-mediated systems. MSS distills Rachel Jaffe's Structural Information
Architecture into five machine-readable fields that help agents reason about composition,
alignment, sovereignty, and scale.

**MSS is not a classification system.** It is a composition grammar. Each field answers a
question about how an artifact participates in a larger system. Correct tagging requires
reasoning about role, data sharing, scale, and alignment, not pattern-matching against a
fixed list.

The original Structural IA and Modnet documents predate LLMs, A2A, and generative UI. Their
core concepts still matter, but they must be reinterpreted for sovereign agent systems.

**Use this when:**
- Generating modules with MSS bridge-code tags
- Validating MSS tag combinations for correctness
- Creating constitution bThreads that enforce MSS rules
- Designing agent-facing capability surfaces that support MSS
- Reasoning about scale nesting and module composition

## The Five MSS Fields

Every module or artifact carries five bridge-code fields. The field names are fixed, but the
values are not all equally rigid.

| Tag | Question | Determines |
|-----|----------|-----------|
| `contentType` | What domain or semantic alignment surface is this in? | Cross-agent alignment |
| `structure` | How is information organized in the current realization? | Interaction patterns |
| `mechanics` | What interactions could activate in context? | Dynamic capabilities |
| `boundary` | What data flows across this module's boundary? | Data sovereignty |
| `scale` | Where in the nesting hierarchy? | Composition level |

**Stability model:**
- Fixed field names: `contentType`, `structure`, `mechanics`, `boundary`, `scale`
- Strongest invariants: `boundary`, `scale`
- More alignment-driven or generated: `contentType`, `structure`, `mechanics`

In agent-mediated systems, `contentType`, `structure`, and `mechanics` do not need to be
globally identical across networks. Agents can query each other, translate values, and
generate new realizations as needed.

### 1. `contentType` — What domain or alignment surface is this in?

**What it is:** A free-form semantic label for domain or alignment. It helps agents decide
whether two artifacts should be grouped, translated, or composed together.

**Reasoning principle:** contentType is *inferred from context*, not selected from a fixed
registry. Ask: "If this artifact participates in a broader system, what other artifacts
should it align or interoperate with?"

contentTypes do not need to align globally. An agent can translate. A commerce network might
produce a `health`-aligned view if the user cares about nutrition.

**Rules:**
- Lowercase, no spaces (use hyphens for multi-word)
- Prefer values that make likely alignment obvious to another agent or human operator

**Useful defaults by domain:**

| Domain | Default contentType |
|--------|-------------------|
| Health/Fitness | `health` |
| Social/Chat/Forum | `social` |
| Science/Simulation/Stats | `science` |
| Finance/Expenses | `finance` |
| Logistics/Inventory | `logistics` |
| Tools/Utilities | `tools` |
| Art/Creative/Design | `art` |
| Entertainment/Music | `entertainment` |
| Education/Learning | `education` |
| Geography/Maps | `geo` |
| Weather | `weather` |
| News | `news` |
| Real Estate | `real-estate` |
| Commerce | `commerce` |
| Fresh Produce | `produce` |
| Work/Professional | `work` |
| Play/Games | `play` |
| Family/Household | `family` |

These are **defaults**, not a closed registry.

**Hyphenated variants:** When two artifacts in the same domain should not align closely, give
them different contentTypes. Use `{domain}-{function}`:

- `health-research` (not `health`) — population-level analysis shouldn't group with personal trackers
- `social-identity` (not `social`) — profile/reputation shouldn't group with content feeds
- `work-distribution` (not `work`) — organizational hierarchy shouldn't group with individual desks
- `education-study` (not `education`) — individual reflection shouldn't group with course platforms
- `education-discussion` (not `education`) — group discussion shouldn't group with individual study
- `play-cocreation` (not `play`) — collaborative creation shouldn't group with solo games

**Principle:** If two artifacts should not align or be grouped together, they need different
contentTypes.

**Disambiguation:**
- Charts/visualization for **data analysis** → `science`
- Color tools, palettes, design systems → `art`
- Calendars, task lists, scheduling → `tools`
- Drawing canvas, portfolio galleries → `art`

### 2. `structure` — How is information organized in the current realization?

**What it is:** The information organization pattern in the current realization of the
artifact. In agent-mediated systems this is often generated UI or generated code, not a
globally shared template.

**Reasoning framework:** Ask "What is the user doing with the data right now, and how is it
being presented?"

**Decision tree:**

1. **Is the user looking at a single item?** → `object`
   - Display-only. One artwork, one weather reading, one health metric.

2. **Is the user creating or manipulating data through input?** → `form`
   - Active input tool. Editors, calculators, converters, trackers with input fields.

3. **Are items organized in a defined order?** → `list`
   - Sequence matters. Playlists, reading lists, task lists with priority.

4. **Are items grouped without inherent order?** → `collection`
   - Set of related items. Portfolios, inventories, category groupings.

5. **Are items linked across pages toward a goal?** → `steps`
   - Wizard flow, multi-view navigation. Calendar (day/month views), simulation modes.

6. **Are items nested under hierarchy?** → `pool`
   - Folders within folders. Categorized modules, hierarchical browsing.

7. **Are items ordered chronologically and scrollable?** → `stream`
   - Time-based flow. Chat rooms, activity logs, message history.

8. **Is it a stream sorted by algorithm?** → `feed`
   - Ranked content. Social feeds, news feeds, discovery feeds.

9. **Is it static profile info combined with a collaborative stream?** → `wall`
   - Owned by one person. User profiles with activity.

10. **Are items nested replies?** → `thread`
    - Branching conversation. Reddit comments, forum threads.

11. **Platform navigation structures (S7 only):**
    - Central portal with secondary loops → `daisy`
    - Top-down strict pathways → `hierarchy`
    - Hierarchy + hypertext navigation → `matrix`
    - User-generated search structures → `hypertext`

These are strong starting patterns, not a permanent closed registry. Agents may generate new
structures over time to match user preferences, provided the resulting structure still makes
semantic sense for the scale and task.

**Structure–scale compatibility (default guidance):**

| Scale | Valid structures |
|-------|----------------|
| S1 | `object`, `form` |
| S2 | `object`, `list`, `collection`, `steps`, `form` |
| S3 | `pool`, `stream`, `feed`, `wall`, `thread`, `form`, `collection`, `steps` |
| S4–S6 | Any structure from lower scales, composed |
| S7 | `hierarchy`, `matrix`, `daisy`, `hypertext`, `pool`, `collection` |
| S8 | Federated compositions |

**Disambiguation:**
- `stream` = chronological messages (chat rooms, logs) vs `thread` = nested replies (forums, Reddit)
- `list` = ordered sequence (playlists, reading lists) vs `collection` = unordered group (portfolios, inventories)
- `form` = user input/creation tool (editors, calculators) vs `object` = display-only item
- `steps` = multi-page wizard/flow (calendar views, simulations) vs `collection` = all items visible at once

### 3. `mechanics` — What interactions activate in context?

**What it is:** Cross-cutting interaction dynamics. Mechanics are *capability declarations*
that may be activated, translated, or mediated by agents depending on context.

**Reasoning framework:** For each mechanic, ask "Does the description **explicitly mention or directly imply** this interaction?"

**Conservative tagging principle:** Only tag mechanics that the description explicitly names or
clearly implies. If the description doesn't mention filtering, sorting, charting, or sharing,
don't add them even if they could theoretically apply. The artifact can gain additional
mechanics later through composition, alignment, or evolution.

**Evolution tagging:** When a module evolves, re-evaluate mechanics from scratch based on the new description. Don't carry forward old mechanics unless the new description still supports them. If the description says a format is "replaced" or "transformed," the old mechanics are gone.

| Mechanic | Tag when... | Do NOT tag when... |
|----------|------------|-------------------|
| `track` | Module contains **temporal data** — data that changes over time, whether user-generated (steps, expenses) or external (forecasts, prices). A 5-day forecast = `track`. A calendar with events = `track`. | Data is static/unchanging |
| `chart` | Data is **visualized as graphs, trends, or plots**. Co-occurs with `track` when the module itself records temporal data. Analysis tools visualizing pre-existing or aggregated data (chart generators, stats calculators, research platforms) declare `chart` without `track`. | Raw numbers without visualization |
| `filter` | Users can **hide items by criteria** (category, status, date range, price). Description mentions filtering, categories, "show subset", or "by X". | No subsetting capability |
| `sort` | Users can **reorder items** by attribute (date, price, rating, priority). Description mentions sorting, ordering, or "sort by". | Fixed order only |
| `post` | Users **create new top-level content** in a stream/feed/wall. | Content is pre-populated or input-only (use `form` structure) |
| `reply` | Users **respond to existing content** in a nested thread. A forum with nested comments = both `post` and `reply`. | Flat messaging (that's `post` only) |
| `vote` | Content has **upvote/downvote** for ranking. | No ranking mechanism |
| `karma` | **Accumulated reputation** score across posts in a community. | No persistent reputation system |
| `gold` | **Premium award** from users (costs real value). | No premium mechanics |
| `follow` | Users can **subscribe to a specific source** for updates. | Just participating — joining a chat room ≠ following |
| `like` | **Single-direction approval** signal (not ranked). | No approval mechanism |
| `swipe` | **Card-based binary decisions**, one item at a time. | Multiple items visible simultaneously |
| `scarcity` | **Designer-imposed cap** on interactions per period. | No engagement limits |
| `limited-loops` | **Turn-based messaging** — can't send until reply received. | Free-flowing communication |
| `share` | **Export/link content externally**. Only when boundary is `all` or `ask`. | Boundary is `none` |

**Activation rule:** Mechanics tags declare *potential* mechanics. They activate when the
current context, structure, and boundary support them. A standalone artifact can expose a very
different UI from the same artifact when mediated through another agent or larger composition.

**Inheritance:**
- **Bottom-up:** Child module mechanics project onto parent view (food tracking → health icons on farm stand items)
- **Top-down:** Parent mechanics available to children (density heatmap over individual stalls)

### 4. `boundary` — What data crosses the module boundary?

**What it is:** The data-sharing policy — what information flows out when this module connects to a network.

**Valid values:**

| Value | Meaning |
|-------|---------|
| `all` | Data flows freely to connected modules |
| `none` | No data leaves the module |
| `ask` | User prompted before sharing |
| `paid` | Sharing requires value exchange |

**Reasoning framework:** Ask "When this module connects to a network, what should happen to its data?"

**Decision signals:**

| Signal in the description | → boundary |
|--------------------------|-----------|
| Private/personal data (health, finance, notes, drawings, playlists) | `none` |
| Stateless tool, no user data (converter, calculator, palette) | `all` |
| Public content, no account needed (open forum, wiki, weather) | `all` |
| Social/collaborative — users share with others | `ask` |
| Commerce/transactions — purchases require data exchange | `ask` |
| Community with signup/accounts | `ask` |
| Hierarchical organizations with access tiers | `ask` |
| Research/data requiring payment | `paid` |

**Key distinction:** `none` = personal data the user wouldn't share. `ask` = data the user *might* share with consent. `all` = no user data stored, or content is inherently public.

**Additional signals:**
- Users must **sign up or create an account** → `ask` (account = personal data)
- Module involves **commerce/transactions** → `ask` (purchases = data exchange)
- Content is **publicly accessible without any account** → `all`
- Module has **hierarchical access tiers** → `ask` (data flows between tiers with consent)

**Boundary cascade:** Effective boundary = `min(own, parent)` where restriction order is `none` > `paid` > `ask` > `all`.

### 5. `scale` — Where in the nesting hierarchy?

**What it is:** The module's position in the nesting hierarchy. Determines what it can contain and what can contain it.

**Reasoning framework:** Ask "What does this module contain?" and "What would contain this module?"

**Scale decision tree:**

**S1 — Singular Object.** A single atomic item with no internal grouping.
- One data point, one product, one artwork, one stateless converter.
- Contains nothing. Contained by S2+ groups.
- *Examples: health metric, product listing, artwork, unit converter, color palette*

**S2 — Object Group.** Organizes multiple items into a single group.
- A list, collection, set of steps, or input form with persistence/tracking.
- Contains S1 objects. Contained by S3+ blocks.
- *Examples: health tracker, product catalog, portfolio, editor, task list, playlist, expense tracker, calculator, weather dashboard, simulator*

**S3 — Block.** Composes multiple groups into an interactive block with emergent dynamics.
- A room where grouped items create interactions they don't have alone.
- Contains S2 groups. Contained by S4+ compositions.
- *Examples: chat room, social feed, health dashboard, calendar, user profile, forum, map*

**S4 — Block Group.** Arranges multiple blocks spatially.
- A suite of rooms. Rare — spatial arrangement without forming a complete unit.
- Contains S3 blocks. Contained by S5+ modules.
- *Examples: co-creation canvas with pass-back between participants*

**S5 — Module.** A complete, self-contained interactive unit.
- A house/building. Has internal loops. Could stand alone.
- Contains S3-S4 blocks. Contained by S6+ clusters.
- *Examples: farm stand, community, exhibition, family space, discussion group*

**S6 — Module Group.** Clusters multiple modules by function.
- A city block. Multiple S5 modules organized together.
- Contains S5 modules. Contained by S7+ platforms.
- *Examples: farmers market, neighborhood game platform, cross-team coordination, household platform*

**S7 — Platform Structure.** A platform with navigation architecture.
- Uses `hierarchy`, `matrix`, `daisy`, or `hypertext` as primary structure. Also uses `pool` and `collection` for large-scale organization.
- Contains S5-S6 clusters. Contained by S8 federations.
- *Examples: company platform, social network, research platform, gallery platform, entertainment platform*

**S8 — Super-structure.** Federates multiple platforms.
- A city — network of S7 platforms.
- *Examples: decentralized education marketplace, federated social networks*

**Scale signals from descriptions:**

| Signal | → Scale |
|--------|---------|
| "single", "one", "a [item]", stateless tool | S1 |
| "list of", "tracker", "editor", "with categories", "catalog" | S2 |
| "dashboard", "room", "feed", "chat", "profile", flat "forum" | S3 |
| "suite", spatial arrangement of blocks | S4 |
| "community", "full module", "stand", "exhibition" | S5 |
| "market", "neighborhood", "cross-team", "group of modules" | S6 |
| "platform", "network", "enterprise", "with tiers/roles" | S7 |
| "decentralized", "federated", "cross-platform" | S8 |

**Nesting rules:**
- A module at scale N can only be *contained by* modules at scale > N
- A module at scale N can only *contain* modules at scale < N
- Nesting is transitive: S1 inside S2 inside S3 is valid

## Composition Rules

### Rule 1: ContentType Grouping
Matching or compatible `contentType` values are a strong signal for grouping, translation, or
composition. In agent-mediated systems this is negotiated rather than assumed to be globally
identical.

### Rule 2: Structure–Scale Compatibility
See the structure–scale table in §2 above.

### Rule 3: Mechanics Activation
Mechanics tags are declarations of capability. They activate when:
1. The module connects to a structure that uses that mechanic
2. Parent mechanics propagate down (top-down inheritance)
3. Child mechanics propagate up (bottom-up aggregation)

### Rule 4: Boundary Cascade
Effective boundary = `min(own, parent)` where restriction order is `none` > `paid` > `ask` > `all`.

### Rule 5: Emergent Network Formation
Emergent grouping and promotion are useful defaults, not rigid universal laws. In
agent-mediated systems the agent may:
1. align two artifacts into a shared group,
2. keep them distinct but query-compatible,
3. generate an intermediate view,
4. or decline composition because boundary or user intent blocks it.

## Artifact Lifecycle

MSS fields are not static labels. They evolve as artifacts grow from personal tools into
shared, queried, or federated participants.

### Phase 1: Create — Personal Intent

A user describes what they want. The agent generates an artifact with MSS fields based on
intent.

- Boundary is typically `none` (personal) or `all` (stateless tool)
- Scale starts at S1–S2 (single items or groups)
- Mechanics reflect personal capabilities (`track`, `chart`, `filter`, `sort`)

### Phase 2: Compose — Building Alongside Existing

The user has existing artifacts and wants a new one that works with them.

- **Compatible contentType** → agents may group or translate in shared views
- **Different contentType** → use a more precise variant when unwanted grouping would happen
- Scale of compositions follows nesting rules: S2 groups compose into S3 blocks, S5 modules cluster into S6

### Phase 3: Evolve — Boundary & Scale Transitions

As usage changes, MSS tags adapt:

- **Boundary progression:** `none` → `ask` → `all` → `paid` follows natural sharing patterns
  - Personal tool → shared with friends (`none` → `ask`)
  - Shared tool → public utility (`ask` → `all`)
  - Popular resource → monetized access (`all`/`ask` → `paid`)
- **Scale promotion:** Accumulating modules triggers scale increases
  - Three S2 tools → S3 dashboard block
  - Multiple S5 modules of diverse contentTypes → S6 cluster with contentType promotion (e.g., produce + crafts → `commerce`)
- **Mechanics expansion:** New mechanics activate when boundary or structure changes (e.g., `share` activates when boundary moves from `none` to `ask` or `all`)

### Phase 4: Network — Capability Declaration

When an artifact joins a network through an agent, its MSS fields help declare:

- what it aligns with (`contentType`)
- how it shares data (`boundary`)
- where it nests (`scale`)
- what interactions it can support (`mechanics`)

The agent card should indicate that the agent supports MSS-aware interaction. It does not need
to expose a full global registry of MSS values inline.

## Agent Card Integration

In the current architecture, the important fact is that an agent can signal MSS support and
negotiate alignment over A2A. Some implementations may project selected MSS fields into
metadata, but the metadata projection is not the ontology itself.

**How agent networks use MSS support:**
- **Discovery:** identify agents that can reason about MSS
- **Consent:** boundary determines sharing and escalation behavior
- **Alignment:** agents can query each other for `contentType`, `structure`, or `mechanics`
- **Composition:** generated UI and service/artifact exchange replace the old assumption of
  fixed template registries

## Pattern Examples

See [references/valid-combinations.md](references/valid-combinations.md) for a full table of validated MSS tag combinations.

See [assets/mss-patterns.jsonl](assets/mss-patterns.jsonl) for machine-readable pattern data.

## References

- **[structural-ia-distilled.md](references/structural-ia-distilled.md)** — Distilled primitives from Structural-IA.md: objects, channels, levers, loops, modules, blocks, platforms as they map to MSS tags
- **[modnet-standards-distilled.md](references/modnet-standards-distilled.md)** — Distilled bridge-code and modnet concepts from Modnet.md, with older pre-agent assumptions needing reinterpretation
- **[dynamics-distilled.md](references/dynamics-distilled.md)** — Interaction dynamics, feedback loops, ephemeral networks, and emergent assembly — the behavioral layer that MSS tags reference but don't encode. Includes agent-mediation annotations
- **[valid-combinations.md](references/valid-combinations.md)** — Example MSS combinations and anti-patterns; use as starting patterns, not a closed registry

## Related Skills

- **modnet-node** — Node architecture, A2A bindings, access control
- **behavioral-core** — BP patterns for constitution bThreads enforcing MSS rules
- **plaited-ui** — Server-driven UI for rendering MSS-structured modules
