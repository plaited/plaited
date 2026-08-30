# Behavioral Agent Harness — Phased Build Plan

Self-improving agent built on the plaited behavioral runtime (`src/main/behavioral.ts`).
No pi SDK. No TUI. No ACP (deferred). The agent is a `plaited` CLI command; the dev
client is pi's `!`/`!!` shell escapes; validation is Bun test.

**Cross-cutting conventions for every phase:**

- Repo rules in `AGENTS.md` apply (Bun APIs, conventional commits, `test` not `it`,
  no `any`, Zod `.parse()` at trust boundaries, minimal-implementation directive).
- TDD: write the test first; one runnable check minimum per non-trivial logic.
- The behavioral engine's public API is `behavioral()` →
  `{ useAddThread, useTrigger, useAddHandler, useTrace, sendTrace, useEject }` —
  partially applied by **space** (formerly `topic`; see Phase -1). Threads are plain
  data: `{ label, rules: Idioms[], once?: true }`.
- Listeners match on `type` + optional `detailSchema` (JSON Schema, Ajv2020-compiled)
  + `detailMatch: 'valid'|'invalid'`. Handlers match on `type` only (space-scoped via
  partial application).
- The sketch in `src/main/behavioral.ts` lines ~400-423 (`useTool` spec) is reference
  material for Phase 2, not gospel — fix its mechanical errors per Phase 2.

---

## Phase -1 — Engine: `topic` → `space` rename, declared spaces, `useEject`

**Goal:** spaces (the spatiotemporal paper's spatial axis; vocabulary aligned with
atproto spaces) become first-class: a space groups threads + handlers + tools, binds
are validated, and orchestration code can eject a whole space. Motivation:
`research/Spatiotemporal-Composability-for-AI-Agent-Extensions.md` and the branching
work in Phase 4.

**Design (decided):**

- **A space is just a string identifier.** The engine knows nothing about atproto,
  DIDs, authorities, or tenancy — all of that is expressible as handlers/threads
  bound to a space (e.g. an atproto pack registering a `space.authority` handler).
  The engine's contract stops at: declare, validate, scope, eject.
- Rename `topic` → `space` throughout: `UseAddThread`/`UseAddHandler`/`UseTrigger`
  (and later `useTool`) partial-application params, `RunningBid`/`PendingBid`/
  `CandidateBid`/listener `topic` fields, trace snapshot fields, `generateRulesFunctions`.
- **Declared spaces.** `behavioral()` gains `useCreateSpace` (returns
  `(id: string) => void`; naming consistent with the other hooks). Every
  partially-applied hook — `useAddThread(space)`, `useAddHandler(space)`,
  `useTrigger(space)`, and later `useTool(space)` — validates the space exists at
  bind time and **throws** on an undeclared space. Root (no space argument) stays
  valid — that's the unscoped channel.
- **New trace kind `space_error`** (`TRACE_MESSAGE_KINDS`): thrown validation failures
  are also published as traces — `{ kind, timestamp, space, operation, error }`.
  The throw is for the caller; the trace is for the system (gate-visible when a
  generated thread binds against a nonexistent space).
- `useEject(space)` — new member of the frozen API object. Imperative, unblockable,
  orchestration-level only (called from handlers or harness code downstream of a
  triggered ingress event — the *decision* to eject stays gateable at that ingress;
  the eject mechanism itself is a hard floor that generated threads cannot veto).
  - Sweep `pending` and `running`: for bids with matching space,
    `generator.return?.()` + delete (reuses the exact `interrupt` teardown path in
    `resumePendingThreadsForSelectedEvent`).
  - Handlers: `useAddHandler(space)` registers its disconnect into a per-space
    registry; `useEject` runs them all.
  - **Eject deletes the declaration.** Post-eject, the space id is undeclared: binds
    against it throw. Re-creating an ejected id via `useCreateSpace` is allowed —
    fresh generation, no zombie state survives the sweep.
  - Observability: publish a new `space_ejected` trace kind, payload
    `{ space, threads: string[] (labels), handlers: number, timestamp }` (+ `step`
    if swept mid-super-step). No synthetic event enters the selection pipeline —
    the event log stays clean.
  - `useAddThread` keeps returning void; the space string is the handle.
  - `behavioral()` stays parameterless (no options bag).
- **Observability asymmetry is intentional:** root `useTrace` sits on the publisher
  and sees every space's traces; a space's consumers only see what their own
  handlers/triggers touch. Space isolation is stamping discipline + the registration
  gate, not a hard VM boundary — hard boundaries come from execution placement
  (Phase 7), not from the engine.
- Algorithm untouched: `computeFrontier`/`selectNextEvent` read the surviving pending
  set fresh each super-step; the sweep happens between steps, exactly where interrupt
  already mutates them.
- Deliberate non-goal: graceful teardown *patterns* (waitFor trapdoor, block as
  withdrawal guard, reverse-dependency shutdown) remain thread-authored conventions
  (proposal §1, §5), not engine machinery. `useEject` is the floor beneath them.

**Done when:** tests prove — binding any scoped hook to an undeclared space throws
*and* publishes a `space_error` trace; eject removes a space's pending + running
threads and its handlers (events of that space no longer dispatch), deletes the
declaration (post-eject binds throw, re-creation works), and publishes a
`space_ejected` trace; other spaces unaffected; frontier computation post-eject is
identical to a program that never had the space; rename compiles with zero behavior
change in the existing suite.

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

## Phase 4 — Space context & persistence

**Goal:** a space is the unit — no "session" abstraction. A space's context is its
event history (traces) plus the threads/tools provisioned in it; persistence is
artifact-based, not a session subsystem.

**Deliverables:**

- `src/agent/space-trace.ts` — per-space trace capture: subscribe via root
  `useTrace`, partition by the space field already present on candidate/selection
  snapshots, append JSONL per space (plus a whole-program log for the running agent).
- Projections from a space's trace log:
  - `toItems(log)` → Open Responses item list (function_call /
    function_call_output by `call_id`) — what the model boundary consumes.
  - `toHtml(log)` → human-readable rendering of the space's history.
- Git-backed artifact storage: durable space state (authored thread definitions,
  generated code, trace logs) commits to git — the artifact store, not a bespoke
  session database.
- **Restore** a space via `replayToFrontier` over its stored trace prefix, then
  re-provision its threads from their stored definitions, then continue live.
  (Use "restore"/"replay" — not "rehydrate", which carries DOM-rendering
  connotations from the UI layer.)
- Branching = child spaces (a branch is a space partition); abandoning a branch is
  one `useEject(branchSpace)` call (Phase -1). No sub-agent abstraction —
  delegation is child spaces + a root bridge handler forwarding a single result
  event (controlled membrane, gate-visible, ejectable).

**Done when:** tests prove — run a space → persist trace log → fresh program
restores an identical frontier via `replayToFrontier` and identical Open Responses
items via `toItems`; a branch space leaves the original line intact; ejecting a
branch deletes only its artifacts.

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

- `makeCli` unit per AGENTS.md operator-surface conventions: input `{ space, prompt,
  (optional) permissionAnswer }`, `--schema input|output` with `.describe()`.
- Per invocation: restore the space's context from its artifacts (trace prefix +
  thread definitions) → trigger prompt → run until turn-end → persist → print JSON
  output (assistant text, tool summaries, or `permission_required`).

**Done when:** `!bun run plaited agent '{"space":"s1","prompt":"..."}'` from pi
completes a turn; a guarded action returns `permission_required` and a follow-up
invocation carrying the answer completes it; a second space stays isolated.

---

## Phase 7 — Extension packs & deployment patterns (pattern surface)

**Goal:** document and enable — not yet build — the pack ecosystem. Aligned with pi's
containerization doc structure (a menu of deployment patterns, not a feature), minus
the experimental micro-VM row.

**Pack contract:**

- A pack is a module exporting `(spaceHooks) => Promise<void> | Disconnect`, where
  `spaceHooks = { useAddThread, useAddHandler, useTrigger, useTool }` are already
  bound to the pack's declared space. A pack provisions its space's threads,
  handlers, and tools as one importable unit; `useEject(space)` unwinds it entirely.
- Space semantics (authority, membership, atproto binding, tenancy) are pack-level
  concerns expressed as threads/handlers — never engine concerns.

**Deployment patterns (operator concerns, documented not enforced):**

- **Remote tool execution (default posture).** Tool execution is never co-resident
  with the agent runtime. `useTool`'s `run` is the only execution point, so a pack
  whose `run` delegates over IPC/HTTP/SSH is indistinguishable to the engine from a
  local one. Default tool packs ship remote-capable `run` cores; deployment chooses
  the target. (No specific micro-VM endorsement.)
- **Whole-process container** — run `plaited agent` itself in Docker (pi's plain-Docker
  pattern). Keys and mounts are the operator's call.
- **Inference gateway** — an Open Responses stream adapter that routes model traffic
  through a credential-injecting gateway (pi's OpenShell pattern). Falls out of the
  Phase 0 adapter seam for free.

**Done when:** docs section published; one example pack (e.g. the default guard pack
from Phase 5 repackaged) demonstrates the contract end-to-end including ejection.

---

## Explicitly deferred

- ACP adapter (any version) — revisit when a real client (GUI or Zed) is needed.
- NDJSON warm-process mode — only if per-invocation replay latency hurts.
- v2 notification lifecycle, multi-client, remote transports.
- Long-running hosted agent (REST + WebSocket, per-user spaces) — the spaces
  vocabulary exists to make this possible later; the transport and tenancy layers
  are their own project.
- No session abstraction, ever: the space is the unit. Session-like behaviors
  (restore, branch, history) are space operations over artifacts.
