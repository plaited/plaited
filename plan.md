# Behavioral Agent Harness — Phased Build Plan

Self-improving agent built on the plaited behavioral runtime (`src/main/behavioral.ts`).
No pi SDK. No TUI. No ACP (deferred). The agent is a `plaited` CLI command; the dev
client is pi's `!`/`!!` shell escapes; validation is Bun test.

**Cross-cutting conventions for every phase:**

- Repo rules in `AGENTS.md` apply (Bun APIs, conventional commits, `test` not `it`,
  no `any`, Zod `.parse()` at trust boundaries, minimal-implementation directive).
- TDD: write the test first; one runnable check minimum per non-trivial logic.
- The behavioral engine's public API is `behavioral()` →
  `{ useAddThread, useTrigger, useAddHandler, useTrace, sendTrace }` — partially applied
  by topic. Threads are plain data: `{ label, rules: Idioms[], once?: true }`.
- Listeners match on `type` + optional `detailSchema` (JSON Schema, Ajv2020-compiled)
  + `detailMatch: 'valid'|'invalid'`. Handlers match on `type` only.
- The sketch in `src/main/behavioral.ts` lines ~400-423 (`useTool` spec) is reference
  material for Phase 2, not gospel — fix its mechanical errors per Phase 2.

---

## Phase 0 — Open Responses stream contract

**Goal:** define the model boundary as an Open Responses-shaped request/stream, with a
user-provided adapter seam. pi-ai is at most one future adapter, not a dependency.

**Deliverables:**

- `src/agent/open-responses.schemas.ts` — Zod schemas for the minimal request shape
  (`model`, `input` items incl. `function_call`/`function_call_output` with `call_id`,
  `tools`) and the minimal stream event union (text/thinking deltas, tool-call
  start/delta/done, terminal done/error with stop reason).
- `src/agent/stream.ts` — `type StreamFn = (req) => AsyncIterable<StreamEvent>`; contract
  documented: never throw, encode failure as a terminal error event.
- `src/agent/adapters/` seam: an adapter maps a non-conformant provider to the contract.
  Ship one test double (scripted event sequences), no real provider.

**Done when:** tests drive a scripted StreamFn through deltas → terminal error → abort;
`bun --bun tsc --noEmit` clean.

---

## Phase 1 — The agent loop as a b-program

**Goal:** replace pi's `runLoop` with b-threads. Coordination (steering, abort, stop
conditions) is expressed as threads, not callbacks.

**Deliverables:**

- `src/agent/loop.ts` — the turn loop thread (see shape below), plus:
  - a stream-adapter handler that iterates the `StreamFn` and `trigger`s
    `llm.delta` / `llm.toolCall` / `llm.done` b-events;
  - a cancel thread: `interrupt: [sessionCancel]`;
  - stop-condition as a thread requesting `turn.end`, not a callback.
- Loop thread shape (looping, no `once`):
  `waitFor: [userPrompt]` → `request: llm.stream` → `waitFor: [llm.done]`
  → `request: <tool name>` per parsed function_call → `waitFor: [<name>_result]`
  matched by `detailSchema` const on `call_id` → append items → loop.

**Done when:** tests prove — happy path (prompt → stream → tool call → result →
next stream), cancel mid-turn via interrupt, terminal error stops the turn. All
coordination appears as events in traces (assert via `useTrace`).

---

## Phase 2 — `useTool` factory

**Goal:** tools are makeCli-style units wired as handler+guard-thread pairs. Reference:
the spec sketch at `src/main/behavioral.ts:400-423` and
`research/pi-behavioral-harness-proposal.md` §4.

**Deliverables:**

- `src/agent/use-tool.ts` — external factory taking the partially-applied
  `{ useAddHandler, useAddThread, useTrigger }`. `useTool({ name, inputSchema (Zod),
  outputSchema (Zod), run })`:
  - derives JSON Schema via `z.toJSONSchema` for listener matching;
  - tool schemas stay **pure args/result** — no `call_id`. The Ajv2020 check asserts
    purity (rejects schemas that bake `call_id` into the tool contract). The
    `call_id` envelope is the loop's job, not the tool's: the loop thread stamps the
    provider-minted `call_id` into the b-event `detail` when lifting a `function_call`
    item into a tool-call event, and the result handler echoes it on `${name}_result`.
    Rationale: `call_id` must stay in `detail` (never `payload`) so listener matching,
    traces, the frontier gate, and session-log replay can all see the correlation;
  - registers handler on event type `name`: parses `detail` with `inputSchema`,
    awaits `run`, validates output, `trigger({ type: `${name}_result` })`;
  - registers the standing guard thread: `{ block: [{ type: name, detailSchema,
    detailMatch: 'invalid' }] }` + `{ request: { type: 'tool_call_blocked', detail:
    { name, ... } } }` (fixes sketch: block is an array, detailMatch is the enum,
    handler registration takes the type).
  - returns a frozen descriptor `{ name, inputSchema, outputSchema, jsonSchema }`
    for code generation reference.
- A default handler on `tool_call_blocked` that produces the model-visible error
  result (the model must see why its call was refused — blocked ≠ silent at runtime).

**Done when:** tests prove valid call → result event; malformed call → blocked,
`tool_call_blocked` selected, error result produced; two parallel same-tool calls
correlate by `call_id`.

---

## Phase 3 — Split `src/cli` makeCli units into pure cores + tool registration

**Goal:** `git-context`, `markdown`, `mcp-client`, `typescript-lsp` become agent tools
without losing CLI behavior.

**Deliverables:**

- Per unit: extract the `run(input)` body into a pure async core
  `(input) => output` (no argv/stdout concerns). `makeCli` keeps
  parse → core → validate → print. Agent registers the same core via `useTool`.
- Envelope: tool input/output details carry `call_id` top-level.

**Done when:** existing CLI tests pass unchanged; new tests call the cores through the
b-program (trigger a call, observe the `_result`).

---

## Phase 4 — Session event log + replay

**Goal:** selected events are the source of truth; Open Responses history and frontier
state are derived projections.

**Deliverables:**

- `src/agent/session-log.ts` — JSONL append per selected event + ingress triggers
  (persist via a `useTrace` listener selecting `selection` traces, or a dedicated
  hook — decide at implementation; keep traces themselves ephemeral).
- Projections: `toItems(log)` → Open Responses item list (function_call /
  function_call_output by `call_id`); `replayToFrontier` reused for thread state.
- Resume: replay log prefix to target step, then continue live. Branching = topics.

**Done when:** tests prove run → persist → fresh program replays to identical frontier
and identical item history; branch via topic leaves the original line intact.

---

## Phase 5 — Policy as threads: the default guard pack

**Goal:** no built-in allow-once/allow-always machinery. Guards are threads terminated
by `interrupt` on approval events.

**Deliverables:**

- Guard thread per guarded call: `{ block: [callListener],
  interrupt: [approvalFor(call_id)] }`.
- Permission flow: blocked guarded call → `permission.ask` event → handler emits a
  JSON `permission_required` output (dev mode: the human's answer arrives as the next
  invocation's input) → `permission.resolved` trigger → guard interrupted → the pended
  call becomes selectable. Deny path requests the tool's error result so the model
  sees the refusal.
- Standing policy threads are composable additions (e.g. auto-allow reads under src/).
- Registration gate: new threads pass `verifyFrontiers` per
  `research/differential-frontier-gate-stable-reward.md` (`verified` admits,
  `failed` rejected with `add_thread_error` trace, `truncated` per policy).

**Done when:** tests prove — guarded call blocked until approval; approval interrupts
the guard and the call executes; deny produces an error `_result`; a malformed or
deadlocking generated guard is rejected by the gate.

---

## Phase 6 — CLI entry: `plaited agent`

**Goal:** the agent is invocable as `plaited agent '<json>'` — from pi via `!`, or any
shell.

**Deliverables:**

- `makeCli` unit per AGENTS.md operator-surface conventions: input `{ sessionId, prompt,
  (optional) permissionAnswer }`, `--schema input|output` with `.describe()`.
- Per invocation: load + replay session log → trigger prompt → run until turn-end →
  append log → print JSON output (assistant text, tool summaries, or
  `permission_required`).

**Done when:** `!bun run plaited agent '{"sessionId":"s1","prompt":"..."}'` from pi
completes a turn; a guarded action returns `permission_required` and a follow-up
invocation carrying the answer completes it; a second session id stays isolated.

---

## Explicitly deferred

- ACP adapter (any version) — revisit when a real client (GUI or Zed) is needed.
- NDJSON warm-process mode — only if per-invocation replay latency hurts.
- v2 notification lifecycle, multi-client, remote transports.
