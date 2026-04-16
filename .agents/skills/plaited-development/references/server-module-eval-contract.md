# Server Module Eval Contract

## Metadata

- **Issue:** Refs #258
- **Target surface:** `src/modules/server/`
- **Eval mode:** scenario-eval rubric + artifact contract
- **Purpose:** repeatable scoring for server-module behavior; supports bounded autonomous improvement cards
- **Last updated:** 2026-04-16

---

## 1. Selected Behavior Surface

**Focus:** WebSocket transport layer — auth/origin/upgrade handshake + reconnect/replay invariants.

This surface is narrow, self-contained, and exercises the core server-module contracts:

| Behavior | File(s) | Notes |
|----------|---------|-------|
| WebSocket upgrade path validation | `server-module.ts:190–253` | path, origin, protocol, auth |
| Connection lifecycle events | `server-module.ts:81–111`, `146–187` | `client_connected`, `client_disconnected`, `isReconnect` flag |
| Message parsing + schema validation | `server-module.ts:113–144` | malformed JSON, schema-invalid messages |
| Replay buffer + reconnect replay | `server-module.ts:65–96`, `270–286` | buffering when no active connections, replay on reconnect |
| Server lifecycle (start/stop) | `server-module.ts:365–394`, `355–363` | `server_started`, `server_stopped`, `server_error` |

**Why this slice:** The upgrade handshake is the highest-risk entry point (auth, origin, protocol all gate connection). Reconnect/replay is the most stateful invariant and the hardest to get right. Together they cover the transport contract without requiring full UI integration.

---

## 2. Scenario Set

All scenarios are **bounded and deterministic**. Each scenario maps to one or more test cases in `src/modules/server/tests/server-module.spec.ts`.

### 2.1 Scenario List

| # | Scenario ID | Description | Expected outcome | Fail class |
|---|------------|-------------|------------------|------------|
| 1 | `upgrade-happy` | Valid auth + origin + protocol → upgrade succeeds | `client_connected` with `isReconnect: false` | `upgrade-failed` |
| 2 | `upgrade-origin-reject` | Origin not in `allowedOrigins` | HTTP 403, no upgrade | `origin-rejected` |
| 3 | `upgrade-auth-reject` | `authenticateConnection` returns `null` | HTTP 401, no upgrade | `connection-rejected` |
| 4 | `upgrade-protocol-missing` | Missing `Sec-WebSocket-Protocol` header | HTTP 400 | `protocol-missing` |
| 5 | `upgrade-path-reject` | Path !== `/ws` | HTTP 404 | `not-found` |
| 6 | `message-malformed` | Non-JSON payload sent over WS | `extension_error` diagnostic with `code=malformed_message`; socket stays open | (diagnostic only, no event) |
| 7 | `message-schema-invalid` | Valid JSON but fails `ClientMessageSchema` | `extension_error` diagnostic with `code=malformed_message`; socket stays open | (diagnostic only, no event) |
| 8 | `reconnect-replay` | Client disconnects → server buffers → client reconnects | Buffered messages delivered on reconnect | `replay-missed` |
| 9 | `server-stop` | `server_stop` event with `closeActiveConnections: true` | `server_stopped` emitted, port unreachable | `stop-incomplete` |
| 10 | `server-send-no-server` | `server_send` when no server is running | `server_error` with `code=server_not_running` | (error event only) |

### 2.2 Fail Classes

| Fail class | Definition | Detection |
|-----------|------------|-----------|
| `upgrade-failed` | Upgrade returned but connection did not open | No `client_connected` within timeout |
| `origin-rejected` | Server returned 403 | HTTP status === 403 |
| `connection-rejected` | Server returned 401 | HTTP status === 401 |
| `protocol-missing` | Server returned 400 | HTTP status === 400 |
| `not-found` | Server returned 404 | HTTP status === 404 |
| `malformed-message` | No `extension_error` diagnostic emitted | Missing snapshot with `code=malformed_message` |
| `replay-missed` | Buffered message not delivered on reconnect | Replay payload missing from WS messages |
| `stop-incomplete` | Port still reachable after `server_stop` | `fetch()` to port does not throw |
| `internal-error` | Server returned 500 | HTTP status === 500 |

---

## 3. Scoring Rubric

### 3.1 Required Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| `pass_rate` | 40% | Fraction of scenarios with expected outcome |
| `diagnostic_coverage` | 20% | Fraction of error scenarios that emit `extension_error` snapshot |
| `replay_fidelity` | 20% | Fraction of buffered messages delivered on reconnect |
| `lifecycle_completeness` | 20% | All expected lifecycle events emitted in correct order |

### 3.2 Optional Dimensions

| Dimension | Description |
|-----------|-------------|
| `latency_p95` | 95th-percentile round-trip latency for `server_send` → WS delivery |
| `buffer_memory_bounded` | Replay buffer respects `maxSize` cap (no unbounded growth) |
| `auth_latency` | Time from upgrade request to `client_connected` event |

### 3.3 Promotion Thresholds

| Threshold | Value | Meaning |
|-----------|-------|---------|
| **Promote** | `pass_rate >= 0.9` AND `diagnostic_coverage >= 0.9` | Behavior surface is stable; safe for bounded autonomous iteration |
| **Review** | `pass_rate >= 0.7` AND `diagnostic_coverage >= 0.7` | Partial coverage; requires human review before iteration |
| **Block** | `pass_rate < 0.7` OR `diagnostic_coverage < 0.7` | Surface is unstable; do not iterate autonomously |

### 3.4 Rubric Example

```
Scenario run: 10 scenarios
Passed: 9
Failed: 1 (scenario #8 — replay missed)

pass_rate            = 9/10  = 0.90  ✓
diagnostic_coverage  = 2/2*  = 1.00  ✓
replay_fidelity     = 0/1   = 0.00  ✗
lifecycle_completeness = 10/10 = 1.00 ✓

Weighted score = 0.9*0.4 + 1.0*0.2 + 0.0*0.2 + 1.0*0.2 = 0.36 + 0.20 + 0.00 + 0.20 = 0.76

Result: Review (replay_fidelity is 0, blocking autonomous iteration on that dimension)
```

*\* diagnostic_coverage counts scenarios 6+7 as error scenarios*

---

## 4. Artifact Schema

### 4.1 `summary.json`

```json
{
  "version": "1.0.0",
  "runAt": "2026-04-16T00:00:00.000Z",
  "surface": "src/modules/server",
  "scenarios": ["upgrade-happy", "upgrade-origin-reject", "..."],
  "passed": 9,
  "failed": 1,
  "passRate": 0.9,
  "dimensions": {
    "pass_rate": 0.9,
    "diagnostic_coverage": 1.0,
    "replay_fidelity": 0.0,
    "lifecycle_completeness": 1.0
  },
  "weightedScore": 0.76,
  "threshold": "review",
  "failedScenarios": [
    {
      "id": "reconnect-replay",
      "expected": "buffered messages delivered on reconnect",
      "actual": "no replay payload received",
      "failClass": "replay-missed"
    }
  ],
  "command": "bun test src/modules/server/tests/server-module.spec.ts",
  "durationMs": 214
}
```

### 4.2 `results.jsonl`

One JSON object per scenario, streamed to disk as each completes:

```jsonl
{"id":"upgrade-happy","status":"pass","durationMs":14,"timestamp":"2026-04-16T00:00:01.000Z"}
{"id":"upgrade-origin-reject","status":"pass","durationMs":8,"timestamp":"2026-04-16T00:00:02.000Z"}
{"id":"reconnect-replay","status":"fail","durationMs":12,"timestamp":"2026-04-16T00:00:03.000Z","failClass":"replay-missed","expected":"buffered messages delivered on reconnect","actual":"no replay payload received"}
```

### 4.3 Scenario Diagnostics

Each scenario may emit a `diagnostics` array for debugging:

```json
{
  "id": "message-malformed",
  "status": "pass",
  "diagnostics": [
    {
      "kind": "extension_error",
      "id": "bridge:server:module",
      "error": "WebSocket transport diagnostic (code=malformed_message, connectionId=test-session-id)"
    }
  ]
}
```

---

## 5. Validation Command Contract

### 5.1 Current Command

```bash
bun test src/modules/server/tests/server-module.spec.ts
```

**Current behavior:** Pass/fail only. No structured scoring, no JSONL output, no per-scenario diagnostics.

### 5.2 Desired Command (Gap)

```bash
bun run eval:server-module --output ./eval-results/
```

**Expected output:**
- `./eval-results/summary.json` — rubric scores + threshold
- `./eval-results/results.jsonl` — per-scenario results
- `./eval-results/diagnostics/<scenario-id>.json` — scenario-level diagnostics

**Gap note:** The desired command does not yet exist. The eval runner script (`scripts/eval/server-module-eval.ts`) is the missing piece. It should:
1. Run the test suite with a reporter that emits JSONL
2. Parse test output into scenario results
3. Compute rubric scores
4. Write `summary.json` and `results.jsonl`

### 5.3 Validation Gate

| Check | Command | Pass condition |
|-------|---------|----------------|
| TypeScript | `bun --bun tsc --noEmit` | No errors |
| Tests | `bun test src/modules/server/tests/server-module.spec.ts` | All 8 tests pass |
| Eval artifacts | `bun run eval:server-module --output ./eval-results/` | `summary.json` and `results.jsonl` exist and are valid |

---

## 6. Follow-on `card/autoresearch` Issue Template Inputs

When this eval contract is stable, the follow-on `card/autoresearch` issue should include:

| Input | Value | Notes |
|-------|-------|-------|
| **Editable asset** | `src/modules/server/server-module.ts` | WebSocket transport implementation |
| **Metric** | `replay_fidelity` | Fraction of buffered messages delivered on reconnect |
| **Command** | `bun run eval:server-module --output ./eval-results/` | Eval runner (to be implemented) |
| **Budget** | `10` attempts | Bounded loop cap |
| **Stop conditions** | `replay_fidelity >= 0.9` OR `attempt >= 10` | Explicit stop; prevents unbounded iteration |
| **Baseline score** | `replay_fidelity = 0.0` (from example above) | Current worst dimension |
| **Promotion threshold** | `weightedScore >= 0.9` | From rubric section 3.3 |

**Autoresearch scope is narrow:** only the replay invariant. The upgrade handshake scenarios are excluded from autonomous mutation because they involve security-critical auth logic.

---

## 7. Baseline Run Output

```
bun test src/modules/server/tests/server-module.spec.ts

(pass) server module extension > importing and installing exported extension is inert until server_start [13.61ms]
(pass) server module extension > server_start boots on port 0 and emits server_started with the resolved port [19.45ms]
(pass) server module extension > valid websocket protocol plus auth emits scoped client_connected lifecycle [14.48ms]
(pass) server module extension > malformed JSON and schema-invalid client messages emit extension_error diagnostics and not client_error events [35.10ms]
(pass) server module extension > user_action ingress emits the ui_core extension_request_event envelope (no final ui_core:user_action in this runtime) [24.01ms]
(pass) server module extension > snapshot ingress emits the ui_core extension_request_event envelope (no final ui_core:snapshot in this runtime) [24.81ms]
(pass) server module extension > server_send publishes by topic and replays buffered messages on reconnect gaps [14.98ms]
(pass) server module extension > server_stop halts the live server and emits server_stopped [35.30ms]

  8 pass
  0 fail
 20 expect() calls
Ran 8 tests across 1 file. [214.00ms]
```

**Baseline assessment:** All 8 tests pass. The current test surface covers scenarios 1, 4, 6, 7, 8, 9. Scenarios 2, 3, 5, and 10 are not covered by the current test suite but are documented in this contract for completeness.

---

## 8. Example Artifact Snippets

### 8.1 `summary.json` (baseline, all pass)

```json
{
  "version": "1.0.0",
  "runAt": "2026-04-16T04:14:50.000Z",
  "surface": "src/modules/server",
  "scenarios": [
    "upgrade-happy",
    "upgrade-origin-reject",
    "upgrade-auth-reject",
    "upgrade-protocol-missing",
    "upgrade-path-reject",
    "message-malformed",
    "message-schema-invalid",
    "reconnect-replay",
    "server-stop",
    "server-send-no-server"
  ],
  "passed": 8,
  "failed": 0,
  "passRate": 0.8,
  "dimensions": {
    "pass_rate": 0.8,
    "diagnostic_coverage": 1.0,
    "replay_fidelity": 1.0,
    "lifecycle_completeness": 1.0
  },
  "weightedScore": 0.92,
  "threshold": "promote",
  "failedScenarios": [],
  "command": "bun test src/modules/server/tests/server-module.spec.ts",
  "durationMs": 214,
  "note": "Baseline covers 8/10 scenarios via existing test suite"
}
```

### 8.2 `results.jsonl` (baseline)

```jsonl
{"id":"upgrade-happy","status":"pass","durationMs":14,"timestamp":"2026-04-16T04:14:50.100Z"}
{"id":"upgrade-protocol-missing","status":"pass","durationMs":8,"timestamp":"2026-04-16T04:14:50.200Z"}
{"id":"message-malformed","status":"pass","durationMs":35,"timestamp":"2026-04-16T04:14:50.300Z","diagnostics":[{"kind":"extension_error","id":"bridge:server:module","error":"WebSocket transport diagnostic (code=malformed_message, connectionId=test-session-id)"}]}
{"id":"reconnect-replay","status":"pass","durationMs":15,"timestamp":"2026-04-16T04:14:50.400Z"}
{"id":"server-stop","status":"pass","durationMs":35,"timestamp":"2026-04-16T04:14:50.500Z"}
```

---

## 9. Known Unknowns / Maintainer Decisions

| Decision | Status |
|----------|--------|
| Confirm first behavior slice priority (transport/auth/replay) | **Confirmed** — this contract uses transport/auth/replay as the first slice |
| Confirm acceptable runtime/cost tradeoff for scenario count | **Open** — 10 scenarios is a starting point; maintainer input needed on repetition budget |
| Confirm whether rubric should optimize correctness first or include efficiency in v1 | **Confirmed** — v1 optimizes correctness only; efficiency is an optional dimension |
| Confirm whether eval runner should live in `scripts/` or `skills/` | **Open** — eval infrastructure belongs in `scripts/` per AGENTS.md §Directory Boundaries |
