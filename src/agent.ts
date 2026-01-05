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
 * - **A2A Protocol**: Server and client adapters for agent interoperability
 * - **Pattern Registry**: Index validated stories as reusable patterns
 *
 * The world agent uses behavioral programming to coordinate tool execution
 * with runtime constraints. Unlike class-based agents, bThreads block
 * invalid generations BEFORE execution.
 */

// Types
export type * from './agent/a2a.types.ts'
// A2A Protocol - Client
export {
  type A2AClient,
  A2AError,
  createA2AClient,
  createTextMessage,
  discoverAgent,
  extractText,
} from './agent/a2a-client.ts'
// A2A Protocol - Server
export { createAgentCard, useA2AServer } from './agent/a2a-server.ts'
export type * from './agent/agent.types.ts'
// Code Sandbox (Phase 7)
export {
  createCodeExecutor,
  createCodeValidator,
  type ExecutionOptions,
  type ExecutionResult,
  executeSandboxed,
  hasUnsafePatterns,
  initializeSandbox,
  resetSandbox,
  type SandboxConfig,
  SandboxManager,
  type SandboxRuntimeConfig,
  type ValidationResult,
  validateCode,
} from './agent/code-sandbox.ts'
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
  createToolExecutions,
  type ExecutionTrace,
  extractIntent,
  generateTrajectories,
  generateTrajectoriesFromStories,
  generateTrajectoryFromTrace,
  parseFunctionGemmaOutput,
  type StoryInfo,
  type ToolExecution,
} from './agent/generate-trajectories.ts'
// Pattern Registry
export {
  createPatternRegistry,
  type Pattern,
  type PatternIndexConfig,
  type PatternMatch,
  type PatternRegistry,
} from './agent/pattern-registry.ts'
// Skill Scripts
export {
  type DiscoverOptions,
  discoverSkillScripts,
  discoverSkills,
  type ExecuteOptions,
  formatSkillsContext,
  loadSkillScripts,
  registerSkillScripts,
  type SkillMetadata,
  type SkillScript,
  scriptsToToolSchemas,
} from './agent/skill-scripts.ts'
// Tool Discovery (Phase 8)
export {
  createToolDiscovery,
  extractKeywords,
  filterToolsByIntent,
  type IndexedTool,
  type SearchOptions,
  schemaToIndexedTool,
  type ToolDiscovery,
  type ToolDiscoveryConfig,
  type ToolDiscoveryStats,
  type ToolMatch,
  type ToolSource,
} from './agent/tool-discovery.ts'
// Tool infrastructure
export { createCoreTools, createToolRegistry } from './agent/tools.ts'
// Agent factory
export { useWorldAgent, type WorldAgentTrigger } from './agent/use-world-agent.ts'
