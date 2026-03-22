# Modnet Native Model Training Guide

## Purpose

This document is the single reference for building the native model training program for Plaited's modnet layer. It consolidates the MSS vocabulary, the exposure classification heuristic, Rachel Jaffe's concrete examples, the HyperCard pattern taxonomy, bridge module patterns, exposure transition prompts, and the modernization lens for converting historical patterns into sovereign-node training data.

Hand this to Codex alongside `modnet-training-prompts.jsonl` (1,159 prompts) to structure the native model program slices. The JSONL contains all prompts in a single file — use `metadata.tier` (1, 2, 2.5, 3, 4) to distinguish priority and `metadata.promptSource` (handcrafted, hypercard-archive) to distinguish origin. Tier 1-3 handcrafted prompts teach the Plaited ontology; Tier 4 HyperCard-derived prompts provide breadth. Entries with `metadata.modernization: "niche"` are high-value abandoned-niche patterns worth creative rewriting.

---

## Part 1: Architecture Constraints

These constraints are non-negotiable. Every training prompt and every model output must respect them.

### Modules Are Internal

A module is an internal artifact — code, data, tools, skills, bThreads — living inside the agent's workspace. Modules are NEVER exposed directly to the network. When one node wants to work with another node's module, it requests a service or receives an artifact. The module stays internal; the output crosses the boundary.

### PM Intermediates Everything

All external interaction flows through the PM/Orchestrator agent's behavioral engine (Gate → Execute pipeline). A2A calls are tool calls in the agent loop. The PM evaluates every inbound request against the constitution (MAC), the owner's preferences (DAC), and attribute-based rules (ABAC) before anything happens. Modules never talk to other modules in other nodes — everything is intermediated by the PM.

### Agent Card Is the Public Surface

The Agent Card is "a projection of capabilities, not an inventory of internals." Other nodes discover what your node can do via the Agent Card, then negotiate via A2A, and the PM decides whether and how to fulfill the request.

### What Crosses A2A

Services (request → response through the PM) and artifacts (data objects, not code). Code never leaves the node. Only `data/` contents cross A2A boundaries.

---

## Part 2: MSS Vocabulary

### The Five Tags

Every module carries five MSS (Modular Structural Semantics) tags:

1. **contentType** — what domain the module serves (produce, social, health, art, tools, etc.)
2. **structure** — how information is organized (object, form, list, collection, steps, pool, stream, feed, wall, thread, hierarchy, matrix, daisy, hypertext)
3. **mechanics** — what interactions it supports (sort, filter, track, chart, vote, reply, share, follow, stream, book, contact, rate, post, like, limited-loops, gold, karma, scarcity)
4. **boundary** — data sharing level (none, ask, all, paid)
5. **scale** — nesting hierarchy position (S1-S8)

### Scale Ladder

| Scale | Name | Analogy | Example |
|-------|------|---------|---------|
| S1 | Singular Object | A thing | Single food item, unit converter |
| S2 | Object Group | Table setting | Produce list, health tracker, portfolio |
| S3 | Block | Room | Dashboard, social feed, calendar, profile |
| S4 | Block Group | Suite | Connected blocks in spatial arrangement |
| S5 | Module | House/Building | Farm stand, booking module, community |
| S6 | Module Group | City block | Farmer's market, household platform |
| S7 | Platform Structure | Neighborhood | Social network, enterprise platform |
| S8 | Super-structure | City | Federated cross-platform network |

### Composition Rules

1. **ContentType Grouping** — modules with same contentType auto-group when connected to a shared parent
2. **Structure–Scale Compatibility** — certain structures only valid at certain scales
3. **Mechanics Activation** — mechanics are capability declarations that activate when the module connects to a structure that uses them
4. **Boundary Cascade** — effective boundary = min(own, parent) where restriction order is none > paid > ask > all
5. **Emergent Network Formation** — 2 similar modules → S2, 3+ → S3, diverse contentTypes at S5+ → auto-promote (farmer stalls + clothing → general market at S6)

---

## Part 3: Module Exposure Classification Heuristic

This is the decision tree the PM uses to determine whether a module should be internal-only, artifact-shareable, or service-exposed on the Agent Card.

### Step 1: Boundary Gate

If `boundary: none` → **internal-only**. Full stop. No amount of session mechanics overrides this.

### Step 2: Classify Mechanics

**Session mechanics** (require live A2A connection): `stream`, `book`, `vote`, `reply`, `follow`, `contact`, `rate`, `post`, `like`, `share`, `limited-loops`, `gold`, `karma`, `scarcity`

**Snapshot mechanics** (satisfiable by sending a copy): `sort`, `filter`, `tag`, `track`, `chart`

### Step 3: Apply Rule

| Boundary | Mechanics | Exposure |
|----------|-----------|----------|
| `none` | any | **Internal-only** |
| `ask`/`all`/`paid` | empty or snapshot-only | **Artifact-shareable** |
| `ask`/`all`/`paid` | at least one session mechanic | **Service-exposed** |

### Validation Table

| Module | Boundary | Mechanics | Exposure |
|--------|----------|-----------|----------|
| Design tokens (S1) | none | [] | Internal-only |
| Private journal (S2) | none | [track] | Internal-only |
| Reading list shared with friends (S2) | ask | [sort] | Artifact-shareable |
| Recipe collection (S2) | ask | [sort, filter, tag] | Artifact-shareable |
| Farm stand at market (S5) | all | [sort, filter, contact] | Service (contact) |
| Booking module (S5) | ask | [book, rate, track] | Service (book, rate) |
| Video streaming (S5) | paid | [stream] | Service (stream) |
| Bluesky feed (S3) | ask | [like, follow, share, post, reply] | Service (all session) |
| WhatsApp bridge (S3) | none | [reply, contact, share] | Internal-only (boundary gate) |

### Constitution Enforcement

The PM's behavioral program should include a blocking bThread that prevents Agent Card advertisement for any module where boundary=none OR where all mechanics are snapshot-only and the request is for service-level exposure. Belt-and-suspenders with the model's own reasoning.

---

## Part 4: Bridge Modules

Bridge modules are internal adapters that let the PM interact with centralized external platforms (WhatsApp, Telegram, X) on the user's behalf. They are fundamentally different from native A2A modules.

### Key Properties

- Always `boundary: none` — internal tools, never on Agent Card
- Use `social-bridge` contentType to distinguish from native social modules
- Session mechanics operate through platform API, not A2A
- The PM routes everything — bridges are event sources and action sinks

### Bridge vs. Native

| Module | contentType | boundary | exposure | Why |
|--------|-------------|----------|----------|-----|
| Bluesky client | social | ask | Service | AT Protocol is decentralized, bidirectional |
| WhatsApp bridge | social-bridge | none | Internal | Centralized platform, bridge translates |
| Telegram bridge | social-bridge | none | Internal | Same as WhatsApp |
| X bridge | social-bridge | none | Internal | Same |

### Bridge Patterns

1. **Inbound bridging** — platform → bridge → internal event → PM → generative UI
2. **Outbound bridging** — user intent → PM → bridge → platform API call
3. **Cross-bridge composition** — multiple bridges → unified inbox via PM aggregation
4. **Bridge-to-module routing** — PM classifies inbound bridge event intent → routes to internal module (e.g., X message about booking → booking module)
5. **Behavioral constraints on bridges** — bThreads gate bridge behavior (hold messages during focus, batch notifications)

### Critical Training Signal

When a user says "share my recipes to my Telegram group," the correct behavior is NOT to change the recipe module's boundary. The recipe module stays `boundary: none` (internal-only). The PM adds a behavioral trigger that routes recipe-added events through the Telegram bridge. The model must distinguish "share through a bridge" from "expose as a service."

---

## Part 5: Exposure Transitions

A critical prompt category: scenarios where a user transforms a module's exposure level.

### Transition Types

| From | To | What Changes |
|------|----|-------------|
| Internal-only | Artifact-shareable | boundary shifts none→ask/all; no new mechanics needed; PM gains permission to send derivatives |
| Internal-only | Service-exposed | boundary shifts; session mechanic added; Agent Card metadata generated; PM request handler created |
| Artifact-shareable | Service-exposed | session mechanics added; Agent Card entry created; PM service handler generated |
| Service-exposed | Artifact-shareable | session mechanics removed; Agent Card entry removed; subscribers notified |
| Any | Internal-only | boundary shifts to none; all Agent Card entries removed; connections disconnected; data leaves networks |

### What the Model Must Reason Through

For internal→service (e.g., "I want clients to book appointments with me"):
1. Current state: boundary=none, snapshot mechanics only → internal-only
2. Target requires: boundary shift + session mechanic addition
3. Add mechanics: [book, contact], set boundary: ask
4. Generate Agent Card metadata
5. Generate PM request-handling bThread
6. Generate owner management UI
7. Generate consumer-facing UI the PM serves to requesting agents

---

## Part 6: Rachel Jaffe's Concrete Examples

### The Canonical Farm Stand (Modnet Design Standards)

The most thoroughly specified example. Exercises every scale S1-S6, emergent network formation, scale promotion, ephemeral lifecycle, tiered boundary (private/supplier/public views), bottom-up mechanics inheritance (health overlay), and top-down mechanics inheritance (urban planner density map). See Tier 1 prompts in the handcrafted JSONL.

### Ephemeral Networks (Past the Internet)

- **Meeting Place** — reading lists in a plaza's wifi range, data disappears on disconnect
- **Library Auto-Connection** — same reading list auto-connects to library network on proximity
- **Pop-Up Exhibition** — art portfolios on park screens, voting mechanic activates in exhibition context

### Crowd-Sourced Network Structures (Past the Internet)

- **Research Platform** — health-metric modules connect to longitudinal study (boundary: none → ask → paid)
- **Discussion Aggregator** — journalism + science modules connect without coordinating body
- **Music Distribution** — musicians run smaller blocks listeners connect to (boundary: paid)

### Structural IA Validated Patterns

- **Work:** Desk (S3, none) → Table (S5, ask) → Meeting Room (S6, ask) → Office (S7, tiered)
- **Home:** Bedroom (S3, none) → Living Room (S5, ask) → House (S6, ask)
- **Education:** Reflection (S3, none→ask) → Reaction (S5, all) → Marketplace of Learning (S8, tiered)
- **Entertainment:** Connected Play (S4, invited) → Playground (S6, age-verified) → Carnival (S7, tiered)

### Key Principles from Jaffe

- "Users gravitate to lowest-energy systems that complete their goals"
- The agent collapses non-core loops (signup, navigation, data entry)
- Data entered once propagates to all connected networks
- Disconnecting removes data from the network (no lock-in)
- Module templates come from crowd-sourced repositories

---

## Part 7: HyperCard Pattern Taxonomy

The Internet Archive and Macintosh Repository preserve 2,000+ HyperCard stacks organized into 10 pattern families:

1. **Personal data managers** (72 entries) — contacts, calendars, to-dos, journals, recipe collections, genealogy
2. **Reference browsers** (150 entries) — encyclopedias, glossaries, guides, databases, catalogs
3. **Educational interactives** (212 entries) — quizzes, flashcards, simulations, language learning, tutorials
4. **Creative tools** (304 entries) — storytelling, pixel art, music composition, animation, poetry
5. **Business process** (32 entries) — invoicing, payroll, inventory, project management, scheduling
6. **Game/simulation** (155 entries) — adventure, puzzle, board games, RPGs, simulations
7. **Communication** (74 entries) — email clients, messaging, bulletin boards, kiosks
8. **Instrument control** (12 entries) — hardware control, lab equipment, data acquisition, model railways
9. **Multimedia presentation** (57 entries) — museum guides, CD-ROM companions, interactive film
10. **Developer utility** (50 selected) — script tools, analyzers, pattern libraries

### Modernization Lens

**Evergreen (1,100 entries):** Pattern is identical to modern needs, just dated surface. Mechanical update: strip 1992 transport/rendering, keep data model and interaction pattern, rewrite prompt in 2026 language.

**Niche gold (19 entries):** Real tools for real problems that got priced out of the software market. These are MORE valuable than evergreen because they demonstrate the long tail that platform economics can't serve but sovereign nodes can. Examples: church congregation management, ham radio licensing study, real estate deed plotting, laboratory equipment control. In sovereign node context, these gain network effects through A2A that they never had as standalone stacks.

**Genuinely obsolete (1 entry removed):** Primary purpose was a dead technology with no modern analog.

### Why the Niche Category Matters for Training

The diploma evaluation system used by 13 people in Sweden for a decade. The Buddhist temple directory running on a kiosk. The concordance generator indexing 80,000 hymnal words. These stacks died because nobody would build a SaaS product for 13 users. But a sovereign node needs one person who wants it. The marginal cost of running another module is zero — it's already in your workspace.

These niche patterns also demonstrate exposure transitions naturally. The diploma evaluator could expose a service: "Evaluate this foreign credential" (boundary: paid). The model railway controller could expose telemetry streams (boundary: ask). The assembly teleprompter could become a shared service distributed to worker nodes.

---

## Part 8: Must-Have Deployment Modules

Seven concrete module families required for initial Plaited deployment:

### 1. Bluesky Social Client
Native A2A peer via AT Protocol. contentType: social. Service-exposed (AT Protocol is bidirectional). Multi-feed management, compose, notifications.

### 2. Video Streaming with Payment
Upload, stream, tiered pricing (free previews, single purchase, subscription). Payment gating via x402/MPP. A2A notifications to subscribers on new content.

### 3. Payment Modules
Stripe integration via x402. Consumer-side spending limits as bThread constraints (auto-approve under threshold, escalate above). Payment history dashboard.

### 4. Booking for In-Person Services
Wizard flow: select service → pick time → confirm → pay. Agent Card advertises services/rates. Links to payment module and social module for reviews. Discovery via Agent Card search.

### 5. Image Sharing as A2A Artifacts
View-only sharing with comment mechanics. Collaborative albums where multiple nodes contribute. Original resolution gated behind boundary.

### 6. Web Fiction Reading/Publishing
Reader: track progress, monitor RSS/A2A for updates, import from sites like Royal Road. Publisher: draft→schedule→publish→notify workflow. Tiered access (free/paid chapters).

### 7. TTS Audiobook Generation
Chapter → TTS with voice tuning → preview → approve → distribute to paid subscribers. A2A notifications on new audio. Composes with fiction publisher module.

---

## Part 9: Priority Ordering for Training

### Tier 1: Core MSS Patterns (13 prompts)
Farm stand scale ladder (7), tiered boundary (3), ephemeral lifecycle (2), pop-up exhibition (1). These teach the model the foundational four-step cycle: intent → reasoning → rendering → negotiation.

### Tier 2: Multi-Module Composition (9 prompts)
Health overlay (bottom-up mechanics), urban planner (top-down mechanics), work domain scale ladder (3), home domain scale ladder (3), education domain (2). These teach composition and mechanics inheritance.

### Tier 2.5: Exposure Transitions (3+ prompts)
Internal→service, artifact→service, retract-to-internal. These teach the model that modules have lifecycles.

### Tier 3: Must-Have Modules (17 prompts)
Bluesky (3), video streaming (4), payment (4), booking (5), fiction (4), TTS (4), bridge modules (6). These target concrete deployment.

### Tier 4: HyperCard Breadth (1,119 prompts)
Full pattern taxonomy coverage. 19 niche gold entries prioritized for creative rewriting.

---

## Part 10: Eval Rubric and Judge Metadata

Each prompt in the JSONL has a `metadata.judge` block matching the `slice-3-validation-prompts.jsonl` schema:

```json
{
  "expectedExposure": "internal-only|artifact-shareable|service-exposed",
  "requiredConcepts": ["module", "mss", ...],
  "alignmentSignals": ["behavioral", "node", "local-first", ...],
  "structureSignals": ["form", "editor", "focused", ...],
  "dynamicSignals": ["event", "render", ...],
  "discouragedSignals": ["react app", "single-page app", "redux", ...]
}
```

### Judge Checks by Exposure Level

- **Internal-only:** Penalize any Agent Card metadata or A2A service handler in output
- **Artifact-shareable:** Penalize Agent Card service entries and ongoing A2A handlers; allow one-time sharing flows
- **Service-exposed:** Require Agent Card metadata and PM request-handling logic; verify session mechanics are present

### Universal Discouraged Signals

All prompts should discourage: `react app`, `single-page app`, `redux`, `next.js`, `direct-module-connection`, `module-to-module`, `shared-database`, `platform-API`

### Universal Required Signals

All prompts should require: `module`, `mss`, Plaited-native terminology (behavioral, node, controller protocol, local-first)

---

## Part 11: Four-Step Training Cycle

Every prompt decomposes into this cycle. The model must demonstrate competence at each step:

1. **Intent** — user expresses what they want via the mobile app
2. **Reasoning** — agent determines modules to activate, boundary conditions, networks to join/form, exposure level
3. **Rendering** — behavioral runtime generates controller-compatible UI (render, attrs, update_behavioral protocol messages)
4. **Negotiation** — bridge-code negotiation via A2A when modules from different nodes interact (for service-exposed modules only)

For Stage 1 (current), the primary target is symbolic output quality: prompt → Plaited-native artifact. Static correctness (correct protocol messages, correct custom elements) is the primary validation target. Dynamic correctness (interaction flows) comes in Stage 2.

---

## Part 12: Program Structure for Codex

Use this guide to structure the modnet native-model program slices. All prompts live in `modnet-training-prompts.jsonl` — filter by `metadata.tier` to get the prompts for each slice:

- **Slice 1:** Core MSS vocabulary — farm stand scale ladder, boundary rendering, ephemeral lifecycle. Filter: `metadata.tier == "1"` (13 prompts)
- **Slice 2:** Multi-module composition — mechanics inheritance, cross-module wiring, domain scale ladders. Filter: `metadata.tier == "2"` (8 prompts)
- **Slice 3:** Exposure classification — the heuristic, exposure transitions, bridge modules. Filter: `metadata.tier == "2.5"` + bridge/transition prompts from tier 3 (3+ prompts)
- **Slice 4:** Must-have deployment modules — Bluesky, video, payment, booking, fiction, TTS, image sharing. Filter: `metadata.tier == "3"` (15 prompts)
- **Slice 5:** Breadth training — HyperCard corpus integration, niche pattern modernization, coverage gap filling. Filter: `metadata.tier == "4"` (1,120 prompts, prioritize `metadata.modernization == "niche"` entries first)

Each slice should:
1. Define validation prompts by filtering `modnet-training-prompts.jsonl` on `metadata.tier`
2. Define acceptance criteria using the `metadata.judge` block on each prompt
3. Reference the curated training boundary in `dev-research/native-model/evals/curated-good-outputs.jsonl`
4. Specify which exposure levels the slice exercises (using `metadata.judge.expectedExposure`)
5. Not collapse into earlier slices — maintain separation
