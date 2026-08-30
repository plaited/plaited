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
- The engine lives in `src/runtime/` after Phase -2; all harness code lands in
  `src/agent/`; the render/protocol layer (`src/ui/`) is out of the agent's import
  surface and becomes a pack-wrapped tool later.
- The sketch in `src/main/behavioral.ts` lines ~400-423 (`useTool` spec) is reference
  material for Phase 2, not gospel — fix its mechanical errors per Phase 2.

---

## Phase -2 — Repo restructure: `src/runtime/`, `src/agent/`, `src/ui/`

**Goal:** the source tree matches the architecture before any agent code lands.
Today `src/main/` flattens the behavioral engine, frontier analysis, renderer,
swap-boundary, and css/html/message schemas into one surface (`src/main.ts`
re-exports all of it). An agent authoring threads needs only the coordination
kernel — the UI machinery is a future tool, not a library import.

**Deliverables:**

- `git mv` restructure:
  - `src/runtime/` ← `behavioral.*` (engine, schemas, types, constants, utils) +
    `frontier-analysis.ts`. The gate needs frontier analysis and it shares types
    with the engine (`replayToFrontier` imports `PendingBid` etc.) — one unit, not
    a separate top-level dir.
  - `src/agent/` ← new home for the harness (Phases 0–6 land here).
  - `src/ui/` ← `renderer.ts`, `swap-boundary.ts`, `html-rewriter.utils.ts`,
    `css.*`, `html.*`, `message.*` — the render/protocol layer. Stays importable
    (`src/controller.ts` consumes the message protocol at SSR time); becomes a
    `useTool`-wrappable pack later (Phase 7) without another move.
  - `src/cli/` mostly dissolves: `git-context`, `markdown`, `mcp-client`,
    `typescript-lsp` become `useTool` units (Phase 3) living in `src/agent/tools/`.
    What survives is the entry (`bin/plaited.ts`) and the `makeCli` machinery that
    Phase 6's input parsing / `--schema` surface still uses — relocate that residue
    to `src/agent/` or a minimal `src/cli.ts`; the directory goes away.
- `src/main.ts` shrinks to re-exporting `src/runtime/` only — the public surface
  for thread-authors and pack-authors.
- `package.json` exports: `"."` → `src/main.ts` (runtime), `"./ui"` →
  `src/ui.ts` boundary, `"./controller"` and `"./utils"` unchanged.
- File-naming per AGENTS.md: module-prefixed files keep their prefixes under
  `runtime/` (`behavioral.schemas.ts` etc.); the directory provides context.

**Done when:** `bun --bun tsc --noEmit` clean; full `bun test` suite passes with only
import-path changes; `src/main.ts` exports nothing from `ui/`; no file contents
change beyond import paths.

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
- **New trace kind `space_error`** (`TRACE_MESSAGE_KINDS`): a scoped hook bound to an
  undeclared space publishes `{ kind, timestamp, space, operation, error }` on the
  trace publisher *before* throwing (the throw is for the caller; the trace is for
  the system — gate-visible when a generated thread binds against a nonexistent
  space). The trace is emitted by the hook itself, not caught from the throw.
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
  - cancellation is an `interrupt` on the loop thread's rules, not a separate
    thread: the loop carries `interrupt: [{ type: 'cancel' }]` at each step, so
    triggering `cancel` in the space tears the turn down via the interrupt path;
  - stop-condition as a thread requesting `turn.end`, not a callback.
- Loop thread shape (looping, no `once`), each rule carrying the cancel interrupt:
  `{ waitFor: [userPrompt], interrupt: [cancel] }` → `request: llm.stream` →
  `{ waitFor: [llm.done], interrupt: [cancel] }` → `request: <tool name>` per parsed
  function_call → `{ waitFor: [<name>_result], interrupt: [cancel] }` (matched by
  `detailSchema` const on `call_id`) → append items → loop.
  The ingress event is `user.prompt`, triggered into the space by the CLI (Phase 6
  input `{ space, prompt }`).

**Done when:** tests prove — happy path (prompt → stream → tool call → result →
next stream), cancel mid-turn via interrupt, terminal error stops the turn. All
coordination appears as events in traces (assert via `useTrace`).

---

## Phase 2 — `useTool` factory

**Goal:** tools are makeCli-style units wired as handler+guard-thread pairs. Reference:
the spec sketch at `src/main/behavioral.ts:400-423` and
`research/behavioral-agent-harness-proposal.md` §4.

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
    traces, the frontier gate, and trace-log restore can all see the correlation;
  - registers handler on event type `name`: parses `detail` with `inputSchema`,
    awaits `run`, validates output, `trigger({ type: `${name}_result` })`;
  - registers the standing guard thread (two rules, both pending; fixes the sketch's
    block-is-array / detailMatch-enum / malformed-detail errors):
    ```
    rules: [
      { block: [{ type: name, detailSchema: jsonSchema, detailMatch: 'invalid' }] },
      { request: { type: 'tool_call_blocked', detail: { name, reason } } },
    ]
    ```
  - returns a frozen descriptor `{ name, inputSchema, outputSchema, jsonSchema }`
    for code generation reference.
- A default handler on `tool_call_blocked` that produces the model-visible error
  result (the model must see why its call was refused — blocked ≠ silent at runtime).

**Done when:** tests prove valid call → result event; malformed call → blocked,
`tool_call_blocked` selected, error result produced; two parallel same-tool calls
correlate by `call_id`.

---

## Phase 2.5 — Default tool pack (pi-equivalent core tools)

**Goal:** the agent's hands. Reimplement pi's default built-in tools — `read`, `bash`,
`edit`, `write`, `grep`, `find`, `ls` — as `useTool` units, carrying Zod schemas,
guard threads, and space-deployability natively (no callback-shaped pi tools).

**Deliverables:**

- `src/agent/tools/` — one `useTool` unit per tool. Schemas derived from usage (not
  copied from pi's TypeBox); `run` cores are pure async functions. `bash` runs through
  `Bun.$`; file tools through `Bun.file`/`Bun.write`.
- Root provisioning: a `provisionDefaults(rootHooks)` that registers all seven at root.
- Space-deployable variants: the same units accept space-scoped hooks; a policy pack
  can substitute a restricted variant (read-only set, remote-executing `bash`).
- These are the critical path to a useful agent — the CLI conversions (Phase 3) are
  additive on top.

**Done when:** each tool passes schema validation at registration (Phase 2 purity
checks); tests drive each through a b-program (trigger call → `_result`); the guard
pair blocks a malformed `bash` call and emits `tool_call_blocked`; provisioning the
same tool at root and in a space works independently (space-scoped result events).

---

## Phase 3 — Convert `src/cli` units to `useTool` tools; dissolve `src/cli/`

**Goal:** `git-context`, `markdown`, `mcp-client`, `typescript-lsp` become agent tools
alongside the defaults. The CLI surface they came from goes away — bare `plaited` is
the agent (Phase 6); the only surviving CLI machinery is the entry + `makeCli`.

**Deliverables:**

- Per unit: extract the `run(input)` body into a pure async core
  `(input) => output`, register via `useTool`, and move into `src/agent/tools/`.
- Move the surviving CLI residue (`makeCli`, request parsing, schema printing) out
  of `src/cli/` — it exists to serve `plaited`'s input/`--schema` surface, not a
  multi-command tool surface.
- Envelope: tool input/output details carry `call_id` top-level (stamped by the loop).

**Done when:** the four tools pass Phase 2.5-style b-program tests (trigger call →
`_result`, malformed blocked); they provision at root and into a space; `src/cli/`
is gone; the four tools' prior behaviors are reachable through the agent (not as
standalone subcommands).

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
  database.
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
  JSON `permission_required` output → the human's answer arrives as a follow-up
  `plaited` command carrying `permissionAnswer` (serve mode: next command to the
  running process; `--no-serve`: next invocation's input) → `permission.resolved`
  trigger → guard interrupted → the pended call becomes selectable. Deny path
  requests the tool's error result so the model sees the refusal.
- Standing policy threads are composable additions (e.g. auto-allow reads under src/).
- Registration gate: new threads pass `verifyFrontiers` per
  `research/differential-frontier-gate-stable-reward.md` (`verified` admits,
  `failed` rejected with `add_thread_error` trace, `truncated` per policy).

**Done when:** tests prove — guarded call blocked until approval; approval interrupts
the guard and the call executes; deny produces an error `_result`; a malformed or
deadlocking generated guard is rejected by the gate.

---

## Phase 5.5 — Eval loop (autoresearch): gate, tool, observer

**Goal:** the self-improving loop from
`research/talk-self-improving-agents-from-behavioral-exhaust.md` — an agent reads its
own exhaust and iterates. Three *separate* mechanisms, kept distinct to avoid
meta-regress:

**Layer 1 — Registration gate (harness-side, Phase 5).** The harness wraps
`useAddThread` and calls `verifyFrontiers` on the new thread's rules *before*
admission. `verified` admits; `failed` rejects with `add_thread_error`;
`truncated` per policy. Lives in `src/agent/` (not the engine — the engine stays
domain-agnostic and must not pay exploration cost per `useAddThread`). This is the
gate spec'd in `research/differential-frontier-gate-stable-reward.md`.

**Layer 2 — `verify-frontier` tool (agent-callable self-check).** A `useTool` unit
exposing `verifyFrontiers` inside the b-program:

```
input:  { threads: Thread[] }        (Zod schema; pure candidate data)
output: { status: 'verified'|'failed'|'truncated', findings, livelocks }
```

The agent authors a candidate `Thread[]`, requests `verify-frontier`, waits for
`verify-frontier_result` (correlated by `call_id`), and keeps/discards the candidate
by verdict. **No regress:** the gate operates on the candidate *data* (its own
`pending` set per `exploreFrontiers`), never the live program's frontier — so the
agent verifying a candidate never recurses into verifying itself. The verdict symbol
(`verified`/`failed`/`truncated`) is the in-context training signal (symbol-tuning):
prior `(thread-shape → verdict)` pairs feed the next generation.

**Layer 3 — `useTrace` observer callback (controller-side).** When the orchestrator
(agent A) sets up worker instances (1-n), it passes a `useTrace` listener per worker
program. `useTrace` subscribes to the trace publisher — *outside* the event/action
loop — so it observes without participating: traces never become selected events and
cannot re-enter a worker's frontier. This is the controller's oversight channel
(worker deadlocks, errors, progress), distinct from the worker's own gate (Layer 2).

**The reward function** (`computeThreadReward`: `verified`→1, `truncated`→0,
`failed`→-1) is a pure function of the Layer 1/2 verdict — lives in `src/agent/`
with the eval loop, not the engine.

**Candidate sandbox:** one space per rollout — create, register the verified
candidate, observe in isolation, `useEject`. Reuses Phase -1/4 machinery; no new
engine work. The generator (the agent authoring variants) runs under `--seed`; the
gate is a pure function and does not consume the seed; the sandbox is a space. Three
separation-of-concerns mechanisms, never conflated.

**Done when:** the agent calls `verify-frontier` on a candidate and receives a
verdict; a `failed` candidate is discarded and a corrected one re-gated; the
controller observes a worker's deadlock via its `useTrace` callback without the
worker reacting to it; a candidate executed in its sandbox space leaves the root
program's frontier identical after eject.

---

## Phase 6 — CLI entry: `plaited` (serve-default)

**Goal:** the bare `plaited` command is the agent. The warm process is the product;
the CLI is its client.

**Deliverables:**

- `plaited` (no subcommand) talks to the running agent process, starting it if absent.
  Input `{ space, prompt, (optional) permissionAnswer }`.
- `plaited --no-serve` — one-shot cold-run (restore space context from artifacts →
  trigger prompt → run to turn-end → persist → print JSON). For CI and minimal envs.
- `plaited --seed <n>` — validation mode: the serve process runs against the Phase 0
  scripted StreamFn adapter with a seeded RNG. Deterministic, no network — this is
  the testing/validation mode, wired through the adapter seam, not a second process
  shape. **Scope note:** `--seed` seeds the *generator* (the model stream producing
  turns/candidates). The frontier gate (`verifyFrontiers`) is a pure function of
  thread data and is already deterministic — it does not consume the seed. Don't
  conflate the two determinisms.
- Root provisioning at startup: default tool pack (Phase 2.5) + CLI-derived tools
  (Phase 3) + guard pack (Phase 5) at root; spaces get subsets/variants on creation.

**Done when:** `!plaited '{"space":"s1","prompt":"..."}'` from pi (positional JSON
arg is the CLI's input) completes a turn via the serve process (auto-started if
needed); `plaited --seed 42` reproduces a turn bit-for-bit twice; `plaited --no-serve`
works with no daemon; a guarded action returns `permission_required` and a follow-up
`plaited` command completes it; a second space stays isolated.

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

## Adoption invariants (not features)

Properties the core must preserve so future directions stay open without the core
committing to them. These are constraints on how we build the phases above, not new
work:

- **The engine never imports atproto.** Spaces remain bare string ids; authority,
  tenancy, and membership are pack-level concerns expressed as threads/handlers.
- **Trace logs stay append-only and ordered.** No rewrites or reordering — a
  self-certifying signed-commit sync shape (CAR/MST) requires it later. Phase 4's
  JSONL is already this; don't break it.
- **Packs are the only integration seam.** Network, identity, sync, and rendering
  concerns (atproto spaces, cloud mirrors, GUI lexicons) bind through the Phase 7
  pack contract. Some packs will run as sidecar processes — the contract already
  permits this since `run`/handlers are plain async functions.
- **Artifacts are complete.** Anything durable (trace logs, thread definitions) is
  sufficient to verify/replay on its own — `replayToFrontier` already demands this.
  Author identity (signing, DIDs) is attached later by a pack, not baked in.
- **The trace log is also the corpus-eval substrate.** Append-only, complete,
  query-able per space — the same artifact a batch/corpus eval (aggregate analysis
  over many runs, e.g. tool-budget / read-discipline / param-compliance queries over
  `trial.trajectory`-style data) consumes. Keep it projection-friendly; don't
  foreclose a dataset-eval service built on it later.

No deployment topology is prescribed: local-only, cloud, local-with-cloud-mirror are
all operator choices the design must remain compatible with.

---

## Explicitly deferred

- ACP adapter (any version) — revisit when a real client (GUI or Zed) is needed.
- NDJSON warm-process mode — only if per-invocation replay latency hurts.
- v2 notification lifecycle, multi-client, remote transports.
- Long-running hosted agent (REST + WebSocket, per-user spaces) — the spaces
  vocabulary exists to make this possible later; the transport and tenancy layers
  are their own project.
- atproto identity/sync/lexicon packs (agent DID + user DID, trace commits as
  signed records, cloud-mirror PDS, behavioral-rendering lexicon for a future GUI) —
  bind later via the pack seam; no core dependency. Gated on atproto spaces
  stabilizing out of alpha.
- Dataset/corpus eval service (aggregate analysis over many persisted trace logs —
  the third leg alongside the per-thread symbolic gate and the iterative
  autoresearch loop). All three consume the same trace-log artifact; the corpus
  layer is a pack/service concern, not core.
- No session abstraction, ever: the space is the unit. Session-like behaviors
  (restore, branch, history) are space operations over artifacts.
