import { keyMirror } from '../utils/key-mirror.ts'

/**
 * Event type constants for the agent loop.
 *
 * @remarks
 * Maps to the 6-step loop: Context → Reason → Gate → Simulate → Evaluate → Execute.
 * Each constant is used as a `BPEvent.type` in `behavioral<AgentEventDetails>()`.
 *
 * @public
 */
export const AGENT_EVENTS = keyMirror(
  'task',
  'context_ready',
  'model_response',
  'proposed_action',
  'gate_approved',
  'gate_rejected',
  'simulate_request',
  'simulation_result',
  'eval_approved',
  'eval_rejected',
  'execute',
  'tool_result',
  'save_plan',
  'plan_saved',
  'message',
  'loop_complete',
)

/**
 * Risk classification for tool calls evaluated by the gate.
 *
 * @remarks
 * Foundation stubs all calls as `read_only`. Constitution bThreads
 * will later classify `side_effects` and `high_ambiguity`.
 *
 * @public
 */
export const RISK_CLASS = keyMirror('read_only', 'side_effects', 'high_ambiguity')

/**
 * Status of a tool call within the trajectory.
 *
 * @public
 */
export const TOOL_STATUS = keyMirror('pending', 'completed', 'failed')
