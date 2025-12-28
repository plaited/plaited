/**
 * Workshop module exports
 *
 * Development and testing tools for the Plaited framework.
 */

// Agent orchestration (event-driven coordination)
export * from './workshop/agent-orchestrator.ts'
// Template discovery (runtime-based for performance)
export * from './workshop/collect-behavioral-templates.ts'
// Story discovery (runtime-based for performance)
export * from './workshop/collect-stories.ts'
// Agent SDK integration
export * from './workshop/create-workshop-agent.ts'
// Story URL generation
export * from './workshop/get-paths.ts'

// Test runner
export * from './workshop/use-runner.ts'

// Types
export * from './workshop/workshop.types.ts'
