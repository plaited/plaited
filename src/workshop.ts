/**
 * Workshop module exports
 *
 * Development and testing tools for the Plaited framework.
 */

// Release changelog generation
export * from './workshop/changelog.js'
// Template discovery (runtime-based for performance)
export * from './workshop/collect-behavioral-templates.js'
// Story discovery (runtime-based for performance)
export * from './workshop/collect-stories.js'

// Database operations (CLI-exposed, future MCP tools)
export * from './workshop/queries.js'
export * from './workshop/use-runner.js'

// Types
export * from './workshop/workshop.types.js'
