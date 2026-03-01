/**
 * Agent loop module for the Plaited framework.
 * Provides the server-side agent loop orchestrated by `behavioral()`.
 *
 * @remarks
 * This module provides access to:
 * - **Agent Loop**: {@link createAgentLoop} - Creates a 6-step agent loop (Context → Reason → Gate → Simulate → Evaluate → Execute)
 * - **Tool Executor**: {@link createToolExecutor} - Factory for tool execution with built-in tools
 * - **Constitution**: {@link createGateCheck} - Gate check factory with risk classification and domain-specific custom checks
 * - **Simulate**: {@link createSimulate}, {@link createSubAgentSimulate} - Dreamer prediction factories
 * - **Evaluate**: {@link createEvaluate}, {@link checkSymbolicGate} - Judge evaluation with symbolic gate and neural scorer
 * - **Schemas**: Trajectory, tool call, plan, config, and gate decision schemas
 * - **Constants**: Event names, risk classes, tool status, built-in tool names
 * - **Utilities**: Inference call factory, response parser, trajectory recorder, context builder
 *
 * @public
 */

// Agent core (stays in src/agent/)
export * from './reference/agent.constants.ts'
export * from './reference/agent.orchestrator.constants.ts'
export * from './reference/agent.orchestrator.ts'
export type * from './reference/agent.orchestrator.types.ts'
export * from './reference/agent.schemas.ts'
export * from './reference/agent.ts'
export type * from './reference/agent.types.ts'
export * from './reference/agent.utils.ts'

// Tools (re-exported from src/tools/)
export * from './tools/constitution/constitution.ts'
export type * from './tools/constitution/constitution.types.ts'
export * from './tools/crud/crud.ts'
export * from './tools/evaluate/evaluate.ts'
export * from './tools/memory/memory.ts'
export type * from './tools/memory/memory.types.ts'
export * from './tools/simulate/simulate.ts'
