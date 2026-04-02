import { keyMirror } from '../utils.ts'

/**
 * Event type constants for the agent loop.
 *
 * @remarks
 * Maps to the 6-step loop: Context → Reason → Gate → Simulate → Evaluate → Execute.
 * Each constant is used as a `BPEvent.type` in the agent loop's `behavioral()` instance.
 *
 * Gate routing uses a single `gate_approved` event with composable risk tags
 * (see `RISK_TAG`). Unknown/untagged calls route to Simulate + Judge by default.
 *
 * Streaming events (`thinking_delta`, `text_delta`) are triggered by the inference
 * handler per chunk for progressive UI rendering. The handler consumes the
 * `AsyncIterable<ModelDelta>` privately and bridges chunks to BP events.
 *
 * Memory lifecycle events (`commit_snapshot`, `consolidate`, `defrag`) are
 * coordinated by bThreads that bind code changes to decision snapshots in
 * each module's `.memory/` directory. Per-side-effect commits ensure every
 * git commit pairs a code diff with the reasoning chain that produced it.
 *
 * @public
 */
export const AGENT_EVENTS = keyMirror(
  // 6-step loop
  'task',
  'context_ready',
  'invoke_inference',
  'model_response',
  // Gate routing
  'gate_rejected',
  'gate_approved',
  // Simulate → Evaluate
  'simulate_request',
  'simulation_result',
  'eval_approved',
  'eval_rejected',
  // Execute
  'execute',
  'tool_result',
  'tool_progress',
  // Plan
  'save_plan',
  'plan_saved',
  // Response
  'message',
  'loop_complete',
  // Streaming (progressive UI)
  'thinking_delta',
  'text_delta',
  // Inference errors
  'inference_error',
  // Proactive heartbeat — autonomous sensing and idle coordination
  'tick',
  'sensor_delta',
  'sensor_sweep',
  'sleep',
  'snapshot_committed',
  // Memory lifecycle — coordinated by sideEffectCommit, sessionClose, defragSchedule bThreads
  'commit_snapshot',
  'consolidate',
  'defrag',
)

/**
 * Composable risk tags for tool calls evaluated by the gate.
 *
 * @remarks
 * Tags are additive — a tool call can carry multiple tags simultaneously.
 * Gate bThread predicates inspect tags to determine routing:
 *
 * - `workspace` — operates within the git-tracked workspace (safe path)
 * - `crosses_boundary` — leaves the node boundary (network, IPC, A2A)
 * - `inbound` — pulls external data into the node
 * - `outbound` — sends data outside the node
 * - `irreversible` — cannot be undone (destructive operations)
 * - `external_audience` — output visible to humans or systems beyond the owner
 *
 * Unknown/untagged tool calls route to Simulate + Judge (default-deny).
 * Only explicitly tagged workspace operations skip the pipeline.
 *
 * @public
 */
export const RISK_TAG = keyMirror(
  'workspace',
  'crosses_boundary',
  'inbound',
  'outbound',
  'irreversible',
  'external_audience',
)

/**
 * Status of a tool call within the trajectory.
 *
 * @public
 */
export const TOOL_STATUS = keyMirror('pending', 'completed', 'failed')

/**
 * Minimal engine-level events for the new agent core.
 *
 * @remarks
 * These are intentionally narrower than the legacy loop event surface.
 * Factories can build richer orchestration on top of them.
 *
 * @public
 */
export const AGENT_CORE_EVENTS = keyMirror(
  'request_inference_primary',
  'request_inference_vision',
  'request_inference_tts',
  'read_file',
  'write_file',
  'delete_file',
  'glob_files',
  'grep',
  'bash',
  'agent_disconnect',
  'heartbeat',
  'update_factories',
  'agent_tool_result',
  'signal_schema_violation',
  'set_signal',
)

/**
 * Subset of built-in tools that produce side effects (code changes).
 *
 * @remarks
 * Used by the `sideEffectCommit` bThread to determine when a `tool_result`
 * should trigger a git commit. Each commit bundles the code change with all
 * pending decision `.jsonld` files in `.memory/` since the last commit.
 *
 * @public
 */
export const SIDE_EFFECT_TOOL_EVENTS = keyMirror(
  AGENT_CORE_EVENTS.write_file,
  AGENT_CORE_EVENTS.delete_file,
  AGENT_CORE_EVENTS.bash,
)
