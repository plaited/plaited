# Plan: Ship a Personal Agent Node

> **Goal:** Ship a personal agent node that a user can deploy on their own hardware, running a distilled model that generates MSS-compliant modules at runtime, monitors the environment proactively, and communicates through a generative UI — all governed by deterministic BP constraints.

> **Framework status:** Complete. 1326 tests, 0 failures, 90 files. `createNode()` composes agent loop + server + A2A. The gap is generation quality and MSS comprehension, not framework code.

---

## Part 1: Structural IA + Modnet for Agent-Mediated Networks

### The Problem

`docs/Structural-IA.md` (1648 lines, Rachel Jaffe) and `docs/Modnet.md` (3.9MB) define the theory behind MSS. The distilled versions in `skills/mss-vocabulary/references/` (357 lines) extracted MSS tags but lost the **dynamics** — interaction patterns, loops, ephemeral networks, emergent assembly. These dynamics change when an agent mediates all interactions, which was not part of the original design.

### What Changes with Agent Mediation

**Base dynamics collapse from 3 types to 2 (with nuance):**

| Original (Jaffe) | Agent-Mediated | Notes |
|---|---|---|
| object ↔ object | object ↔ object | Unchanged — data sync between modules |
| object ↔ person | object ↔ agent ↔ person | Agent intermediates. Person talks to agent, agent manages module |
| person ↔ person | person ↔ agent ↔ agent ↔ person | Still exists but routes through agents. View sovereignty — each person's agent renders their view |

**Person ↔ person still exists.** Email, Bluesky, messaging — these are person-to-person in intent. The agents are infrastructure, not participants. The difference is **view sovereignty**: your view of the interaction is controlled by YOUR agent, not a shared platform.

**What's preserved (primitives are correct):**
- Objects, channels, levers, loops — structural, not behavioral
- MSS tags (contentType, structure, mechanics, boundary, scale) — still the right vocabulary
- Composition rules (scale nesting, boundary cascade, contentType grouping) — still valid
- What changes is WHO applies the rules — an agent instead of a platform

**What's modified:**

1. **Boundary delegates, not shifts.** `ask` still means "prompt before sharing" — but the agent handles the evaluation (ABAC) and only escalates to the user when uncertain. For `paid`, agent auto-provisions when payment clears. For `all`, agent shares freely. DAC = user's preference on the module. MAC = constitution floor. No new boundary values needed.

2. **Mechanics activate across A2A boundaries.** Same mechanics Jaffe defined, but the channel is A2A instead of a shared database. When Node A sends a Message with MSS info to Node B, B's agent routes to the matching module by contentType. Mechanics activate based on the *receiving* module's structure. A mobile client sending BLE/location data is a sensor pushing to the node — `track` and `filter` mechanics activate because the module has temporal location data.

3. **Agent collapses UX complexity, not structural layers.** S5-S7 still exist architecturally. The agent means the user doesn't have to navigate the full hierarchy — generative UI presents the right slice for the current task. When using a mobile/desktop client, the user drops into their agent, which may be part of a complex ephemeral network, but the user sees simpler mini-app UIs.

4. **Network duration is a spectrum (not binary ephemeral/permanent):**

| Type | Duration | Example | bThread Pattern |
|---|---|---|---|
| Ephemeral (task) | Minutes-hours | Farmer's market visit | Goal fires once, task completes, agent disconnects |
| Ephemeral (session) | Hours-days | Conference networking | Agent joins for duration, leaves after |
| Sticky (subscription) | Ongoing | Bluesky club, monitoring feed | `repeat: true` bThread, tick listens for new messages |
| Permanent (membership) | Until explicitly left | Enterprise org, family | Always connected, MAC-enforced |

The distinction is in the goal factory lifecycle, not a new MSS tag.

5. **Mechanics don't need UI/agent distinction.** The UI surfaces what the agent chose, not necessarily what the user manually did. The mechanic `vote` exists regardless of whether user clicked or agent voted based on preferences. Generated UI may show agent-chosen results.

### Runtime Module Generation (Key Insight)

**Modules are generated on-the-fly, not pre-built.**

When a personal agent encounters a new network (e.g., scans QR at farmer's market), it:

1. Fetches public **Agent Card** from `/.well-known/agent-card.json`
   - Reads: name, skills, MSS metadata (`modnet:mss:contentType`, `modnet:mss:boundary`)
2. Authenticates → fetches **Extended Agent Card** (`agent/authenticatedExtendedCard`)
   - Sees: additional skills, detailed capabilities, pricing, extensions
3. Generates a compatible module using framework (`initModule` + MSS tags + generative UI)
   - contentType matches or translates (market=commerce, user might want health or finance view)
   - structure compatible (user's list nests in market's pool)
   - boundary respects cascade (user's `ask` ≤ market's `all`)
4. Generative UI renders based on extended card skills
5. User interacts, refines via prompts. Module evolves.
6. User leaves → ephemeral network dissolves → module persists for next visit
7. Next similar network: agent reuses, forks, or generates fresh

**ContentTypes don't need to align.** A commerce market might produce a health-tracking view for a user who cares about nutrition. The agent translates between the network's MSS and the user's preferences.

### A2A Schema Gaps Identified

| Gap | What's Missing | Why It Matters |
|---|---|---|
| `AgentExtension` type | A2A spec defines `{uri, description, required}` on cards. Not in our schemas. | MSS should be a formal A2A extension (`modnet:mss/v1`) |
| `inputModes`/`outputModes` on `AgentSkill` | A2A spec defines these. Not in our `AgentSkillSchema`. | Tells visiting agent what content types a skill accepts/produces |
| MSS-aware extended card | `getExtendedAgentCard` returns static card | Should return boundary-filtered skills based on visitor's auth level |

### What Needs to Be Produced

1. **Agent-mediated dynamics addendum** — focused document (not a rewrite) covering the 5 modifications above
2. **MSS vocabulary update** — network duration note, A2A as channel type, view sovereignty in boundary section
3. **Composition rules update** — cross-node mechanic activation rule
4. **A2A schema updates** — `AgentExtension`, skill input/output modes, MSS extension URI
5. **Process the source docs** — make `Structural-IA.md` and `Modnet.md` queryable (JSON-LD concepts in hypergraph, or structured distillation with agent-mediation annotations)

---

## Part 2: Experiment Design — MSS Comprehension → Boot → Verify

### The Calibration Treadmill Problem

The previous approach (regex graders) spent most experiment time calibrating the **grader**, not improving **skills**. The grader should be a fixed reference point. Solution: deterministic gates (tsc, boot, MSS schema validation) plus LLM judge only where needed.

### Phase 0: Process Source Material

Before any experiments, make `Structural-IA.md` and `Modnet.md` queryable. Options (from discussion):

- **JSON-LD ingestion** — concept vertices in hypergraph, queryable via existing tooling
- **Structured interrogation** — for each concept, ask "how does this change with agent mediation?" → produce a diff, not a rewrite
- **bThread encoding** — composition rules as deterministic constitution factories

### Phase 1: MSS Autoresearch (Variant 5)

Calibrate `mss-vocabulary` skill until 100% classification accuracy.

```
LOOP:
  1. Give agent 20 natural language descriptions
  2. Agent reads mss-vocabulary skill → classifies each → outputs MSS tags
  3. Grade: exact match against reference tags (deterministic)
  4. Find misclassifications → analyze why → edit skill content
  5. Git commit → re-run → compare
  6. Keep if accuracy improves, discard if not
```

- **Variable:** `skills/mss-vocabulary/` content
- **Metric:** exact match rate across 5 MSS fields × 20 descriptions
- **Cost:** ~$0.50 per full evaluation (20 cheap classification calls)
- **Gate:** 100% accuracy before proceeding to Phase 2

### Phase 2: MSS Skeleton Generation (Variant 2)

Test module scaffolding — `initModule()` + `package.json` + `SKILL.md` — without behavior.

- **Grade:** `ModnetFieldSchema.parse()` + frontmatter validation + valid-combinations check
- **All deterministic** — no LLM judge needed
- **Variable:** `skills/modnet-node/` content
- **Metric:** MSS validation pass rate

### Phase 3: MSS Composition (Variant 3)

Test two modules that must connect — scale nesting, boundary cascade, dependency.

- **Grade:** scale nesting valid, dependency exists, boundary cascade respects restriction order
- **All deterministic**
- **Variable:** all MSS-related skills
- **Metric:** composition validity rate

### Phase 3.5: Multimodal Tool Implementations

Build the `ToolDefinition` + `ToolExecutor` wiring that lets Falcon invoke embedding, vision, and voice as tool calls. These must exist before Phase 4 (boot requires tools to be registered in the agent loop).

| Tool | Interface | Backend | What it does |
|---|---|---|---|
| `embed_search` | `Indexer.embed()` | EmbeddingGemma via MLX/vLLM | Semantic search over hypergraph memory. Cosine similarity on 768-dim vectors. |
| `analyze_image` | `Vision.analyze()` | Qwen 2.5 VL via MLX-VLM/vLLM | Image/video → structured description. Object localization, OCR. |
| `speak` | `Voice.speak()` | Qwen3-TTS via MLX-Audio/vLLM-Omni | Text → speech audio. Voice cloning, streaming. |

**Also needed:**
- MLX server wrappers for each model (similar to `scripts/falcon-mlx-server.ts`)
- OpenAI-compatible endpoint adapters for each interface
- Integration tests: tool_call → tool_result round-trip through the agent loop

**Gate:** All three tools callable via `createAgentLoop()` with mock and real backends.

### Phase 4: Layered Boot (Variant 4)

Progressive: MSS classification → skeleton → implementation → boot → judge.

| Layer | Gate | Fails → Calibrate |
|---|---|---|
| 0: MSS comprehension | Tags correct? | mss-vocabulary skill |
| 1: Module skeleton | ModnetFieldSchema validates? | modnet-node skill |
| 2: Implementation | tsc --noEmit? | code patterns |
| 3: Node composition | Node boots? WebSocket connects? | agent-loop skill |
| 4: Semantic verification | LLM judge + 3x meta-verification | rubric |

### Phase 5: Runtime Module Generation from Agent Card

**The production scenario.** Given an Agent Card with MSS metadata, can the agent generate a compatible module on-the-fly?

```
Input: Agent Card JSON (public + extended)
Output: Generated module with compatible MSS tags + UI + mechanics
Grade:
  1. MSS compatibility (generated module can nest in network's structure)
  2. Boundary respect (generated boundary ≤ network's boundary)
  3. Mechanics match (generated module declares mechanics the network supports)
  4. tsc passes
  5. Generative UI renders (Playwright snapshot + LLM judge)
```

### Phase 6: Full Proactive Cycle

Boot + sensor sweep + goal triggers + notification reaches mock endpoint + Playwright UI verification.

### Phase 7: SFT Trajectory Collection

Successful generation trajectories from Phases 4-6 ARE the SFT training data. No separate collection phase.

---

## Part 3: Cleanup & Refactoring (Before Experiments)

### Already Done
- Deleted: `module-grader.ts`, `proactive-grader.ts`, `bthread-trial.ts` (regex graders)
- Deleted: 6 old calibration/collection scripts
- Moved: `run-eval.ts` and `git-experiment.ts` from `scripts/` to `src/tools/`
- tsc clean, 1371 tests pass

### Still Needed
- `src/tools/judge.ts` → refactor to accept `Model` interface, drop Anthropic import
- `src/agent/sensors/git.ts` → move to skill reference (deployment-specific, not framework)
- `src/a2a/a2a.schemas.ts` → add `AgentExtension`, `inputModes`/`outputModes` on `AgentSkill`
- Process `Structural-IA.md` + `Modnet.md` → queryable form (JSON-LD or structured distillation)
- Write MSS comprehension test prompts (20 descriptions with reference MSS tags)
- Write MSS composition test prompts (module pairs that must connect)
- Write Agent Card fixtures for runtime module generation tests

---

## Part 4: Design Decisions (Settled)

| Decision | Resolution |
|---|---|
| Vendor lock-in | No vendor-specific imports in `src/tools/`. Judge uses `Model` interface. Sensors are skill references. Search is configurable via `.env.schema`. |
| Grader approach | Deterministic gates (tsc, MSS schema, boot) + LLM judge for semantics + meta-verification (3x agreement) |
| Sensors | Framework provides `SensorFactory` type. Implementations are deployment-specific, taught via skills. |
| Module generation | Runtime (from Agent Card) AND deploy-time (from natural language). Both paths matter. |
| Person ↔ person | Still exists, routed through agents. View sovereignty — each person's agent controls their view. |
| Boundary semantics | Unchanged. Agent delegates/evaluates, escalates when uncertain. DAC + MAC + ABAC already covers it. |
| Mechanics | Same definition as Jaffe. Activate across A2A boundaries. No UI/agent distinction needed. |
| Network duration | Goal bThread lifecycle (`repeat: true` vs terminate), not a new MSS tag. |
| MSS as A2A extension | `modnet:mss/v1` as formal `AgentExtension` URI. |

---

## Scripts

| Script | What it does |
|---|---|
| `bun run prompt` | Opus session with remote control for implementation |
| `bun run research` | Sonnet calibration loop (3 experiments, remote control) |
| `bun run research:overnight` | Sonnet calibration loop (50 experiments, remote control) |
| `bun falcon:mlx` | Start Falcon H1R 7B MLX inference server (port 8080) |

## Local Student Model: Falcon H1R 7B

**Models:**

| Model | Format | Size | Purpose |
|---|---|---|---|
| `mlx-community/Falcon-H1R-7B-4bit` | Q4 MLX | ~4.6 GB | Inference + student evaluation |
| `tiiuae/Falcon-H1R-7B` | FP16 | ~14 GB | Training base (LoRA + full fine-tune) |

**Architecture:** Hybrid Transformer-Mamba — 12 standard attention heads + 2 Mamba-2 SSM heads per layer. The SSM heads give efficient long-context and persistent state; the attention heads handle reasoning. Consumer LoRA trains attention heads only; enterprise full-parameter trains both.

| Component | Location |
|---|---|
| MLX adapter | `scripts/falcon-h1r-mlx-adapter.ts` |
| MLX server launcher | `scripts/falcon-mlx-server.ts` |
| Python venv | `.venv/` (mlx-lm, huggingface-hub, Python 3.12) |
| Model cache | HuggingFace cache (`~/.cache/huggingface/`) |

**Adapter contract:** OpenAI-compatible `/v1/chat/completions` — same endpoint for MLX, llama.cpp, or vLLM. When switching hardware, write a new server launcher (e.g., `falcon-llamacpp-server.ts` for CUDA), keep the adapter pointing at localhost.

**Hardware tiers (matches training-pipeline skill):**

| Tier | Hardware | Method | What |
|---|---|---|---|
| Inference (current) | M3 Pro 18 GB (~22 tok/s) | Q4 MLX | Autoresearch inference loop |
| Consumer LoRA | Mac Studio M4/M5 Max or AI Max 395 mini PC | LoRA on attention layers via MLX/Unsloth | Adapt to deployment environment |
| Enterprise full-parameter | Cloud H100 (~$25/run) | Full SFT + GRPO | Train all parameters including Mamba-2 SSM heads |

**Train → Quantize → Evaluate cycle:**

```
tiiuae/Falcon-H1R-7B (FP16 base, ~14 GB)
    │
    ├─ Consumer LoRA → adapter (~200 MB) → merge into base
    │                                           │
    └─ Enterprise Full FT ──────────────────────┤
                                                │
                                          Fine-tuned FP16
                                                │
                                          Quantize → Q4 (~4.6 GB)
                                                │
                                          Deploy locally via MLX
                                                │
                                          Evaluate via compare-trials
                                                │
                                          Gap shrunk? → next Phase
                                          Gap remains? → more trajectories → retrain
```

Training is iterative — each Phase produces trajectories, train after each phase (don't wait until Phase 7). LoRA adapters are stackable: train separate adapters for MSS comprehension, code generation, and proactive behavior, then merge.

**Role in pipeline:** Falcon H1R is the **student model**. Frontier agents (Claude Code, Gemini CLI) are **teachers** generating SFT trajectories in Phases 4–6. The local adapter enables student evaluation via `runTrial()` + `compare-trials` to measure the teacher–student gap after each training cycle.

---

## Sequencing

```
Process source material (Structural-IA + Modnet → queryable form)
    ↓
Phase 1: MSS comprehension calibration (cheap, fast, many iterations)
    ↓
Phase 2: Module skeleton generation
    ↓
Phase 3: MSS composition tests
    ↓
─── First training checkpoint ───────────────────────────────
    Trajectories from Phases 1–3 → LoRA on MSS comprehension
    Quantize → evaluate student → measure gap
─────────────────────────────────────────────────────────────
    ↓
Phase 3.5: Multimodal tool implementations
    (embed_search, analyze_image, speak → ToolExecutor wiring)
    ↓
Phase 4: Layered boot (progressive gates)
    ↓
Phase 5: Runtime module generation from Agent Card
    ↓
─── Second training checkpoint ──────────────────────────────
    Trajectories from Phases 4–5 → LoRA on code generation
    Merge adapters → quantize → evaluate → measure gap
─────────────────────────────────────────────────────────────
    ↓
Phase 6: Full proactive cycle
    ↓
─── Final training checkpoint ───────────────────────────────
    All trajectories → enterprise full-parameter on cloud H100
    Quantize → full evaluation across all phases
─────────────────────────────────────────────────────────────
    ↓
Deploy first node
```
