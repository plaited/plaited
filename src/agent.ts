/**
 * World agent infrastructure for generative UI.
 * Provides behavioral programming-based agent coordination.
 *
 * @remarks
 * This module exports:
 * - **Agent Factory**: {@link useWorldAgent} - useBehavioral-based agent loop
 * - **Tools**: {@link createToolRegistry}, {@link createCoreTools} - Tool management
 * - **Constraints**: Constraint bThreads for blocking invalid generations
 * - **Training**: Trajectory generation and reward computation
 *
 * The world agent uses behavioral programming to coordinate tool execution
 * with runtime constraints. Unlike class-based agents, bThreads block
 * invalid generations BEFORE execution.
 *
 * @example
 * ```typescript
 * import { useWorldAgent, createCoreTools } from 'plaited/agent'
 *
 * const trigger = await useWorldAgent({
 *   tools: createCoreTools({ outputDir: './generated' }),
 *   model: inferenceClient
 * })
 *
 * trigger({ type: 'generate', detail: { intent: 'Create a button' } })
 * ```
 */

// Types
export type * from './agent/agent.types.ts'
// Reward computation
export {
  computeReward,
  computeTrajectoryStats,
  createTrajectory,
  filterByReward,
  formatTrajectoriesJsonl,
} from './agent/compute-rewards.ts'
// Constraints
export {
  createCoordinateGeneration,
  createEnforceAccessibility,
  createEnforceTokenUsage,
  hasInlineStyles,
  hasRawColors,
  registerBaseConstraints,
} from './agent/constraints.ts'
// Trajectory generation
export {
  type BatchConfig,
  type ExecutionTrace,
  generateTrajectories,
  generateTrajectoriesFromStories,
  generateTrajectoryFromTrace,
} from './agent/generate-trajectories.ts'
// Tool infrastructure
export { createCoreTools, createToolRegistry } from './agent/tools.ts'
// Agent factory
export { useWorldAgent, type WorldAgentTrigger } from './agent/use-world-agent.ts'
