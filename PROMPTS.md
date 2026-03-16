# Worktree Prompts

## Phase 6 — Distillation Data Collection (In Progress)

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

## Phase 7 — Full Node Generation Eval

### Prompt 17: Personal Agent Node Generation + Grader

```
Work in a worktree branch off local dev branch.

## Task

Add 5 personal-agent node generation prompts and a node-grader that tests
full composition — workspace + modules + sensors + goals + constitution +
notification channels + varlock. This is the integration test for the entire
framework: can a frontier agent compose all skills into a working node?

## Context

Module eval (25 prompts) validates individual artifacts. Proactive eval
(5 prompts) validates sensors and goals. But nothing tests the full
composition path: initNodeWorkspace → initModule (MSS) → constitution →
createAgentLoop (proactive) → createNode (server + A2A) → varlock (.env.schema).

The skills exist (modnet-node, mss-vocabulary, agent-loop, proactive-node,
constitution, varlock). The framework primitives exist (workspace.ts, node.ts,
proactive.ts, agent.loop.ts). This prompt validates that a frontier agent
can read the skills and generate a complete working node.

## Requirements

1. Create `skills/node-generation/assets/prompts.jsonl` with 6 prompts:

   a. **GitHub Watcher** — "Generate a personal agent node that monitors
      my GitHub repos for new issues and alerts me via Discord webhook"
      (workspace + git sensor + alert goal + webhook notifier + varlock)

   b. **Expense Tracker** — "Generate a personal agent node that
      categorizes my expenses and emails me a weekly summary"
      (workspace + finance module/MSS + schedule goal + email notifier)

   c. **Competitor Monitor** — "Generate a personal agent node that watches
      a competitor's pricing page and alerts me when prices change"
      (workspace + HTTP sensor + alert goal + webhook + varlock)

   d. **Personal Knowledge Base** — "Generate a personal agent node that
      indexes my notes folder and answers questions about my documents"
      (workspace + education module + filesystem sensor, no notification)

   e. **Team Standup Bot** — "Generate a personal agent node that collects
      daily updates from team members via Slack and posts a morning summary"
      (workspace + social module/MSS + schedule goal + webhook in/out)

   f. **Bluesky Publisher** — "Generate a personal agent node that monitors
      RSS feeds for articles in my field and cross-posts relevant ones to
      my Bluesky account with a summary"
      (workspace + social module/MSS boundary:ask + RSS HTTP sensor +
      bluesky messaging module with outbound risk tags + varlock)

2. Create a grader (`src/tools/node-grader.ts`) with five dimensions.
   The generated node must implement all 5 components of the proactive
   push-based agent spec:

   - **Structure** — workspace exists, package.json valid, MSS tags valid
     against mss-vocabulary, module has own git init

   - **Proactive Architecture** — the generated node wires `createServer` +
     `createAgentLoop` + proactive config into a running `createNode` that
     implements:
     1. Heartbeat Engine: `proactive.intervalMs` configured, heartbeat timer
        created (not a custom setInterval — uses framework's createHeartbeatTimer)
     2. State & Memory: `.memory/` path configured, context assembly wired
        (sessionSummary contributor present or createNode defaults used)
     3. Environment Sensors: at least one `SensorFactory` in `proactive.sensors`
        with `read()` + `diff()` + `snapshotPath`. Diff returns null on no-change.
     4. Goal State: at least one `GoalFactory` in `proactive.goals` with
        `repeat: true` bThread that `waitFor` sensor_delta
     5. Push Notification: notification handler wired — subscribes to
        `message` events where `source === 'proactive'`, routes to external
        channel (webhook/email/WebSocket). Handler formats a structured
        summary (not raw model output).

   - **Constitution** — MAC rules present (at minimum default protectGovernance),
     governance factories used correctly. Risk tags declared for any custom tools.

   - **Secrets** — .env.schema exists for any API keys/webhooks/notification URLs,
     @sensitive markers present, no hardcoded secrets in code. Code reads
     from `process.env.VARNAME`, never from literal strings.

   - **Integration** — tsc --noEmit passes on the generated node. All imports
     resolve. createNode() call present with model, tools, toolExecutor,
     constitution, proactive config, memoryPath, and port.

3. Create a `skills/node-generation/SKILL.md` that teaches the full
   composition pattern — the "plaited genome" in skill form:

   Wave 0: Initialize workspace (initNodeWorkspace) → modnet-node skill
   Wave 1: Create module(s) with MSS tags (initModule) → mss-vocabulary skill
   Wave 2: Add constitution (MAC factories) → constitution skill
   Wave 3: Wire proactive mode (sensors + goals + heartbeat) → agent-loop skill
   Wave 3.5: Add messaging modules as MSS artifacts → modnet-node + mss-vocabulary
     - Messaging platforms (Bluesky, Slack, etc.) are modules, not adapters
     - MSS tags: contentType:social, structure:stream/thread, boundary:ask
     - Tools with risk tags: [crosses_boundary, outbound, external_audience]
       for sends, [crosses_boundary, inbound] for reads
     - Outbound risk tags route through full Gate → Simulate → Evaluate
       (not the workspace fast-path) — grader must verify this
   Wave 4: Add notification channels → agent-loop proactive patterns
   Wave 5: Configure secrets (.env.schema via varlock) → varlock skill
   Wave 6: Compose node (createNode with all pieces) → modnet-node skill

   Each wave references the specific skill that teaches it.
   This skill IS the "plaited genome" — a frontier agent reading it
   can generate a complete personal agent node from a natural language
   description via `bun run prompt`.

## Key Files

- skills/node-generation/SKILL.md — NEW (composition patterns)
- skills/node-generation/assets/prompts.jsonl — NEW (5 prompts)
- src/tools/node-grader.ts — NEW (5-dimension grader)
- scripts/run-eval.ts — may need node-generation adapter
- src/tools/module-grader.ts — reference for grader patterns
- src/tools/proactive-grader.ts — reference for grader patterns

## Constraints

- Each prompt must be self-contained — frontier agent receives prompt + skills
- The grader must validate MSS tags against mss-vocabulary valid combinations
- tsc --noEmit is the hard gate — if it fails, the node is broken
- .env.schema must exist if any secret is referenced (varlock enforcement)
- Prompts should cover diverse MSS contentTypes, boundaries, and scales
- Follow existing JSONL format from modnet-modules and proactive-node prompts
```

---

## Phase 8 — Client-Pushed Sensor Input

### Prompt 18: Event-Driven Sensors from WebSocket Clients

```
Work in a worktree branch off local dev branch.

## Task

Extend the server to accept sensor_input messages from authenticated
WebSocket clients and route them into the proactive pipeline as
sensor_delta events. Add a ClientSensorFactory type for push-based
sensors (mobile location, Bluetooth proximity, etc.).

## Context

The server already supports multiple simultaneous clients per session
via topic subscription (sessionId or sessionId:source). A mobile
WebView connecting as source 'mobile-app' gets its own topic. But
ClientMessageSchema only accepts controller protocol messages
(user_action, snapshot). There's no path for a client to push sensor
data into the BP engine.

Polling sensors (SensorFactory) read on each tick. Client-pushed
sensors receive data asynchronously from WebSocket clients — the
phone pushes location, the node's BP engine processes it as a
sensor_delta. Same proactive pipeline, different data source.

## Requirements

1. Extend ClientMessageSchema in src/ui.ts (or server schemas) to
   accept sensor_input messages:
   - { type: 'sensor_input', detail: { sensor: string, data: unknown } }
   - Validated by Zod schema, rejected if malformed

2. In server.ts message handler, route validated sensor_input to
   trigger() as sensor_delta events:
   - { type: AGENT_EVENTS.sensor_delta, detail: { sensor, delta: data } }
   - These flow into the same sensorBatch / goal bThread pipeline

3. Define ClientSensorFactory type in agent.types.ts:
   - Like SensorFactory but no read() or snapshotPath
   - Just: { name: string, clientSource: string }
   - Declares which WebSocket source provides data for this sensor
   - The node-generation skill teaches: "for location data, create a
     ClientSensorFactory that expects input from source 'mobile-app'"

4. Wire into createAgentLoop proactive config:
   - proactive.clientSensors?: ClientSensorFactory[]
   - These don't run on tick — they fire whenever the client pushes

5. Tests:
   - sensor_input message from WebSocket → sensor_delta in BP
   - Malformed sensor_input rejected with client_error
   - ClientSensorFactory registered, goal bThread fires on matching delta
   - Multiple client sources (mobile-app, desktop) don't cross-contaminate

6. Update skills/agent-loop/references/sensor-patterns.md:
   - Add "Client-Pushed Sensor" pattern alongside polling sensors
   - Mobile location example, Bluetooth proximity example
   - Explain when to use push vs poll

## Key Files

- src/server/server.ts — message handler extension
- src/server/server.schemas.ts — ClientMessageSchema extension
- src/agent/agent.types.ts — ClientSensorFactory type
- src/agent/agent.loop.ts — proactive config extension
- skills/agent-loop/references/sensor-patterns.md — pattern update

## Constraints

- sensor_input messages must be from authenticated sessions only
  (same session validation as all WebSocket messages)
- Client-pushed data is untrusted — the sensor_delta detail carries
  the raw data, goals/model evaluate it
- No changes to existing polling SensorFactory contract
- Backward compatible — nodes without clientSensors work as before
```

---

## Future Work (After Distillation)

These items are deferred until after the initial training cycle:

- **ACP debug viewport** — for debugging trained agent running on a node
- **Enterprise genome** — PM node seed generation from calibrated skills
- **Multi-agent git coordination via A2A** — PM node monitors shared repo via git sensor, workers push via SSH executor, coordination through A2A messages. DAG browsing (children, leaves, lineage) as tools. Adapts AgentHub concepts natively into A2A rather than adding a separate server. See `docs/AUTO-RESEARCH.md`
- **Module worktree experiments** — personal agent explores multiple approaches per module via git worktrees. Same keep/discard pattern as autoresearch, module-scoped
- **Structural-IA → bThreads** — MSS enforcement rules generated from mss-vocabulary skill
- **Project isolation orchestrator** — subprocess spawning, IPC bridge
- **Web search for MSS prompt generation** — vendor-agnostic search API (Research endpoint) generates grounded domain descriptions → map to MSS tags → expand prompts.jsonl → calibrate via autoresearch loop
- **Session rollback/branching UX**
- **Mid-task steering**
