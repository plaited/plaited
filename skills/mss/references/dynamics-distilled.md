# Dynamics Distilled — What MSS Tags Don't Capture

> Distilled from `docs/Structural-IA.md` (Jaffe, 2019) and `docs/Modnet.md` (Jaffe, 2020).
> Covers the interaction dynamics, feedback loops, and emergent behaviors that MSS bridge-code tags reference but don't encode directly. Each section includes agent-mediation annotations showing how the pattern changes when an agent intermediates all interactions.

This file preserves durable interaction theory, but the original source documents predate
LLMs, A2A, and generative UI. Treat the dynamics here as conceptual lineage to reinterpret,
not as rigid current runtime law.

## 1. Base Dynamics

**Source:** Structural-IA §Base Dynamics

Base dynamics are the smallest unit of interaction — a one-directional transfer of information through a channel with a lever applied.

**(Person or object) + channel + lever = base dynamic**

Three classes:
- **Object ↔ Object** — data sync between modules (shipping address → truck, sensor → dashboard)
- **Object ↔ Person** — person inputs data to object OR object notifies person (fitness tracker ↔ step counter)
- **Person ↔ Person** — direct communication (text messages, email, video calls)

Each class can be **one-to-one** or **one-to-many** (same information transmitted identically to multiple receivers).

### Agent-Mediation Annotation

| Original | Agent-Mediated | Change |
|----------|---------------|--------|
| Object ↔ Object | Object ↔ Object | **Largely preserved** — data sync between artifacts or services happens via direct transport or A2A message passing |
| Object ↔ Person | Object ↔ Agent ↔ Person | Agent intermediates. Person talks to agent; agent manages artifacts, services, and views. Agent handles notifications, filters noise, escalates when uncertain |
| Person ↔ Person | Person ↔ Agent ↔ Agent ↔ Person | Still exists (email, messaging). **View sovereignty** — each person's agent renders their view of the interaction. The agents are infrastructure, not participants |

**Key insight:** Person ↔ person doesn't collapse. It routes through agents. The difference is that YOUR agent controls YOUR view, not a shared platform.

## 2. Loops (Feedback Cycles)

**Source:** Structural-IA §Loops

A loop is two connected base dynamics forming a call-response relationship around a single goal.

**Base dynamic + base dynamic = Loop**

Four feedback types:
- **Positive reinforcing** — user repeats same action (correct answer in learning app → score increases → try next word)
- **Negative reinforcing** — user repeats same action but with frustration (filter doesn't work → retry)
- **Positive redirective** — user starts new loop on same platform (complete tutorial → link to next topic)
- **Negative redirective** — user leaves entirely (paywall blocks article → close tab)

**Core loops** relate directly to user goals. Non-core loops (sign up, click through, refresh) drain energy. People gravitate toward lowest-energy systems that complete their goals.

### Agent-Mediation Annotation

The agent collapses non-core loops. Instead of navigating sign-up flows, pagination, and search interfaces, the user states intent to the agent, which executes the minimal loop path. This means:

- **Core loops are preserved** — the user still votes, posts, creates content
- **Non-core loops are eliminated** — the agent handles authentication, navigation, data entry
- **Feedback changes form** — instead of UI animations and redirects, the agent reports outcomes through generative UI
- **Loop energy cost drops** — agent-mediated loops require less user energy, shifting the competitive dynamic Jaffe describes

## 3. Channels and Information Exchange

**Source:** Structural-IA §Channels

Channels connect objects and determine **what information flows** between them. This is an IA decision with power implications — who has more information has more power in the system.

Channel bandwidth ranges from low (binary: yes/no, connected/disconnected) to high (video call: voice + facial expressions + body language + context). Trust is built through information exchange.

### Agent-Mediation Annotation

The agent becomes a **channel mediator**:
- In the original model, the platform decides what information flows between modules
- In agent-mediated networks, each user's agent decides what to share, guided by the **boundary** tag
- The `boundary` MSS tag (`all`/`none`/`ask`/`paid`) encodes the channel policy, but the **agent** enforces it via ABAC (Attribute-Based Access Control)
- The agent evaluates sharing requests against the user's DAC preferences and escalates to the user only when uncertain
- A2A messages between nodes ARE the channels — same concept, different transport

## 4. Levers: Energy Management

**Source:** Structural-IA §Levers

Levers alter energy flow in systems. Two directions:
- **Decrease energy needed** to interact (better affordances, clearer mental maps)
- **Increase energy willing to exert** (mechanics, games, social dynamics)

Four lever types:
- **Affordances** — properties that make interaction explicit (door handle → pull, flat surface → push)
- **Structural cues** — visual design that constrains or incentivizes (text box size → tweet length)
- **Mechanics** — designed interaction patterns that create dopamine loops (upvote/downvote, swipe, scarcity)
- **Games** — system-wide incentive structures across multiple mechanics (Reddit karma + gold)

### Agent-Mediation Annotation

The agent **collapses lever complexity** at the UI layer:
- **Affordances** are generated on-the-fly by the agent's generative UI — no need for a platform to pre-design them
- **Structural cues** are chosen by the agent based on context (mobile? desktop? voice?) — the same module renders differently for different interaction modes
- **Mechanic concepts** remain useful, but realization is agent-mediated. The MSS `mechanics`
  field declares capability; activation and presentation may differ across agents and generated UIs
- **Games** persist across agent boundaries — a user's karma on a community follows them because it's stored in their module, not the platform

## 5. Modules, Blocks, and Scale

**Source:** Structural-IA §Modules, §Blocks, §Platform Structures

**Modules** = Objects + Loops → repeatable interactive units (email composition, comment, post)
**Blocks** = Multiple modules → emergent interactions (pools, streams, feeds, walls, threads)
**Platform Structures** = Blocks at scale → neighborhoods (hierarchy, hypertext, daisy, matrix)

Key block types and their dynamics:
- **Pool** — hierarchically nested modules (Google Drive folders). Focus and specificity increase with depth
- **Stream** — chronologically ordered scrollable modules (Twitter). Continuous aggregation of new content
- **Feed** — algorithm-sorted stream (Facebook). Same as stream but with ranking mechanics applied
- **Wall** — static profile info + collaborative stream (Facebook wall). Owned by one person
- **Thread** — nested reply modules (Reddit comments). Enables emergent conversation branching

**Situational connectedness** (visual layout) and **system connectedness** (dynamic relationships) coexist. A Reddit thread has both: nested visual layout (situational) + upvote/downvote dynamics (system).

### Agent-Mediation Annotation

Architecture is preserved. What changes is navigation:
- The agent presents the right **slice** of the hierarchy for the current task
- S5-S7 structures still exist architecturally, but the user doesn't navigate the full depth
- Generative UI renders the relevant block/module for the current interaction
- **Scale promotion** remains a useful heuristic, but not an unconditional law. Agents may group,
  translate, or keep artifacts distinct based on intent, boundary, and alignment

## 6. Ephemeral Networks

**Source:** Modnet §Ephemeral Networks

Ephemeral networks form and dissolve based on proximity (wifi/Bluetooth range). When a person leaves the network's range, their module disappears entirely.

Examples from Jaffe:
- **Meeting Place** — reading lists shared within a plaza's wifi range
- **Pop-up Exhibition** — art displayed on park screens from connected portfolio modules
- **Library** — same reading list module auto-connects to library network when entering

Key properties:
- **Search boundaries** — how far away you can discover the network
- **Participation boundaries** — how far away you can actively participate
- These can be the same (innate ephemeral) or different (locally ephemeral with designer-set boundaries)

### Agent-Mediation Annotation

The network duration becomes a spectrum, not a binary:

| Type | Duration | Example | Agent Pattern |
|------|----------|---------|---------------|
| Ephemeral (task) | Minutes-hours | Farmer's market visit | Goal fires once, task completes, agent disconnects |
| Ephemeral (session) | Hours-days | Conference networking | Agent joins for duration, leaves after |
| Sticky (subscription) | Ongoing | Bluesky club, monitoring feed | `repeat: true` bThread, tick listens for new messages |
| Permanent (membership) | Until explicitly left | Enterprise org, family | Always connected, MAC-enforced |

Duration is controlled by the **goal bThread lifecycle** (`repeat: true` vs terminate), not a new MSS tag. The agent manages connection/disconnection automatically based on:
- Physical proximity (sensor detects wifi/BLE range)
- Task completion (goal achieved → disconnect)
- User preference (sticky subscription → maintain connection)

## 7. Emergent Assembly

**Source:** Modnet §Autonomous Assembly, §Living Networks

Artifacts can assemble into larger systems through MSS-guided alignment without a central
platform coordinator, but the current agent-era runtime treats this as negotiated assembly,
not automatic destiny.

**Assembly rules (from MSS tags):**
1. **ContentType alignment** — compatible contentTypes are a strong grouping and translation hint
2. **Scale promotion** — useful default heuristic rather than hard law
3. **Boundary cascade** — effective boundary = min(own, parent). A `none` parent forces all children to `none`
4. **Mechanics inheritance** — bottom-up (child mechanics visible in parent view) and top-down (parent mechanics available to children)

**Bottom-up inheritance:** A farmer's food tracking app overlays health icons on farm stand items — the child module's mechanics project onto the parent's view.

**Top-down inheritance:** An urban planner's density heatmap (S6 mechanic) overlays individual farm stand data — the parent's mechanics project down onto child modules.

### Agent-Mediation Annotation

Assembly is **agent-initiated** rather than proximity-triggered:
1. Agent discovers a network or peer via QR scan, NFC tap, search, or direct address
2. Agent determines whether the peer supports MSS-aware interaction
3. Agent generates or adapts a compatible artifact, view, or service binding on-the-fly
4. **ContentTypes don't need to align** — a commerce network might produce a health-tracking view if the user cares about nutrition. The agent translates between network semantics and user preferences.
5. The result persists on the user's node for future visits — fork, adapt, or regenerate as needed

The "living network" metaphor still applies but the growth medium changes from automatic self-assembly to **agent-negotiated assembly** via A2A protocol.

## 8. Mechanics Deep-Dive

**Source:** Structural-IA §Mechanics (Incentivizers)

How each mechanic creates engagement:

| Mechanic | Dynamic | Dopamine Trigger |
|----------|---------|-----------------|
| **vote** (upvote/downvote) | Positive behavior rewarded, negative punished | Social validation feedback loop |
| **karma** | Accumulated reputation across all posts | Long-term investment creates platform loyalty |
| **gold** | Premium award from another user (costs real money) | Self-moderation + alternative to ads for funding |
| **swipe** | One-at-a-time card decisions, irreversible | Anxiety + anticipation from hidden next card |
| **scarcity** | Fixed interaction cap per period (e.g., 15 people/day) | Each interaction feels more valuable |
| **limited-loops** | Turn-based messaging (can't send until reply) | Forces high-quality messages, deeper engagement |
| **follow** | Subscribe to updates | Persistent connection channel |
| **like** | Single-direction approval | Quick positive reinforcement |
| **sort/filter** | Reorder or subset items | Control and efficiency (energy reduction) |
| **track/chart** | Record + visualize over time | Progress awareness, goal reinforcement |
| **post/reply/share** | Content creation + distribution | Expression + reach |

### Agent-Mediation Annotation

Mechanics are structural capabilities, not rigid UI widgets. The agent may **execute** a
mechanic (auto-vote based on user preferences, auto-filter based on learned patterns), but
the actual presentation is generated and context-dependent. The mechanic `vote` can remain
semantically present even when the realization differs across agents.

## Summary: What MSS Tags Encode vs What They Reference

| MSS Tag | Encodes | References (dynamics not encoded) |
|---------|---------|-----------------------------------|
| `contentType` | Domain or alignment signal | Grouping, translation, and network formation dynamics |
| `structure` | Information organization in the current realization | Block dynamics (pool nesting, stream scrolling, thread branching) |
| `mechanics` | Capability declarations | Activation rules, inheritance (bottom-up/top-down), incentive and feedback loops |
| `boundary` | Sharing policy | Channel power dynamics, trust building, search vs participation boundaries |
| `scale` | Nesting level | Emergent assembly rules, scale promotion, architectural hierarchy |
