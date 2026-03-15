# Worktree Prompts — Final Phase

Framework refinement via frontier agent evaluation. Skills calibrated by generating modnet modules, grading results, and iterating. SFT data collected from successful trajectories.

---

## Phase 0: Cleanup (Do First)

### Prompt 1: Fix Grader Cleanup + Remove Old Package References

```
Work in a worktree branch off local dev branch.

## Task

Fix two housekeeping issues: orphaned .bthread-grader-* temp directories and stale references to removed packages.

## What to Do

### 1. Fix bthread-grader cleanup

40+ orphaned `.bthread-grader-*` directories exist in `src/`. The grader creates temp dirs but doesn't clean them on crash/timeout.

In `src/tools/bthread-grader.ts`:
- Ensure the `finally` block in the grading function always runs cleanup (even on unhandled errors)
- Add a pre-run cleanup: at grader startup, delete any existing `.bthread-grader-*` dirs in the working directory
- Verify `.gitignore` has `**/.bthread-grader-*` pattern (already added, confirm)

Delete all existing orphaned dirs:
```bash
find src -maxdepth 1 -name ".bthread-grader-*" -type d -exec rm -rf {} +
```

### 2. Remove @plaited/agent-eval-harness and @plaited/development-skills references

These packages no longer exist. Replace all references:

| File | What to Change |
|---|---|
| `AGENTS.md` | Replace `bunx @plaited/development-skills validate-skill` with current CLI command |
| `README.md` | Remove/update any references |
| `docs/GENOME.md` | Replace validation command references |
| `PROMPTS.md` | Replace validation command references |
| `skills/modnet-node/references/module-architecture.md` | Replace references |

Search codebase-wide: `grep -r "@plaited/agent-eval-harness\|@plaited/development-skills" --include="*.md" --include="*.ts" --include="*.json"`

### 3. Delete orphaned grader directories

```bash
find src -maxdepth 1 -name ".bthread-grader-*" -type d -exec rm -rf {} +
```

## Constraints

- Run `bun --bun tsc --noEmit` and `bun test src/ skills/` before committing
```

---

## Phase 1: Framework Infrastructure

### Prompt 2: Module-Per-Repo Workspace Utilities

```
Work in a worktree branch off local dev branch.

## Task

Create workspace initialization utilities for modnet node and module creation. This is framework code in src/modnet/.

## Context

The module-per-repo architecture is defined in docs/MODNET-IMPLEMENTATION.md and skills/modnet-node/. Each node is a git repo with modules/ subdirectory. Each module has its own git repo, package.json with @node/ scope, skills/, .memory/, and data/ directories. Bun workspace resolution (workspace:*) handles inter-module imports.

## What to Build

### 1. Node Workspace Init (src/modnet/workspace.ts)

```typescript
export const initNodeWorkspace = async (opts: {
  path: string
  scope: string        // e.g., "@mynode"
  name?: string
}): Promise<void> => {
  // 1. git init
  // 2. Create package.json with "workspaces": ["modules/*"], "private": true
  // 3. Create tsconfig.json
  // 4. Create .gitignore (modules/, node_modules/, .bthread-grader-*)
  // 5. Create .memory/ with @context.jsonld, sessions/, constitution/
  // 6. bun install
}
```

### 2. Module Init (src/modnet/workspace.ts)

```typescript
export const initModule = async (opts: {
  nodePath: string
  name: string
  modnet?: { contentType: string; structure: string; mechanics?: string; boundary: string; scale: number }
}): Promise<void> => {
  // 1. Create modules/{name}/ directory
  // 2. git init inside it
  // 3. Create package.json with @node/ scope, modnet field, workspace:* deps
  // 4. Create skills/{name}/ seed skill directory with SKILL.md
  // 5. Create .memory/ directory
  // 6. Create data/ directory
  // 7. Run bun install at node root to link workspace
}
```

### 3. CLI Commands

Add to src/cli.ts:
- `plaited init-node <path>` — creates a new node workspace
- `plaited init-module <name>` — creates a module in current node workspace

### 4. Schemas

Zod schemas for the MSS modnet field (contentType, structure, mechanics, boundary, scale) in src/modnet/modnet.schemas.ts.

Tests in src/modnet/tests/workspace.spec.ts — test init creates correct file structure, git repos, package.json format.

## Key Files

- src/modnet/modnet.constants.ts — NODE_ROLE, MODNET_METADATA (existing)
- skills/modnet-node/ — reference patterns
- docs/MODNET-IMPLEMENTATION.md — architecture spec

## Constraints

- Use Bun APIs (Bun.write, Bun.$`git init`)
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

### Prompt 3: Server + Agent Integration

```
Work in a worktree branch off local dev branch.

## Task

Wire createServer with createAgentLoop — the integration from CLAUDE.md's open question.

## What to Build

### 1. createNode factory (src/modnet/node.ts)

Composes server + agent + A2A into a running node:

```typescript
export const createNode = async (opts: {
  model: Model
  tools: ToolDefinition[]
  toolExecutor?: ToolExecutor
  constitution?: ConstitutionFactory[]
  goals?: GoalFactory[]
  memoryPath: string
  port?: number
  tls?: TLSOptions
  allowedOrigins?: Set<string>
  validateSession?: (sid: string) => boolean
  agentCard?: AgentCard
}): Promise<{ server: ServerHandle; agent: AgentNode; a2a?: { routes: ServeRoutes } }> => {
  const agent = createAgentLoop({ model, tools, toolExecutor, constitution, goals, memoryPath })

  const a2aHandler = agentCard ? createA2AHandler({
    card: agentCard,
    handlers: { sendMessage: (params, signal) => { /* bridge to agent.trigger */ } },
  }) : undefined

  const authRoutes = validateSession ? {} : {} // from node-auth skill

  const server = createServer({
    trigger: agent.trigger,
    routes: { ...a2aHandler?.routes, ...authRoutes },
    port, tls, allowedOrigins, validateSession,
  })

  return { server, agent, a2a: a2aHandler }
}
```

### 2. Tests

Integration test: create a node, connect a WebSocket client, send a task, verify the loop processes it and sends back a message.

## Key Files

- src/agent/agent.loop.ts — createAgentLoop
- src/server/server.ts — createServer
- src/a2a/a2a.server.ts — createA2AHandler

## Constraints

- This is framework code, not a skill
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

### Prompt 4: Model Implementation (Ollama / vLLM / API)

```
Work in a worktree branch off local dev branch.

## Task

Create Model interface implementations for common inference backends.

## What to Build

### 1. OpenAI-Compatible Model (src/agent/models/openai-compat.ts)

Works with Ollama, vLLM, llama.cpp, Together AI, OpenRouter, Fireworks — anything with OpenAI-compatible API:

```typescript
export const createOpenAICompatModel = (opts: {
  baseUrl: string          // e.g., "http://localhost:11434/v1" for Ollama
  apiKey?: string
  model: string            // e.g., "falcon-h1r:7b"
  defaultTimeout?: number
}): Model => ({
  reason: async function*(context) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey && { Authorization: `Bearer ${apiKey}` }) },
      body: JSON.stringify({ model, messages: context.messages, tools: context.tools, stream: true }),
      signal: context.signal,
    })
    // Parse SSE stream → yield ModelDelta (thinking_delta, text_delta, toolcall_delta, done, error)
  }
})
```

### 2. Anthropic Model (src/agent/models/anthropic.ts)

For Claude API (distillation source):

```typescript
export const createAnthropicModel = (opts: { apiKey: string; model?: string }): Model
```

### 3. Google Gemini Model (src/agent/models/gemini.ts)

For Gemini API (meta-verification):

```typescript
export const createGeminiModel = (opts: { apiKey: string; model?: string }): Model
```

Each implementation:
- Streams via SSE or native SDK streaming
- Yields `ModelDelta` (thinking_delta, text_delta, toolcall_delta, done, error)
- Respects AbortSignal
- Handles rate limiting (429 → exponential backoff)

Tests with mock HTTP servers.

## Constraints

- No new dependencies for OpenAI-compat (just fetch + SSE parsing — reuse from src/a2a/a2a.utils.ts)
- `bun add @anthropic-ai/sdk` for Anthropic model
- `bun add @google/generative-ai` for Gemini model (or use OpenAI-compat endpoint)
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

---

## Phase 2: MSS Skills + Eval Infrastructure

### Prompt 5: MSS Vocabulary Skill (Distill Structural-IA + Modnet.md)

```
Work in a worktree branch off local dev branch.

## Task

Create an MSS vocabulary skill that distills the actionable rules from Structural-IA.md (1648 lines) and Modnet.md (454 lines) into a compact, machine-consumable format. This skill teaches coding agents how to generate modules that conform to MSS standards.

## Context

These two docs contain Rachel Jaffe's design philosophy for modular networks. Most of the content is conceptual narrative. The actionable parts — the MSS tag vocabulary, valid combinations, composition rules, scale nesting — need to be extracted into a skill that a coding agent can consume efficiently.

This is NOT about converting docs to bThreads directly. It's about creating the skill that teaches an agent the rules, so the agent can GENERATE bThreads that enforce those rules.

## What to Build

### 1. skills/mss-vocabulary/SKILL.md

```yaml
name: mss-vocabulary
description: MSS (Modnet Structural Standard) bridge-code vocabulary for module generation. Defines valid tag values, composition rules, scale nesting, and boundary semantics. Use when generating modules, validating MSS tags, or creating constitution bThreads that enforce MSS rules.
```

Content:
- MSS tag definitions (contentType, structure, mechanics, boundary, scale) with valid values
- Composition rules: which tags combine validly
- Scale nesting: how scale determines module composition (S1 inside S3, not reverse)
- Boundary semantics: all/none/ask/paid — what each means for A2A data sharing
- Mechanics auto-population: how mechanics tags activate based on connected structures

### 2. skills/mss-vocabulary/references/

- `structural-ia-distilled.md` — Extract from Structural-IA.md: objects, channels, levers, loops, modules, blocks as they map to MSS tags. ~100 lines distilled from 1648.
- `modnet-standards-distilled.md` — Extract from Modnet.md: bridge-code syntax, module patterns, crowd-sourced network structures. ~80 lines distilled from 454.
- `valid-combinations.md` — Table of valid MSS tag combinations with examples

### 3. skills/mss-vocabulary/assets/mss-patterns.jsonl

Machine-readable MSS tag patterns:

```jsonl
{"contentType": "produce", "structure": "list", "mechanics": ["sort", "filter"], "boundary": "ask", "scale": 3, "example": "Farm inventory with sortable produce listings"}
{"contentType": "social", "structure": "feed", "mechanics": ["post", "like", "follow"], "boundary": "ask", "scale": 3, "example": "Social media feed with interactions"}
{"contentType": "health", "structure": "form", "mechanics": ["track", "chart"], "boundary": "none", "scale": 2, "example": "Personal health metric tracker"}
```

## Key Files

- docs/Structural-IA.md — source (1648 lines, keep unchanged)
- docs/Modnet.md — source (454 lines, keep unchanged)
- src/modnet/modnet.constants.ts — NODE_ROLE (existing)

## Constraints

- DO NOT modify Structural-IA.md or Modnet.md — these are reference documents
- The skill DISTILLS actionable rules, it doesn't reproduce the full narrative
- Validate: `bunx plaited validate-skill skills/mss-vocabulary`
```

### Prompt 6: Enrich modnet-node Skill

```
Work in a worktree branch off local dev branch.

## Task

Expand skills/modnet-node/ from 97 lines to ~250+ with complete implementation patterns for module generation.

## What to Add

- A2A binding code examples (createA2AHandler composition, transport selection)
- Access control implementation patterns (DAC/MAC/ABAC block predicates)
- Enterprise topology detail (PM node provisioning flow, infrastructure node setup)
- Module generation patterns (how to create a module from MSS tags using initModule)
- workspace.ts usage examples (initNodeWorkspace, initModule from Prompt 2)

Reference the mss-vocabulary skill for tag definitions.

## Constraints

- Validate: `bunx plaited validate-skill skills/modnet-node`
```

### Prompt 7: Trial Adapter + Eval Result Persistence

```
Work in a worktree branch off local dev branch.

## Task

Create trial adapters for frontier agents and wire eval result persistence to the hypergraph.

## What to Build

### 1. Adapter Schemas (src/tools/adapters/)

JSON adapter schemas for frontier agents (same pattern as web-search-agent-evals):

- `claude-code.json` — Claude Code via `claude -p` with `--output-format stream-json`
- `codex.json` — OpenAI Codex CLI
- `gemini.json` — Gemini CLI

Each schema maps the agent's stdout events to trial runner events (message, tool_call, result).

### 2. Library Import Adapter (src/tools/adapters/local.ts)

For fast pass@k evaluation without subprocess overhead:

```typescript
export const createLocalAdapter = (opts: {
  model: Model
  tools: ToolDefinition[]
  toolExecutor: ToolExecutor
  memoryPath: string
}): TrialAdapter => async ({ prompt }) => {
  const agent = createAgentLoop({ ...opts, sessionId: crypto.randomUUID() })
  // trigger task, collect events, return output + trajectory
  agent.destroy()
  return { output, trajectory }
}
```

### 3. Eval Result Persistence (src/tools/trial.utils.ts)

After trial completion, commit results to hypergraph memory:

```typescript
export const persistTrialResults = async (results: TrialResult[], memoryPath: string) => {
  const evalDir = join(memoryPath, 'evals')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = join(evalDir, `trial-${timestamp}.jsonl`)
  const content = results.map(r => JSON.stringify(r)).join('\n')
  await Bun.write(path, content + '\n')
  // git add + commit
  await Bun.$`git add ${path} && git commit -m "eval: trial results ${timestamp}"`.cwd(join(memoryPath, '..'))
}
```

Results are git-versioned and queryable via hypergraph. Generated code artifacts are NOT persisted — only the grading results.

### 4. Update bthread-grader

Ensure temp directories are cleaned up in `finally` block (cross-reference with Prompt 1).

## Key Files

- src/tools/trial.ts — existing trial runner
- src/tools/trial.schemas.ts — TrialResult schema
- skills/trial-adapters/ — adapter patterns
- src/agent/agent.loop.ts — createAgentLoop

## Constraints

- Adapter schemas are JSON config files, not TypeScript
- Library adapter imports createAgentLoop directly
- Results persisted as JSONL in .memory/evals/, git-committed
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

---

## Phase 3: Module Generation Prompts + Eval

### Prompt 8: Module Generation Prompts (MiniAppBench-Adapted)

```
Work in a worktree branch off local dev branch.

## Task

Create module generation eval prompts adapted from MiniAppBench's methodology, covering 6 domains. Include a Bluesky client module as a flagship prompt.

## Context

MiniAppBench evaluates LLM-generated interactive HTML apps across three dimensions:
- **Intention** — does it fulfill the user's goal and capture implicit real-world principles?
- **Static** — structural correctness without execution (parsing, file structure, types)
- **Dynamic** — runtime behavior via exploratory testing (interactions, state transitions)

We adapt this for modnet modules: Intention = MSS specification adherence. Static = package structure + types + SKILL.md. Dynamic = behavioral programs + UI rendering.

## What to Build

### 1. Prompt Format

Each prompt is a JSONL entry with MiniAppBench-style eval references:

```jsonl
{"id": "bluesky-client", "query": "Create a Bluesky social client module...", "domain": "Social", "subclass": "Social Media", "difficulty": "Hard", "eval_ref": {"intention": [...], "static": [...], "dynamic": [...]}, "metadata": {"mss": {...}}, "hint": "Use @atproto/api package..."}
```

### 2. Prompt Categories (20 prompts across 6 domains)

**Data (4 prompts):**
- Diet tracker with calorie counting and weekly charts
- Expense logger with category breakdowns
- Inventory manager with barcode scanning placeholder
- Reading list with progress tracking

**Social (3 prompts):**
- Bluesky client with feed, posting, profiles, follows (flagship)
- Simple chat module with message history
- Discussion forum with threads and replies

**Visualization (3 prompts):**
- Weather dashboard with current conditions and forecast
- Data chart generator from JSON input
- Interactive map with markers and popups

**Tools (4 prompts):**
- Unit converter with category tabs
- Scheduling/calendar module with event creation
- Markdown editor with live preview
- Color palette generator with hex/rgb output

**Creative (3 prompts):**
- Portfolio gallery with project cards and filtering
- Simple drawing canvas with tools
- Music playlist manager with playback controls

**Science (3 prompts):**
- Newton's laws simulator (pendulum, projectile)
- Periodic table explorer with element details
- Simple statistics calculator with visualization

### 3. Bluesky Client Module (Flagship Detail)

```jsonl
{
  "id": "bluesky-client",
  "query": "Create a Bluesky social client module. It should let a user authenticate with their Bluesky credentials, view their timeline feed, create new text posts, view user profiles, and follow/unfollow users. Use the @atproto/api package for the AT Protocol.",
  "domain": "Social",
  "subclass": "Social Media",
  "difficulty": "Hard",
  "eval_ref": {
    "intention": [
      "authenticates with Bluesky credentials via createSession",
      "displays timeline feed with post content and author info",
      "creates new text posts via createRecord",
      "shows user profiles with follower/following counts",
      "supports follow/unfollow actions"
    ],
    "static": [
      "has package.json with @atproto/api dependency",
      "has modnet field: contentType social, structure feed, boundary ask",
      "has SKILL.md seed with name and description",
      "TypeScript compiles without errors",
      "has .memory/ directory"
    ],
    "dynamic": [
      "login form accepts handle and app password",
      "feed renders after authentication",
      "new post appears in feed after creation",
      "profile page shows user details",
      "follow button toggles state"
    ]
  },
  "metadata": {
    "mss": {"contentType": "social", "structure": "feed", "mechanics": "post,like,follow", "boundary": "ask", "scale": 3},
    "dependencies": ["@atproto/api"]
  },
  "hint": "Use @atproto/api BskyAgent class. Login via agent.login(). Get timeline via agent.getTimeline(). Create post via agent.post(). API base URL is https://bsky.social."
}
```

### 4. Module Generation Grader (src/tools/module-grader.ts)

Three-dimension grader matching MiniAppBench eval:

**Intention grading:** LLM-as-judge checks each eval_ref.intention item against generated code.
**Static grading:** Automated checks — tsc, package.json structure, SKILL.md presence, modnet field.
**Dynamic grading:** If Playwright is available, run dynamic checks. Otherwise, fall back to code analysis (are event handlers present? are state transitions implemented?).

Scoring: intention (0-1) × static (0-1) × dynamic (0-1) → composite score.

### 5. Save prompts

```
skills/modnet-modules/
  SKILL.md                ← describes module generation eval
  assets/
    prompts.jsonl         ← all 20 prompts
    ground-truth/
      bluesky-client/     ← reference implementation hints (not full code)
```

## Key Files

- src/tools/bthread-grader.ts — reference for grader pattern
- src/tools/trial.ts — trial runner
- skills/mss-vocabulary/ — MSS tag definitions (from Prompt 5)
- skills/modnet-node/ — module architecture patterns
- docs/MODNET-IMPLEMENTATION.md — architecture reference

## Constraints

- Prompts are JSONL — one per line, parseable by trial runner
- Grader combines automated checks (tsc, structure) with LLM-as-judge (intention)
- Playwright for dynamic grading is OPTIONAL (degrade gracefully)
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

### Prompt 9: Run Eval Cycle + Calibrate Skills

```
Work in a worktree branch off local dev branch.

## Task

Run the first evaluation cycle: frontier agents generate modules from prompts, grade results, identify skill gaps, iterate.

## Process

### 1. Configure Trial Run

```typescript
// Run with Claude Code as generation agent
const results = await runTrial({
  adapter: 'adapters/claude-code.json',
  prompts: 'skills/modnet-modules/assets/prompts.jsonl',
  k: 3,                    // 3 attempts per prompt
  grader: moduleGrader,
  workspace: '/tmp/module-eval',
})
```

### 2. Analyze Results

Use compare-trials skill to analyze:
- pass@k by domain (which module types succeed/fail?)
- pass@k by difficulty (Easy/Mid/Hard)
- Intention vs Static vs Dynamic breakdown (where do failures occur?)
- Common failure patterns (missing MSS tags? broken behavioral programs? UI rendering issues?)

### 3. Calibrate Skills

Based on failure analysis:
- If modules lack MSS tags → improve mss-vocabulary skill with more examples
- If behavioral programs don't work → improve behavioral-core skill with module-specific patterns
- If UI doesn't render → improve generative-ui skill with module rendering patterns
- If package structure is wrong → improve modnet-node skill with clearer structure requirements

### 4. Persist Results

Commit trial results to .memory/evals/ as JSONL (per Prompt 7 persistence).

### 5. Iterate

Re-run with calibrated skills. Compare pass@k improvements. Repeat until pass@1 > 0.7 for Easy, > 0.5 for Mid.

## Key Files

- src/tools/trial.ts — trial runner
- src/tools/module-grader.ts — from Prompt 8
- skills/modnet-modules/assets/prompts.jsonl — from Prompt 8
- All skills — calibration targets

## Constraints

- This prompt is operational — it's a process, not code to write
- Document findings in a results.md or commit message
- Each iteration should improve at least one skill
```

---

## Phase 4: Distillation Data Collection

### Prompt 10: Collect SFT Trajectories from Frontier Agents

```
Work in a worktree branch off local dev branch.

## Task

Collect successful generation trajectories from frontier agents for SFT distillation.

## Process

### 1. Select Successful Generations

From the eval results (Phase 3), identify generations that scored > 0.8 composite across all three dimensions.

### 2. Re-run with Rich Trajectory Capture

For each successful prompt:
```bash
# Run with trajectory capture enabled
plaited trial --adapter adapters/claude-code.json \
  --prompts skills/modnet-modules/assets/prompts.jsonl \
  --k 1 --capture-trajectory \
  --output trajectories/claude-code/
```

The trajectory includes: thinking, tool calls, tool results, BP decisions, file operations.

### 3. Multi-Agent Diversity

Run the same prompts through multiple frontier agents:
- Claude Code (Opus 4.6) — primary distillation source
- Gemini CLI (2.5 Pro) — alternative reasoning patterns
- Codex (GPT-5.4) — different tool-calling patterns

Diversity in trajectories improves distillation quality.

### 4. Format for SFT

Convert captured trajectories to SFT training format:
- System prompt (from our context assembly)
- User message (the module generation prompt)
- Assistant response (the full trajectory: thinking + tool calls + code output)

### 5. Quality Gate

Use withStatisticalVerification to grade trajectories:
- Only trajectories where grader passes all three dimensions (intention ≥ 0.8, static = 1.0, dynamic ≥ 0.7) become training data
- Meta-verify grader reliability: run grader k=5 on each trajectory, check consistency

## Key Files

- src/tools/trial.ts — trial runner with trajectory capture
- src/tools/training.ts — withStatisticalVerification, GradingDimensions
- skills/training-pipeline/ — distillation stage reference

## Constraints

- This is an operational process that produces data files
- Trajectories stored in trajectories/ directory (gitignored, backed up separately)
- SFT data validated against training-pipeline skill format requirements
```

---

## Summary

| # | Prompt | Phase | Dependencies |
|---|---|---|---|
| 1 | Fix grader cleanup + remove old package refs | 0 (cleanup) | None |
| 2 | Module-per-repo workspace utilities | 1 (infra) | None |
| 3 | Server + agent integration (createNode) | 1 (infra) | None |
| 4 | Model implementations (Ollama/Anthropic/Gemini) | 1 (infra) | None |
| 5 | MSS vocabulary skill (distill Structural-IA + Modnet.md) | 2 (skills) | None |
| 6 | Enrich modnet-node skill | 2 (skills) | After 2, 5 |
| 7 | Trial adapter + eval result persistence | 2 (infra) | After 4 |
| 8 | Module generation prompts + grader | 3 (eval) | After 5, 6, 7 |
| 9 | Run eval cycle + calibrate skills | 3 (eval) | After 8 |
| 10 | Collect SFT trajectories | 4 (training) | After 9 |

**Parallel execution:**
- Phase 0: Prompt 1 (do first)
- Phase 1: Prompts 2, 3, 4 (all parallel)
- Phase 2: Prompts 5, 6, 7 (5 parallel with 2-4; 6 after 2+5; 7 after 4)
- Phase 3: Prompts 8, 9 (sequential — 8 then 9)
- Phase 4: Prompt 10 (after 9)
