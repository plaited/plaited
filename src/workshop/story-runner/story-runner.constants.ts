import { keyMirror } from '../../utils.js'

/**
 * @internal
 * Story runner event types for test orchestration.
 */
export const STORY_RUNNER_EVENTS = keyMirror('run_tests', 'log_event', 'end', 'on_runner_message', 'test_end')
