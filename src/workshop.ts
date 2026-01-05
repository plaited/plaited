/**
 * Workshop module exports
 *
 * Development and testing tools for the Plaited framework.
 */

// Template discovery (runtime-based for performance)
export * from './workshop/collect-behavioral-templates.ts'
// Story discovery (runtime-based for performance)
export * from './workshop/collect-stories.ts'
// Story URL generation
export * from './workshop/get-paths.ts'
// Agent server for workshop integration
export { useAgentServer } from './workshop/use-agent-server.ts'
// Types
export * from './workshop/workshop.types.ts'
