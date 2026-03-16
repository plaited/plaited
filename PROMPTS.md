# Worktree Prompts

## Phase 5 — Proactive Framework Primitives

Wire the proactive infrastructure (heartbeat, sensors, goals, push routing) into the framework. These are framework seams — concrete sensors, goals, and notification channels are deployment-specific generation targets, not framework code.

```
Dependency chain:
  10 (wire proactive) ─┬─→ 11 (sensor contract + git ref impl)
                        ├─→ 12 (set_heartbeat + proactive context)
                        └─→ 13 (message source + push routing)
                                    │
                                    ▼
                        14 (skill content for generation)
                                    │
                                    ▼
                        15 (eval prompts + grader)
```

### Prompt 10: Wire Proactive Primitives into createAgentLoop

```
Work in a worktree branch off local dev branch.

## Task

Wire the three proactive exports from `src/agent/proactive.ts` into
`createAgentLoop` and `createNode`, making proactive mode opt-in via
`CreateAgentLoopOptions`.

## Context

`createHeartbeatTimer`, `createTickYieldThread`, and `createSensorBatchThread`
are implemented and tested in `src/agent/proactive.ts` but have zero external
references (confirmed via LSP). The `taskGate` bThread in `agent.loop.ts:240`
only accepts `task` events — the proactive design doc says it should accept
`tick` too.

## Requirements

1. Add opt-in proactive config to `CreateAgentLoopOptions`:
   - `proactive?: { intervalMs?: number; sensors?: SensorFactory[] }`
   - Default intervalMs: 900_000 (15 min)

2. When `proactive` is provided in options:
   - Modify `taskGate` to `waitFor: (e) => e.type === 'task' || e.type === 'tick'`
   - Register `tickYield` bThread via `bThreads.set()`
   - Create `HeartbeatHandle` via `createHeartbeatTimer({ trigger, intervalMs })`
   - Include handle in `AgentNode.destroy()` cleanup
   - Add a `tick` handler to `useFeedback` that runs sensors (if any)
     and creates `sensorBatch` bThread

3. When `proactive` is NOT provided:
   - Behavior unchanged — taskGate only waits for `task`
   - No timer created, no tick handling

4. Wire into `createNode` in `src/modnet/node.ts`:
   - Pass `proactive` from `CreateNodeOptions` → `createAgentLoop`
   - Expose `heartbeat` handle on `NodeHandle` for runtime control

5. Update existing tests — `taskGate` behavior changes when proactive is enabled.
   Add new tests for:
   - Tick fires and enters pipeline when no task active
   - Tick blocked when task is active (taskGate)
   - User task interrupts proactive cycle (tickYield)
   - Heartbeat cleanup on destroy

## Key Files

- src/agent/proactive.ts — existing implementations
- src/agent/agent.loop.ts — createAgentLoop (wire here)
- src/agent/agent.types.ts — CreateAgentLoopOptions, AgentNode
- src/modnet/node.ts — createNode
- src/modnet/node.types.ts — CreateNodeOptions, NodeHandle
- src/agent/tests/proactive.spec.ts — existing tests

## Constraints

- Proactive is opt-in. Default behavior (no `proactive` option) must not change.
- Do not implement sensors yet (Prompt 11). The tick handler should accept a
  `sensors` array but work correctly with an empty array (fires tick, no deltas,
  model decides to sleep or act).
- Follow existing patterns: `bThreads.set()` before `trigger()`,
  per-call dynamic threads, interrupt for cleanup.
```

### Prompt 11: Sensor Contract + Factory Type

```
Work in a worktree branch off local dev branch.

## Task

Define the `SensorFactory` type contract and a reference `createGitSensor`
implementation that the agent-loop skill can teach as a generation pattern.

## Context

`createSensorBatchThread` coordinates N sensor deltas but there's no type
contract for what a sensor IS. The proactive design doc (proactive-mode.md:42-76)
shows the pattern: read current → load last snapshot → diff → fire delta.
This needs to be a typed interface so skills can teach frontier agents to
generate deployment-specific sensors.

## Requirements

1. Define types in `src/agent/agent.types.ts`:
   - `SensorSnapshot = { timestamp: string; data: unknown }`
   - `SensorFactory = { name: string; read: (signal: AbortSignal) => Promise<unknown>; diff: (current: unknown, previous: SensorSnapshot | null) => unknown | null; snapshotPath: string }`

2. Implement `createGitSensor` in `src/agent/sensors/git.ts`:
   - `read()`: runs `git log --oneline -10` + `git status --porcelain`
   - `diff()`: compares HEAD SHA and working tree status to previous snapshot
   - Returns delta with: `newCommits: string[]`, `statusChanges: string[]`
   - `snapshotPath`: relative to `.memory/sensors/`

3. Wire sensor execution into the `tick` handler from Prompt 10:
   - Load snapshots from disk (Bun.file)
   - Run all sensors in parallel (Promise.all)
   - For each non-null diff, trigger `sensor_delta`
   - Save new snapshots to disk (Bun.write)
   - Create `sensorBatch` bThread with delta count
   - If zero deltas, trigger `sleep`

4. Tests in `src/agent/tests/sensors.spec.ts`:
   - Git sensor reads correctly from a temp repo
   - Diff detects new commits
   - Diff returns null when nothing changed
   - Snapshot persistence round-trips

## Key Files

- src/agent/agent.types.ts — add SensorFactory, SensorSnapshot
- src/agent/sensors/git.ts — reference implementation (NEW)
- src/agent/proactive.ts — may need sensor execution helper
- src/agent/agent.loop.ts — tick handler wiring

## Constraints

- Sensors are read-only. They must NOT modify the environment.
- `read()` receives an AbortSignal for timeout control.
- Snapshot storage is simple JSON files — no database.
- The git sensor is a reference implementation. Other sensors
  (filesystem, HTTP, etc.) are generation targets, not framework code.
```

### Prompt 12: set_heartbeat Tool + Proactive Context Framing

```
Work in a worktree branch off local dev branch.

## Task

Add the `set_heartbeat` tool and a proactive context contributor so the
model can control its own tick interval and receive appropriate framing
during proactive cycles.

## Context

The design doc (proactive-mode.md:121-135) describes `set_heartbeat` as a
tool call, not a config file. `HeartbeatHandle.setInterval()` already exists.
The model also needs different framing during proactive inference —
"Here are your goals, here is sensor data, is action needed?" vs the
normal reactive system prompt.

## Requirements

1. Add `set_heartbeat` tool definition in `src/tools/crud.schemas.ts`:
   - Parameter: `interval_seconds` (number, minimum 0)
   - 0 = pause, any positive value = set interval
   - Risk tags: `[RISK_TAG.workspace]` (safe, skip simulation)

2. Add handler in `src/tools/crud.ts`:
   - Calls `heartbeatHandle.setInterval(seconds * 1000)`
   - Returns `{ interval_seconds, status: 'active' | 'paused' }`

3. Add `proactiveContextContributor` in `src/agent/agent.context.ts`:
   - Priority 90 (below system prompt, above rejections)
   - Only contributes when current cycle was triggered by `tick` (not `task`)
   - Content: sensor deltas summary, active goal descriptions,
     "Based strictly on this context, is any action required? If no,
     respond with text only. If yes, produce tool calls."
   - Needs a way to know if current cycle is proactive (flag set by tick handler)

4. Tests:
   - set_heartbeat tool changes interval
   - set_heartbeat with 0 pauses
   - Proactive contributor only contributes during tick cycles
   - Proactive contributor is null during task cycles

## Key Files

- src/tools/crud.schemas.ts — SetHeartbeatConfigSchema
- src/tools/crud.ts — handler + BUILT_IN_RISK_TAGS entry
- src/agent/agent.context.ts — proactiveContextContributor
- src/agent/agent.loop.ts — pass heartbeat handle to tool handler

## Constraints

- The tool handler needs access to the HeartbeatHandle. Pass it through
  ToolContext or closure — follow existing patterns.
- The proactive contributor must be zero-cost during reactive cycles
  (return null when not in a tick cycle).
```

### Prompt 13: Message Source Tag + Push Routing

```
Work in a worktree branch off local dev branch.

## Task

Add a `source` field to `MessageDetail` and route proactive messages
through the server's WebSocket pub/sub.

## Context

The server at `src/server/server.ts` has working pub/sub. `MessageDetail`
at `agent.types.ts:373` currently has only `content: string`. The design
doc (proactive-mode.md:155-169) shows proactive messages should be
published to the session's WebSocket channel. If no client is connected,
the `sessionGate` bThread already blocks pipeline events — proactive
actions naturally queue.

## Requirements

1. Extend `MessageDetail` in `src/agent/agent.types.ts`:
   - Add `source?: 'reactive' | 'proactive'`

2. In `agent.loop.ts`, the `tick` handler sets `source: 'proactive'`
   when triggering inference from a tick cycle. The `task` handler
   continues to omit it (defaults to reactive).

3. In `createNode` (`src/modnet/node.ts`), subscribe to `message` events
   and route proactive messages to the server:
   - Check `detail.source === 'proactive'`
   - Publish to session's WebSocket channel with type `'notification'`

4. Tests:
   - Reactive messages have no source (or source === 'reactive')
   - Proactive messages carry source === 'proactive'
   - createNode routes proactive messages to server.publish

## Key Files

- src/agent/agent.types.ts — MessageDetail
- src/agent/agent.loop.ts — tick handler, message handler
- src/modnet/node.ts — createNode subscription
- src/modnet/node.types.ts — if NodeHandle needs changes

## Constraints

- Backward compatible — `source` is optional. Existing code that creates
  messages without source continues to work.
- External notification channels (email, Slack, SMS) are generation targets,
  not framework code. The framework provides the routing seam; a skill
  teaches the agent to generate channel-specific handlers per deployment.
```

### Prompt 14: Proactive Skill Content for Node Generation

```
Work in a worktree branch off local dev branch.

## Task

Extend the `agent-loop` skill's proactive-mode reference with generation
patterns for sensors, goals, and notification channels. This is what
frontier agents read when generating a proactive node from a seed.

## Context

The framework provides: HeartbeatHandle, SensorFactory contract,
SensorBatchThread, GoalFactory contract, set_heartbeat tool, message
source routing. But a frontier agent generating a personal node needs
patterns for: "how do I write a sensor?", "how do I write a goal?",
"how do I add a notification channel?"

## Requirements

1. Update `skills/agent-loop/references/proactive-mode.md`:

   **Sensor Generation Patterns** — show how to implement SensorFactory:
   - Git sensor (commits, branches, working tree)
   - Filesystem sensor (file modification times in a watched directory)
   - HTTP sensor (poll an endpoint, diff response body)
   - Pattern: read → diff → delta, snapshot persistence, AbortSignal

   **Goal Generation Patterns** — show GoalFactory implementations:
   - Watch pattern: `repeat: true` bThread that `waitFor` specific sensor_delta
   - Alert pattern: goal fires `task` with a pre-formed prompt when condition met
   - Schedule pattern: goal with time-based filtering (weekdays only, business hours)
   - Pattern: natural language → factory file + test file → validate → load

   **Notification Channel Patterns** — show push routing handlers:
   - WebSocket (built-in, via server.publish)
   - Webhook (POST to Slack/Discord incoming webhook URL)
   - Email (via SMTP or API — read URL from .env.schema, never the secret)
   - Pattern: subscribe to proactive messages, format, send

   **Cost Model Table** — help the agent choose heartbeat interval:
   - Local GPU: aggressive (5min), zero marginal cost
   - Cloud API: conservative (30min-2hr), cost scales linearly
   - Hybrid: sensors local, inference cloud

2. Update the skill's SKILL.md Quick Reference to include sensor/goal/notification.

3. Add a `references/sensor-patterns.md` if proactive-mode.md gets too long.

## Key Files

- skills/agent-loop/references/proactive-mode.md — main update target
- skills/agent-loop/SKILL.md — quick reference update
- src/agent/agent.types.ts — reference for SensorFactory, GoalFactory types

## Constraints

- Patterns must use the actual type contracts from the framework (SensorFactory,
  GoalFactory). Not pseudocode — real TypeScript that a frontier agent
  can adapt.
- Varlock integration: sensor patterns that need API keys must reference
  .env.schema, never .env. Include @sensitive markers in examples.
- Keep the existing proactive-mode.md content (heartbeat, tickYield,
  cost table). Add to it, don't replace.
```

### Prompt 15: Proactive Node Eval Prompts

```
Work in a worktree branch off local dev branch.

## Task

Add 5 proactive node generation prompts to the eval system, following
the MiniAppBench methodology used for module generation.

## Context

The module eval achieved 100% pass@k≥0.66 across 20 prompts. We need
equivalent eval coverage for proactive node generation — can a frontier
agent generate working sensors, goals, and notification channels from
natural language descriptions?

## Requirements

1. Create `skills/proactive-node/assets/prompts.jsonl` with 5 prompts:

   a. **Git Monitor** — "Generate a sensor that watches for new commits
      on the main branch and alerts me via WebSocket when someone pushes"

   b. **File Watcher** — "Generate a sensor that monitors ~/Documents
      for new PDF files and a goal that triggers OCR processing when found"

   c. **Uptime Monitor** — "Generate an HTTP sensor that polls
      https://api.example.com/health every 5 minutes and sends a webhook
      to my Discord channel if it returns non-200"

   d. **Email Digest** — "Generate a goal that collects all sensor deltas
      from the past 24 hours and emails me a daily digest at 8am"

   e. **Cost-Aware Heartbeat** — "Generate a node config that uses
      aggressive monitoring (5min) on local GPU but automatically
      switches to conservative (2hr) when falling back to cloud API"

2. Create a grader (`src/tools/proactive-grader.ts`) with three dimensions:
   - **Contract compliance** — does the generated code satisfy the
     SensorFactory/GoalFactory type contracts? (tsc check)
   - **Behavioral correctness** — do generated bThreads use correct
     BP patterns? (bSync/bThread, interrupt, repeat)
   - **Integration** — does the generated code wire into createAgentLoop
     correctly? (imports, option passing)

3. Add adapter if needed for running proactive eval through trial runner.

## Key Files

- skills/proactive-node/assets/prompts.jsonl — NEW
- src/tools/proactive-grader.ts — NEW
- scripts/run-eval.ts — may need adapter registration
- src/tools/module-grader.ts — reference for grader patterns

## Constraints

- Follow the same JSONL format as skills/modnet-modules/assets/prompts.jsonl
- Grader dimensions parallel the module grader (Intention × Static × Dynamic)
  but adapted for proactive artifacts
- Each prompt should be self-contained — the frontier agent receives the
  prompt + skills, generates code, grader evaluates
```

---

## Phase 6 — Distillation Data Collection

### Prompt 16: Collect SFT Trajectories from Frontier Agents

```
Work in a worktree branch off local dev branch.

## Task

Collect successful generation trajectories from frontier agents for SFT distillation.

## Context

The eval cycle achieved 100% pass rate across 20 module generation prompts with
3 calibration passes. Proactive node eval (Prompt 15) provides additional coverage.
Skills are calibrated. Now we need to collect high-quality trajectories from
frontier agents for supervised fine-tuning of our target model (Falcon-H1R 7B).

5 trial result files exist in .memory/evals/ from the eval cycles. The latest
(calibration pass 3) shows 20/20 pass@k≥0.66 with avg scores 0.65-1.0.

## Process

### 1. Select Prompts for Trajectory Collection

All 20 module prompts from skills/modnet-modules/assets/prompts.jsonl plus
5 proactive prompts from skills/proactive-node/assets/prompts.jsonl. Focus on:
- All prompts with avg score ≥ 0.9 (baseline trajectories)
- physics-simulator separately (hard prompt, need multiple attempts for diversity)
- All 5 proactive prompts (new coverage, need diversity)

### 2. Re-run with Rich Trajectory Capture

For each prompt, run with trajectory capture enabled through multiple frontier agents:

**Claude Code (primary distillation source):**
```bash
bun run scripts/run-eval.ts --adapter adapters/claude-code --prompts skills/modnet-modules/assets/prompts.jsonl --k 1 --capture-trajectory --output trajectories/claude-code/
```

**Gemini CLI (alternative reasoning patterns):**
```bash
bun run scripts/run-eval.ts --adapter adapters/gemini --prompts skills/modnet-modules/assets/prompts.jsonl --k 1 --capture-trajectory --output trajectories/gemini/
```

**Codex (different tool-calling patterns):**
```bash
bun run scripts/run-eval.ts --adapter adapters/codex --prompts skills/modnet-modules/assets/prompts.jsonl --k 1 --capture-trajectory --output trajectories/codex/
```

The trajectory includes: thinking, tool calls, tool results, file operations, final output.

### 3. Quality Gate

For each captured trajectory:
1. Run module-grader (or proactive-grader) on the output
2. Only keep trajectories where ALL three dimensions pass:
   - intention ≥ 0.8
   - static = 1.0 (must pass all structural checks)
   - dynamic ≥ 0.7
3. Run withStatisticalVerification (k=5) to check grader consistency
4. Discard trajectories where grader is inconsistent (stddev > 0.2)

### 4. Format for SFT

Convert captured trajectories to SFT training format:

```jsonl
{"messages": [{"role": "system", "content": "<system prompt from context assembly>"}, {"role": "user", "content": "<generation prompt>"}, {"role": "assistant", "content": "<full trajectory: thinking + tool calls + code output>"}]}
```

Include DecisionStep metadata from BP snapshots as process signal:
```jsonl
{"messages": [...], "decision_steps": [{"superstep": 1, "selected": "invoke_inference", ...}, ...], "grading": {"intention": 0.95, "static": 1.0, "dynamic": 0.85, "composite": 0.93}}
```

### 5. Multi-Agent Diversity Analysis

After collecting from all three agents, analyze:
- Which prompts do different agents solve differently?
- Where do reasoning patterns diverge?
- Which trajectories produce the highest composite scores?

Use compare-trials skill patterns for cross-agent analysis.

### 6. Persist Trajectories

Trajectory files go in `trajectories/` directory (gitignored — too large for git, backed up separately).
SFT-formatted data goes in `training-data/` (gitignored, backed up).
Summary metadata (which trajectories passed, scores, agent source) committed to `.memory/evals/` as JSONL.

## Key Files

- scripts/run-eval.ts — eval runner
- src/tools/adapters/ — frontier agent adapters (claude-code, cli-adapter, local)
- src/tools/module-grader.ts — three-dimension grader
- src/tools/proactive-grader.ts — proactive artifact grader
- src/tools/training.ts — withStatisticalVerification
- skills/modnet-modules/assets/prompts.jsonl — 20 module prompts
- skills/proactive-node/assets/prompts.jsonl — 5 proactive prompts
- skills/training-pipeline/ — distillation format reference

## Estimated Cost

| Agent | Prompts × k | Est. Cost |
|---|---|---|
| Claude Opus 4.6 | 25 × 1 | ~$40-60 |
| Gemini 2.5 Pro | 25 × 1 | ~$15-25 |
| Codex | 25 × 1 | ~$5-15 |
| Quality gate grading | 75 trajectories × k=5 | ~$5-15 |
| **Total** | | **~$65-115** |

## Constraints

- Trajectories are ephemeral on disk (gitignored), backed up to cloud storage
- Only graded, verified trajectories become training data
- SFT format must match training-pipeline skill specifications
- Run module-grader on every trajectory — no ungraded data in training set
```

---

## Future Work (After Distillation)

These items are deferred until after the initial training cycle:

- **ACP debug viewport** — for debugging trained agent running on a node
- **Enterprise genome** — PM node seed generation from calibrated skills
- **Structural-IA → bThreads** — MSS enforcement rules generated from mss-vocabulary skill
- **Project isolation orchestrator** — subprocess spawning, IPC bridge
- **Session rollback/branching UX**
- **Mid-task steering**
