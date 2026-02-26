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
  'invoke_inference',
  'model_response',
  'proposed_action',
  'gate_approved',
  'gate_rejected',
  'route_read_only',
  'route_side_effects',
  'route_high_ambiguity',
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
 * Returned by `classifyRisk()` in `agent.constitution.ts`. Determines
 * the routing path through the agent loop:
 * - `read_only` — skip simulation, execute directly
 * - `side_effects` — run Dreamer simulation before execution
 * - `high_ambiguity` — run simulation and neural Judge scoring
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

/**
 * Built-in tool names provided by the agent framework.
 *
 * @remarks
 * These tools have default implementations in `createToolExecutor()`.
 * Custom tool handlers with the same name override the built-in ones.
 *
 * @public
 */
export const BUILT_IN_TOOLS = keyMirror('read_file', 'write_file', 'list_files', 'bash', 'search')
