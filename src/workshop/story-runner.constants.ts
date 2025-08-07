import { keyMirror } from '../utils.js'

/**
 * @internal Key-mirrored object of event names used internally by the story runner system.
 * These events facilitate communication and state management within the test execution process.
 */
export const STORY_RUNNER_EVENTS = keyMirror('run_tests', 'log_event', 'end', 'on_runner_message', 'test_end')
