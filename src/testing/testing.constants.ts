import { keyMirror } from '../utils.ts'

/**
 * Default timeout for story play functions.
 * @default 5000ms (5 seconds)
 */
export const DEFAULT_PLAY_TIMEOUT = 5_000

/**
 * @internal
 * Custom element tag for story test fixtures.
 */
export const STORY_FIXTURE = 'plaited-story-fixture'

/**
 * @internal
 * Custom element tag for story test orchestrator.
 */
export const STORY_ORCHESTRATOR = 'plaited-story-orchestrator'

/**
 * @internal
 * Custom element tag for story test orchestrator.
 */
export const STORY_MASK = 'plaited-story-mask'

/**
 * @internal
 * Custom element tag for story test orchestrator.
 */
export const STORY_HEADER = 'plaited-story-header'

/**
 * @internal
 * WebSocket endpoint for test runner communication.
 */
export const RUNNER_URL = '/.plaited/runner'

/**
 * @internal
 * Command to reload story page during testing.
 */
export const RELOAD_PAGE = 'reload_page'

export const DATA_TESTID = 'data-testid'

/**
 * @internal
 * Event types for test fixture communication.
 * Used between story fixture and test runner.
 */
export const FIXTURE_EVENTS = keyMirror(
  'accessibility_check',
  'assertion',
  'find_by_attribute',
  'find_by_target',
  'find_by_test_id',
  'find_by_text',
  'fire_event',
  'play',
  'run',
  'test_fail',
  'test_pass',
  'wait',
)

/**
 * @internal
 * Event types for test fixture communication.
 * Used between story fixture and test runner.
 */
export const ORCHESTRATOR_EVENTS = keyMirror('init', 'connect_messenger')

export const ERROR_TYPES = keyMirror(
  'accessibility_violation',
  'failed_assertion',
  'missing_assertion_parameter',
  'test_timeout',
  'unknown_error',
)

export const SUCCESS_TYPES = keyMirror('passed_assertion', 'passed_accessibility_check')

export const __PLAITED_RUNNER__ = '__PLAITED_RUNNER__'
export const __PLAITED_MCP__ = '__PLAITED_MCP__'

export const STORY_TYPES = keyMirror('snapshot', 'interaction')

export const STORY_IDENTIFIER = '🍬'

/**
 * @internal
 * Event types for mask and header communication.
 */
export const MASK_EVENTS = keyMirror('emit_click', 'toggle')

export const HEADER_EVENTS = keyMirror('emit_toggle', 'toggle')

/**
 * @internal
 * Event types for agent-to-client communication.
 * Used for real-time messages from AI agents to the client UI.
 */
export const AGENT_EVENTS = keyMirror('agent_message')
