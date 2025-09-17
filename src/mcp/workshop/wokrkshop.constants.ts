import { keyMirror } from '../../../src/utils.js'

/**
 * @internal
 * Story runner event types for test orchestration.
 */
export const TEST_RUNNER_EVENTS = keyMirror('run_tests', 'log_event', 'end', 'on_runner_message', 'test_end')

/**
 * @internal Defines the URL path for the main workshop JavaScript bundle.
 * This script is typically included in story HTML pages to enable workshop functionalities.
 */
export const WORKSHOP_ROUTE = '/testing.js'

export const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`
