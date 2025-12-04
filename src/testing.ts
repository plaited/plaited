/**
 * Testing utilities for the Plaited framework.
 * Provides helpers for testing templates with Playwright integration through the workshop CLI.
 *
 * @remarks
 * This module provides access to:
 * - **Story Fixture**: {@link storyFixture} - Playwright test fixture for template/browser tests
 * - **Test Types**: Type definitions for story metadata, test configuration, and assertions
 *
 * @remarks
 * Testing in Plaited uses two approaches:
 * - Unit/Integration tests: `*.spec.{ts,tsx}` files run with Bun's test runner
 * - Template/Browser tests: `*.stories.tsx` files run with workshop CLI using Playwright
 *
 * The `storyFixture` helper integrates with Playwright to provide:
 * - Automatic template mounting and cleanup
 * - Accessibility testing via axe-core
 * - Browser-based interaction testing
 * - Visual regression capabilities
 *
 * @see {@link https://github.com/plaited/plaited} for framework documentation
 * @since 1.0.0
 */

export * from './testing/story.tsx'
export * from './testing/testing.types.ts'
