# Behavioral Agent Harness — Phased Build Plan

Self-improving agent built on the plaited behavioral runtime (`src/runtime/behavioral.ts`
after Phase -2; today `src/main/behavioral.ts`).
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
- The `useTool` spec sketch that lived at `src/main/behavioral.ts` lines ~400-423 was
  abandoned (reverted) — Phase 2 below is the single, corrected specification.

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
    `typescript-lsp` become `useTool` units (Phase 3) living in `src/pack/`.
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
  - Handlers: `useAddHandler(space)` already returns a per-registration `Disconnect`;
    additionally each registration is recorded in an engine-side per-space registry,
    and `useEject` runs all of them (caller-held disconnects remain valid for
    individual removal — two removal paths, one subscription each).
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
  `tools`, `truncation: 'auto'|'disabled'`, `instructions`) and the minimal stream
  event union (`OpenResponsesStreamEvent`) incl. terminal-event `usage`
  (`input_tokens`/`output_tokens`/`total_tokens`) and the spec-native `compaction`
  item type (`/v1/responses/compact` returns `{ type: 'compaction',
  encrypted_content }` — sent back as base input; adapters synthesize it for
  providers without a compact endpoint).
- `src/agent/use-response.ts` — `type UseResponse = (req) =>
  AsyncIterable<OpenResponsesStreamEvent> |
  Promise<AsyncIterable<OpenResponsesStreamEvent>>` and
  `type Adapter = { provider, respond: UseResponse }`, plus the `useResponse`
  factory (validate provider non-empty, freeze). Repo pattern: camelCase function,
  PascalCase-of-name type (`useTrigger`/`UseTrigger`). Contract documented: never
  throw, encode failure as a terminal error event. The daemon routes by `provider`
  name; adapters wire through `useResponse`.
- `src/agent/` adapter seam: adapters are plain modules (no `adapters/` nesting —
  with IoC there's no registry to organize). Contract: adapter modules export a
  factory wiring `{ provider, respond: UseResponse }` through `useResponse` —
  the daemon routes model traffic by `provider` name without a lookup map. Scenario
  data for test doubles stays in tests; when `--seed` needs named scenarios the
  daemon reads them from the plugin/`.agents` surface.

**Done when:** tests drive a scripted adapter (a `UseResponse` bound via
`useResponse`) through deltas → terminal error → abort;
`bun --bun tsc --noEmit` clean.

---

## Phase 1 — The agent loop as a b-program

**Goal:** replace pi's `runLoop` with b-threads. Coordination (steering, abort, stop
conditions) is expressed as threads, not callbacks.

**Deliverables:**

- `src/agent/threads.ts` — a file of threads: the turn loop thread (see shape
  below), the stream-adapter handler, the stop-condition thread, and the compaction
  thread.
- **Spec events verbatim — no `llm.*` translation layer.** The stream-adapter
  handler iterates the adapter's `UseResponse` (yielding typed
  `OpenResponsesStreamEvent`s) and triggers each as a b-event as-is:
  `trigger({ type: event.type, detail: <event fields minus type> })`. Phase 0's
  typed events make an invented `llm.*` vocabulary redundant; traces then show
  spec-aligned event types end to end (Phase 4's `toItems` projection reads the
  same types the loop matched on).
- Loop thread reacts declaratively via `detailSchema` matching:
  - tool calls arrive as `response.output_item.done` with `detailSchema` matching
    `item.type: 'function_call'` — no separate toolCall event;
  - terminal wait is the three spec terminal types:
    `waitFor: ['response.completed', 'response.failed', 'response.incomplete']`.
- Cancellation is an `interrupt` on the loop thread's rules, not a separate
  thread: the loop carries `interrupt: [{ type: 'cancel' }]` at each step, so
  triggering `cancel` in the space tears the turn down via the interrupt path.
- Stop-condition as a thread requesting `turn.end`, not a callback.
- **Tool dispatch is handler-side (discovered in Phase 1 implementation).** Threads
  are static data and cannot request dynamically-named events (`<tool name>` varies
  per response). The `respond` handler collects `function_call` items during stream
  iteration and dispatches tool events after the stream completes; the loop thread
  re-awaits `respond` (its first rule waits on `user.prompt` OR `respond`) after
  tool results append via a generic `tool.result` event (engine handlers match
  exact-type only; `<tool name>_result` still fires for trace visibility).
- Loop thread shape (looping, no `once`), each rule carrying the cancel interrupt:
  `{ waitFor: [user.prompt, respond], interrupt: [cancel] }` → request respond →
  `{ waitFor: [terminal types], interrupt: [cancel] }` → (handler dispatches tools;
  results re-trigger respond) → loop.
  The ingress event is `user.prompt`, triggered into the space by the CLI (Phase 6
  input `{ space, prompt }`).
- Stop condition thread **loops** (no `once`): every `response.completed` requests
  `turn.end` — a once-thread dies after turn one and the harness loses the
  turn-done signal for subsequent turns.
- Harness coordination events (`user.prompt`, `respond`, `tool.result`,
  `context.threshold`, `compaction.start/done`, `turn.end`) are legitimate
  vocabulary distinct from spec stream event types; stream events appear verbatim
  as spec types.
- Context management as a b-thread: after each turn's terminal event, a compaction
  thread reads the terminal event's `usage.input_tokens` and compares against the
  model's context limit, declared on the adapter (`Adapter` gains an optional
  `contextWindow: number` — the spec doesn't carry it; adapters know their
  providers). Below threshold it does nothing; at/above threshold it blocks the
  loop's next stream request until a compaction completes (provider compact
  endpoint or adapter-synthesized summary producing a `compaction` item, which
  becomes base input). Use `truncation: 'disabled'` so overflow is a hard,
  catchable error — never silent degradation. The compaction gate is a plain
  block/waitFor pattern; no callback.
- **Phase 0 follow-up (schema gap):** `CompactionItem` is output-only —
  `InputItemSchema` cannot carry a compaction item as base input, so the Phase 1
  compaction handler wrapped `encrypted_content` in a user message (MINIMAL'd).
  Add `compaction` to `InputItemSchema` and feed the real item back as base input.

**Done when:** tests prove — happy path (prompt → stream → tool call → result →
next stream), cancel mid-turn via interrupt, terminal error stops the turn,
threshold crossing blocks the next stream until compaction completes. All
coordination appears as events in traces (assert via `useTrace`); event types in
traces are spec event types, not an invented vocabulary.

---

## Phase 2 — `useTool` factory

**Goal:** tools are makeCli-style units wired as handler + descriptor, validated at
dispatch time. Reference: `research/behavioral-agent-harness-proposal.md` §4 (this
section supersedes the abandoned engine sketch) and Phase 1's discovered reality
(threads are static data — dynamic dispatch lives in handlers).

**Deliverables:**

- `src/agent/use-tool.ts` — external factory taking the partially-applied
  `{ addThread, addHandler, trigger }` (bound capabilities, matching Phase 1's
  `AgentHooks`). `useTool({ name, inputSchema (Zod), outputSchema (Zod), run })`:
  - derives JSON Schema via `z.toJSONSchema` for listener matching; shape-validate
    both derived schemas with `JsonSchemaObjectSchema` (the engine's exported
    single source of truth for "is this a JSON Schema document?");
  - tool schemas stay **pure args/result** — no `call_id`. The purity check is
    structural (no Ajv — Ajv stays in the engine for listener compilation): reject
    registration when either derived schema has a top-level `properties.call_id` or
    `call_id` in `required`. The `call_id` envelope is stamped at
    dispatch: the `respond` handler owns `call_id` + `arguments` when lifting a
    `function_call` item into a tool-call event, and results echo it on
    `${name}_result` / `tool.result`. Rationale: `call_id` must stay in `detail`
    (never `payload`) so listener matching, traces, the frontier gate, and
    trace-log restore can all see the correlation;
  - registers the handler on event type `name`: parses `detail.arguments` with
    `inputSchema`, awaits `run`, validates output with `outputSchema`, then
    triggers **both** result events — `${name}_result` (trace visibility, echoes
    `call_id`) and the generic `tool.result` (items-store integration + turn
    continuation, the Phase 1 bridge);
  - returns a frozen descriptor `{ name, inputSchema, outputSchema, jsonSchema }`
    for the dispatch-time registry and code-generation reference.
- **Validation at dispatch time — no guard thread in Phase 2.** The static-data
  limitation discovered in Phase 1 applies: a guard thread's
  `request: { type: 'tool_call_blocked', detail }` cannot echo the dynamic
  `call_id` of the blocked call, so a blocked malformed call could never produce a
  correlated error result — and without it the items store lacks the
  `function_call_output`, the next `respond` sends a function_call with no output,
  and the provider 400s. Instead: `registerAgentThreads` accepts a tool-descriptor
  registry (built from `useTool` calls); the `respond` handler validates
  `JSON.parse(arguments)` against the tool's `inputSchema` **at dispatch time**.
  Malformed → the dispatch path emits `tool_call_blocked` (trace, detail carries
  `call_id` + `name` + reason) **and** a correlated error `tool.result` (model
  sees the refusal, turn continues). Blocked ≠ silent, and the turn survives.
- The **block-idiom guard thread moves to Phase 5** (policy as threads), where
  semantic blocking (dangerous-arg patterns) is designed with the correlation
  problem solved properly.

**Done when:** tests prove valid call → `${name}_result` + `tool.result` (both
echo `call_id`); malformed call → `tool_call_blocked` + error `tool.result`, and
the next `respond` request carries the error `function_call_output`; two parallel
same-tool calls correlate by `call_id`; a tool schema containing `call_id` is
rejected at registration.

---

## Phase 2.5 — Default tool pack (pi-equivalent core tools)

**Goal:** the agent's hands. Reimplement pi's default built-in tools — `read`, `bash`,
`edit`, `write`, `grep`, `find`, `ls` — as `useTool` units, carrying Zod schemas,
guard threads, and space-deployability natively (no callback-shaped pi tools).

**Deliverables:**

- `src/pack/` — one file per tool (`read.ts`, `bash.ts`, `edit.ts`, `write.ts`,
  `grep.ts`, `find.ts`, `ls.ts`), each exporting a frozen `ToolArgs` object
  (`{ name, inputSchema, outputSchema, run, description }`) — plain data, no hooks,
  testable without the engine. Schemas derived from usage (not copied from pi's
  TypeBox); `run` cores are pure async functions, errors returned as data
  (`isError`/structured errors — never thrown). Bun APIs: `bash` via `Bun.spawn`
  (`shell -c` interpreter bridge, native `timeout`/`killSignal`) with
  tail-truncated (last 2000 lines / 50KB, UTF-8-safe) control-char-sanitized
  output — the tool `description` carries that contract to the model;
  file tools via `Bun.file`/`Bun.write`; `find`/`ls` via `Bun.Glob`; `grep` prefers
  `rg` (`Bun.which` + `Bun.spawn`) with a JS line-scanner fallback (`MINIMAL:`).
- **`edit` constructs its unified patch — no `diff` dependency, no streaming.** The
  edit location is known (`old_text` → `new_text` at matched line ranges), so the
  patch is built from the edit range with context lines — ~dozens of lines,
  deterministic, no Myers/LCS. Port pi's line-ending helpers
  (`detectLineEnding`/`normalizeToLF`/`restoreLineEndings` pattern from
  `packages/agent/src/harness/tools/edit-diff.ts`); fuzzy-match normalization is a
  `MINIMAL:` defer. Enforce match discipline: `old_text` must match exactly once
  unless `replace_all`.
- **The bun-runtime skill governs API choices** (`~/.agents/skills/bun-runtime/`):
  verify Bun APIs via its Mode 1 lookup (`plaited mcp-client` →
  `https://bun.com/docs/mcp`, `search_bun`) instead of asserting from memory;
  no `node:fs` (Node `node:path` is fine); no Python/heredocs.
- pi's harness tools (`packages/agent/src/harness/tools/`) are **behavioral
  examples only** — fetch via `gh` for semantics (match discipline, truncation,
  result shapes), never for code (TypeBox, `diff` dep).
- `src/agent/provision-defaults.ts` — the harness-side provisioner: imports the tool
  data from `src/pack/` and wires each via `useTool`; `provisionDefaults(rootHooks)`
  registers all seven at root. Provisioning is harness code (the agent decides what
  activates where); the pack stays pure data.
- Space-deployable variants: the same `ToolArgs` data provisions into any space via
  space-scoped hooks; a policy pack can substitute a restricted variant (read-only
  set, remote-executing `bash`).
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
  `(input) => output`, wrap as a `ToolArgs` object, and add as a tool file in
  `src/pack/` (`git-context.ts`, `markdown.ts`, `mcp-client.ts`,
  `typescript-lsp.ts`); `provision-defaults.ts` wires them. `makeCli` keeps
  parse → core → validate → print for direct CLI use where still needed.
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
  The log records thread/tool *registrations* as well as selections — restore
  (below) needs the provisioned set, not just the event stream.
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

- Guard threads per guarded call: `{ block: [callListener],
  interrupt: [approvalFor(call_id)] }` — policy blocking designed with the
  call_id-correlation problem solved (Phase 2's dispatch-time validation covers
  malformed inputs; this layer covers semantic policy).
- Permission flow: blocked guarded call → `permission.ask` event → handler emits a
  JSON `permission_required` output → the human's answer arrives as a follow-up
  `plaited` command carrying `permissionAnswer` (serve mode: next command to the
  running process; `--no-serve`: next invocation's input) → `permission.resolved`
  trigger → guard interrupted → the pended call becomes selectable. Deny path
  requests the tool's error result so the model sees the refusal.
- Standing policy threads are composable additions (e.g. auto-allow reads under src/).
- Registration gate: the harness wraps `useAddThread` with a `verifyFrontiers` call
  on new thread rules *before* admission, per
  `research/differential-frontier-gate-stable-reward.md` (`verified` admits,
  `failed` rejected with `add_thread_error` trace, `truncated` per policy).
  Full layering in Phase 5.5 Layer 1.

**Done when:** tests prove — guarded call blocked until approval; approval interrupts
the guard and the call executes; deny produces an error `_result`; a malformed or
deadlocking generated guard is rejected by the gate.

---

## Phase 5.5 — Eval loop (autoresearch): gate, tool, observer, skill surface

**Goal:** the self-improving loop from
`research/talk-self-improving-agents-from-behavioral-exhaust.md` — an agent reads its
own exhaust and iterates. Three *separate* gate/observer mechanisms (kept distinct to
avoid meta-regress) plus the third mutable surface (skill text):

**Layer 1 — Registration gate (harness-side; owns the definition).** The harness wraps
`useAddThread` and calls `verifyFrontiers` on the new thread's rules *before*
admission. `verified` admits; `failed` rejects with `add_thread_error`;
`truncated` per policy. Lives in `src/agent/` (not the engine — the engine stays
domain-agnostic and must not pay exploration cost per `useAddThread`). This is the
gate spec'd in `research/differential-frontier-gate-stable-reward.md`. Phase 5
references this layer; this is the single definition.

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

**Layer 4 — Skill surface (third mutable surface).** Threads and tools gate
symbolically (worker-side, Layer 2); skill text is prose and needs an LLM judge —
so it judges *controller-side*, matching the neuro-symbolic split (worker proposes,
controller disposes):

- `skill` tool (`useTool` unit, built on the Phase 3 `markdown` core):
  `read-skill` / `write-skill` / `validate-skill` (frontmatter + link validation).
  The agent edits its own skill text through these.
- Judge callback: a controller-side `useTrace` listener (Layer 3 wiring) that, on a
  `skill.proposed` trace, calls an Open Responses judge endpoint — the `judgeJson`
  pattern: one stateless `complete` call `{ model, system, user }` → strict JSON
  verdict (see the DeepSearchQA grader). No external eval harness — the judge is a
  UseResponse/adapter call like any other. The controller then triggers `skill.scored`
  back into the worker's space; the worker keeps or discards the variant.

**The reward function** (`computeThreadReward`: `verified`→1, `truncated`→0,
`failed`→-1) is a pure function of the Layer 1/2 verdict — lives in `src/agent/`
with the eval loop, not the engine.

**Candidate sandbox:** one space per rollout — create, register the verified
candidate, observe in isolation, `useEject`. Reuses Phase -1/4 machinery; no new
engine work. The generator (the agent authoring variants) runs under `--seed`; the
symbolic gate is a pure function and does not consume the seed; the sandbox is a
space. Three separation-of-concerns mechanisms, never conflated.

**Done when:** the agent calls `verify-frontier` on a candidate and receives a
verdict; a `failed` candidate is discarded and a corrected one re-gated; the
controller observes a worker's deadlock via its `useTrace` callback without the
worker reacting to it; a candidate executed in its sandbox space leaves the root
program's frontier identical after eject; a proposed skill variant is judged by the
controller callback and the score event lands in the worker's space.

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
  scripted adapter (a `UseResponse` bound via `useResponse`) drives it; the Phase 0
  test double *is* this adapter — scripted
  responses keyed by seed; one artifact, not two) with a seeded RNG. Deterministic,
  no network — this is the testing/validation mode, wired through the adapter seam,
  not a second process shape. **Scope note:** `--seed` seeds the *generator* (the
  model stream producing turns/candidates). The frontier gate (`verifyFrontiers`) is
  a pure function of thread data and is already deterministic — it does not consume
  the seed. Don't conflate the two determinisms.
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

- A pack is a plugin directory in Agent Plugins format: `plugin.json` manifest plus
  component directories. Space-provisioning code lives in the client-extension
  namespace `dev.plaited/` (e.g. `dev.plaited/provision.ts` exporting
  `(spaceHooks) => Promise<void> | Disconnect`, where `spaceHooks =
  { addThread, addHandler, trigger, useTool }` are bound to the pack's
  declared space). A pack provisions its space's threads, handlers, and tools as one
  importable unit; `useEject(space)` unwinds it entirely.
- **Adapter discovery:** a plugin may declare adapters via the client extension
  field in `plugin.json`:
  ```json
  { "extensions": { "plaited": { "adapters": ["./adapters/anthropic.ts"] } } }
  ```
  Paths are relative to the plugin directory; the daemon imports each module's
  default export (the factory contract from Phase 0). Wrong shape = skip + report
  (fail-soft per the plugin spec's component-failure principle). Security note:
  activating a plugin imports its adapter code with daemon privileges — same trust
  boundary as pi extensions.
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
