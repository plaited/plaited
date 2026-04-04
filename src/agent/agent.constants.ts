import { keyMirror } from '../utils.ts'

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
export const AGENT_EVENTS = keyMirror(
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
export const SIDE_EFFECT_TOOL_EVENTS = keyMirror(AGENT_EVENTS.write_file, AGENT_EVENTS.delete_file, AGENT_EVENTS.bash)
