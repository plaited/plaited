---
title: "Proposal: patterns and improvements for a behavioral agent harness"
---

# Proposal: patterns and improvements for a behavioral agent harness

> This proposal was originally framed around wrapping the pi coding agent's SDK
> (`pi × behavioral`). That direction was abandoned: the agent loop is rebuilt as a
> b-program on the plaited behavioral runtime, not layered on pi. The pi references
> below are historical context; the patterns themselves (acquire/release teardown,
> frontier-as-gate, dynamic handler/thread addition, `useTool`) are pi-independent
> and remain the design basis for `plan.md`.

## 0. Framing — what BP gives you that Cordis doesn't assume

BP's two unique levers, per the literature (Harel/Marron/Weiss CACM2012; Bar-Sinai's BPjs; Yaacov's BPpy):

1. **The `block` idiom** — a *negative* event veto. Harel et al. prove this makes b-programs exponentially more succinct than plain pub/sub; it's the only thing that lets a thread say "do this, and forbid that other thing until I do it" (see also csb6/bthreads, BPpy docs).
2. **Requirement-aligned b-threads** — each thread is one self-contained scenario. The superstep is a central arbiter that consults all threads at every selection (unlike actors/CSP where coordination is local).

Cordis/the paper solve something BP assumes away: system-level teardown ordering and effect inversion. For a dynamic harness — where the agent adds threads at runtime — the paper's language-level solution (fiber registry, `relied` guard, inverses) is the wrong substrate. The right idea to harvest: **threads should own their effects and enact teardown through declared patterns, and the arbiter should verify those patterns.** That's a pattern discipline + arbiter feature, not a framework rewrite.

## 1. Thread-declared acquire/release pattern (the teardown harvest)

Instead of a Cordis fiber registry, constrain the thread shape so teardown is structurally present. `Thread.rules` is an `Idioms[]`; a thread that requests an event with no cleanup must be rejected. Enforce at `useAddThread` validation or by skill convention:

```
acquireThread = [
  { request: { type: 'resource:acquire', detail: {...} } },
  { waitFor: [ { type: 'space:eject' } ] },       // trapdoor
  { request: { type: 'resource:release', detail: {...} } },
  { block: [ { type: 'dependent:teardown' } ] }    // optional guard
]
```

- **Pattern, not framework**: rules array literally shows setup then teardown — matches the paper's lexically-scoped accumulator idea as a convention the agent must emit, not a generator feature.
- **Verify**: `exploreFrontiers` can assert that a thread's `request` that opens a resource is later balanced by a `release` in some reachable path before quiescence. That's a schema-level invariant, cheaper than full confluence.

## 2. Frontier analysis as an arbiter hook, not a pre-flight gate

Frontier functions are shadowed-called utility functions ahead of an action — exactly how to make them realtime without proving the whole graph:

- The engine already shadows the frontier every superstep (`computeFrontier` produces `enabled/candidates`; `FrontierTrace` emits it). So `exploreFrontiers`/`verifyFrontiers` aren't a black-box offline tool — the live arbiter is the frontier computation.
- **Improvement**: don't run full DFS verification per superstep. Instead, increment the subgraph delta at thread-registration time. When `useAddThread({label, rules, once})` succeeds, the harness optionally runs `exploreFrontiers` over just the new thread's rules (a single thread's graph is small) and merges the findings — a deadlock that involves only one new thread is caught at add time, before it can interfere. That's realtime because it's incremental, and it's justified because the paper's own confluence theorem only needs independence/totality locally.
- **Goal**: make `findDeadlocks`/`findLivelocks` a registration-time gate the harness can invoke, and let `useTrace` report it as a violation before the arbiter accepts the thread.

## 3. Dynamic handler/thread addition via the arbiter

Handlers are superstep-consumed after selection (`useAddHandler` → `actionPublisher`). Threads are added via `useAddThread` (validated by `ThreadSchema`) and `useTrigger` (external events into candidates). For the agent to add handlers dynamically:

- **Pattern**: a pair — a long-lived manager thread yields a `request` for an event type `handler:register` (detail: `{type, space}`), and a handler-once executes a callback that itself calls `useAddHandler(type, callback)`. The event bus `payload` side-channel carries the closure — `detail` stays JSON so frontier analysis can see the registration.
- **Pattern**: dynamic threads are registered by `useAddThread<{label,rules,once}>` invoked from a handler that received a `thread:spawn` request. The registration event is stamped `ingress` and the generator is started; thread priority is assigned at `entries.push` index.

## 4. `useTool` factory — tools as handler+guard-thread pairs

The `useTool` factory (Phase 2 of `plan.md`) is the concrete realization of this proposal's dynamic handler/thread addition. A tool is not a callback — it's a **handler + guard-thread pair** wired through the arbiter:

- **Handler**: registered on event type `name`, parses `detail` with `inputSchema` (Zod), awaits `run`, validates output, `trigger({ type: `${name}_result` })`.
- **Guard thread**: two rules, both pending — a `block` on `name` with `detailSchema` + `detailMatch: 'invalid'`, and a `request` for `tool_call_blocked` with the reason. The guard blocks malformed calls before they reach the handler; the blocked call becomes a `tool_call_blocked` event the model sees as an error result.

This is the `useTool` spec from `plan.md` Phase 2, not a separate framework feature. The factory derives JSON Schema via `z.toJSONSchema` for listener matching, asserts schema purity (no `call_id` baked in), and returns a frozen descriptor for code generation reference.

## 5. Where `interrupt` stays violent, `block` conservative, `waitFor` trapdoor

- `interrupt` (`generator.return()`) = BPpy's `stop()`/kill idiom — violent and correct for obsolete threads.
- `waitFor` = suspended trapdoor — the engine's pending/completed loop.
- `block` = conservative veto — the arbiter's negative filter.

The improvement is in making thread graphs self-describing (patterns) and the arbiter able to check them (incremental frontier gate).

## 6. What to call this agent

Not "self-healing"/"immortal." BP literature calls it an executable specification (b-program = verified model) or a behavioral agent (reactive controller). For your harness, the honest name is a verifiable behavioral agent — or, when it adds threads at runtime per-schema, a dynamic behavioral agent. That matches BPpy's "executable specification" and BPjs's "formally verifiable component embedded in tested code."

## 7. What not to adopt from Cordis

- **Fiber registry / provision tables** (`relied` guard) — keep in the paper; here the handler-closure pattern is enough.
- **System-wide confluence theorem** (Theorem 73) — it assumes quiescence, no failed fibers, pairwise independence. A dynamic harness runs under failure, so absolute zero-residue is a lie; instead, make the pattern discipline structural and the arbiter warn on imbalance.

## 8. Ordered implementation suggestions

1. **Thread schema watermark**: mark acquire/release pairs during skill generation; add a `useAddThread` wrapper that warns if `request` isn't followed by `release` when a resource detail is tagged.
2. **Arbiter hook**: in `useAddThread`, call `exploreFrontiers` on the new rules and attach findings to `AddThreadError`/`RuntimeError` traces.
3. **Handler/thread factories**: build a small `handler:register` and `thread:spawn` pattern (two idioms + one handler) in the skill's script layer.
4. **CLI tools as `useTool` units**: the four CLI commands become tools with `detailSchema` synthesized from their input Zod (`plaited skills` knows the schemas) — realized as Phase 3 of `plan.md`.
5. **Frontier gate**: wire `verifyFrontiers` into the skill's validation run (not every superstep; only add time).

That's the honest, minimal harvest: BP's blocking idiom + patterns, plus the paper's structural lesson (teardown declared in-thread), realized in the arbiter and schema, not in the engine core.

## 9. Sequencing — where this leads

1. **Self-improving layer (now)**: generate skills/threads/handlers, verify via `verifyFrontiers`, keep winners (skills@skill tree, `plaited evalBehavioral` autoresearch).
2. **Plateau detect (later)**: watch `Trace` union across groups — reward flatline → shift from single-agent generation to community coordination.
3. **Community autoresearch (then)**: AgentHub (Karpathy's agent-first collaboration platform) hosts the evolving skill/thread grammar as a commit DAG; Daytona sandboxes execute rollouts; `verifyFrontiers` gates admission. No model fine-tuning — the artifact is the grammar, not the weights.

The detailed gate/reward specification lives in `research/differential-frontier-gate-stable-reward.md`. The phased build plan that operationalizes this proposal is `plan.md`.
