/**
 * Minimal turn-loop thread — the scaffolding behavioral program that proves
 * the kernel + dispatch bridge + model tool run one turn end-to-end.
 *
 * @remarks
 * MINIMAL: scaffolding turn-loop thread — to be replaced by autoresearch-evolved
 * threads (Phase 5.5). Proves kernel + dispatch + model tool run a turn
 * end-to-end. Do not build steering/abort/compaction/policy here — later phases.
 *
 * The thread is a static, looping rule sequence (no `once`); the dynamic
 * decisions (does the response carry a function_call? has the iteration cap
 * tripped?) live in the kernel-side dispatch bridge wired through `useTrace`
 * (the action channel, per plan.md Decision 2024-09-03). Coordination events
 * (`user.prompt`, `model.respond`, `model.result`, `tool.dispatch`,
 * `tool.result`, `respond`, `turn.end`) are harness vocabulary distinct from
 * Open Responses stream event types; the buffered `modelRespond` tool returns
 * assembled items rather than a spec stream, so spec-event verbatim streaming
 * (Phase 1) is out of scope for this slice.
 *
 * Loop shape (one iteration):
 *   1. waitFor [{ user.prompt }, { respond }] — ingress on the first pass,
 *      re-entry signal on subsequent passes (after a tool round).
 *   2. request { model.respond } — ask the model; the bridge calls
 *      `modelRespond` with the accumulated items and triggers `model.result`.
 *   3. waitFor [{ model.result }] — the bridge extracts the function_calls.
 *   4. request { tool.dispatch } — the bridge dispatches every pending
 *      function_call and triggers `tool.result`, or (no function_calls)
 *      triggers `turn.end` to stop the turn.
 *   5. waitFor [{ tool.result }, { turn.end }] — re-enter the loop.
 *
 * Every rule carries `interrupt: [{ turn.end }]` so the stop signal tears the
 * loop down cleanly from any step. The bridge bounds the loop with a
 * max-iteration guard (it triggers `turn.end` with `incomplete` status instead
 * of calling `modelRespond` once the cap trips) — no infinite loop.
 *
 * @packageDocumentation
 */

import type { Thread } from '../behavioral/behavioral.types.ts'

/**
 * The turn-loop thread — registered once per `runTurn`. Space-stamped by
 * `useAddThread(space)` so it only matches events triggered in its own space.
 *
 * @public
 */
export const TURN_LOOP_THREAD: Thread = {
  label: 'turn-loop',
  rules: [
    {
      waitFor: [{ type: 'user.prompt' }, { type: 'respond' }],
      interrupt: [{ type: 'turn.end' }],
    },
    {
      request: { type: 'model.respond' },
      interrupt: [{ type: 'turn.end' }],
    },
    {
      waitFor: [{ type: 'model.result' }],
      interrupt: [{ type: 'turn.end' }],
    },
    {
      request: { type: 'tool.dispatch' },
      interrupt: [{ type: 'turn.end' }],
    },
    {
      waitFor: [{ type: 'tool.result' }, { type: 'turn.end' }],
      interrupt: [{ type: 'turn.end' }],
    },
  ],
}
