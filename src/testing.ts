/**
 * Plaited Testing System
 *
 * A comprehensive testing solution for Plaited components and applications.
 * This module provides utilities for component testing, story testing, and test fixture management.
 *
 * Core Features:
 * - Component testing utilities (find, assert, event simulation)
 * - Story-based testing with interactive 'play' functions
 * - Shadow DOM traversal support
 * - Async operation handling
 * - Detailed error reporting
 *
 * @example
 * Basic Component Testing
 * ```ts
 * import { assert, findByText, fireEvent } from 'plaited/testing'
 *
 * // Test a button component
 * const test = async () => {
 *   const button = await findByText('Submit')
 *   assert({
 *     given: 'a button element',
 *     should: 'exist in the DOM',
 *     actual: button instanceof HTMLButtonElement,
 *     expected: true
 *   })
 *   await fireEvent(button, 'click')
 * }
 * ```
 *
 * @example
 * Story Testing with Play Function
 * ```ts
 * import type { StoryObj } from 'plaited/testing'
 *
 * export const Primary: StoryObj<typeof MyComponent> = {
 *   args: { label: 'Click Me' },
 *   play: async ({ findByText, fireEvent, assert }) => {
 *     const button = await findByText('Click Me')
 *     await fireEvent(button, 'click')
 *     // Assert expected behavior
 *   }
 * }
 * ```
 *
 * @example
 * Custom Test Fixture
 * ```html
 * <plaited-test-fixture
 *   p-socket="/_plaited"
 *   p-route="button--primary"
 *   p-file="src/button.stories.ts"
 *   p-entry="/dist/button.stories.js"
 *   p-name="Primary"
 * />
 * ```
 *
 * @packageDocumentation
 *
 * @remarks
 * Key exports:
 * - Core testing utilities:
 *   - {@link assert} - Type-safe assertion with detailed error reporting
 *   - {@link findByText} - DOM element lookup by text content
 *   - {@link findByAttribute} - DOM element lookup by attribute
 *   - {@link fireEvent} - Event simulation
 *   - {@link throws} - Error assertion
 *   - {@link match} - Pattern matching
 *
 * - Story testing:
 *   - {@link StoryObj} - Story configuration type
 *   - {@link Play} - Interactive test function type
 *   - {@link PlaitedFixture} - Custom element for test runners
 *
 * - Error handling:
 *   - Custom error types for assertions, timeouts, and parameter validation
 *   - Detailed error messages with context
 *
 * Features:
 * - Type-safe testing utilities
 * - Async/await support
 * - Shadow DOM traversal
 * - Event simulation
 * - Story-based testing
 * - Component interaction testing
 * - Detailed error reporting
 */

export type * from './testing/assert.types.js'
export * from './testing/assert.constants.js'
export * from './testing/assert.js'
export * from './testing/find-by-attribute.js'
export * from './testing/find-by-text.js'
export * from './testing/fire-event.js'
export * from './testing/match.js'
export * from './testing/throws.js'
export * from './utils/wait.js'
export * from './testing/errors.js'
export * from './testing/use-play.js'
export * from './testing/plaited-fixture.js'
