import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_CALIBRATION_SAMPLE_SIZE,
  DEFAULT_CLIENT_NAME,
  DEFAULT_HARNESS_TIMEOUT,
  DEFAULT_POLLING_INTERVAL,
  DEFAULT_PROTOCOL_TIMEOUT,
  DEFAULT_TRIAL_COUNT,
  HEAD_LINES,
  JSON_RPC_ERRORS,
  MAX_CONTENT_LENGTH,
  PROTOCOL_METHODS,
  PROTOCOL_VERSION,
  TAIL_LINES,
} from '../constants.ts'

// ============================================================================
// JSON-RPC Protocol Constants
// ============================================================================

describe('PROTOCOL_METHODS', () => {
  test('contains all required lifecycle methods', () => {
    expect(PROTOCOL_METHODS.INITIALIZE).toBe('initialize')
    expect(PROTOCOL_METHODS.SHUTDOWN).toBe('shutdown')
  })

  test('contains all required session methods', () => {
    expect(PROTOCOL_METHODS.CREATE_SESSION).toBe('session/new')
    expect(PROTOCOL_METHODS.LOAD_SESSION).toBe('session/load')
    expect(PROTOCOL_METHODS.PROMPT).toBe('session/prompt')
    expect(PROTOCOL_METHODS.CANCEL).toBe('session/cancel')
    expect(PROTOCOL_METHODS.UPDATE).toBe('session/update')
    expect(PROTOCOL_METHODS.REQUEST_PERMISSION).toBe('session/request_permission')
    expect(PROTOCOL_METHODS.SET_MODEL).toBe('session/set_model')
  })

  test('contains protocol-level methods', () => {
    expect(PROTOCOL_METHODS.CANCEL_REQUEST).toBe('$/cancel_request')
  })
})

describe('PROTOCOL_VERSION', () => {
  test('is version 1', () => {
    expect(PROTOCOL_VERSION).toBe(1)
  })
})

// ============================================================================
// JSON-RPC Error Codes
// ============================================================================

describe('JSON_RPC_ERRORS', () => {
  test('contains standard JSON-RPC error codes', () => {
    expect(JSON_RPC_ERRORS.PARSE_ERROR).toBe(-32700)
    expect(JSON_RPC_ERRORS.INVALID_REQUEST).toBe(-32600)
    expect(JSON_RPC_ERRORS.METHOD_NOT_FOUND).toBe(-32601)
    expect(JSON_RPC_ERRORS.INVALID_PARAMS).toBe(-32602)
    expect(JSON_RPC_ERRORS.INTERNAL_ERROR).toBe(-32603)
  })

  test('contains extension error codes', () => {
    expect(JSON_RPC_ERRORS.REQUEST_CANCELLED).toBe(-32800)
  })
})

// ============================================================================
// Client Defaults
// ============================================================================

describe('Client defaults', () => {
  test('DEFAULT_CLIENT_NAME is set', () => {
    expect(DEFAULT_CLIENT_NAME).toBe('plaited-eval-harness')
  })

  test('DEFAULT_PROTOCOL_TIMEOUT is 30 seconds', () => {
    expect(DEFAULT_PROTOCOL_TIMEOUT).toBe(30000)
  })

  test('DEFAULT_POLLING_INTERVAL is 50ms', () => {
    expect(DEFAULT_POLLING_INTERVAL).toBe(50)
  })
})

// ============================================================================
// Harness Preview Configuration
// ============================================================================

describe('Preview configuration', () => {
  test('HEAD_LINES is positive', () => {
    expect(HEAD_LINES).toBeGreaterThan(0)
    expect(HEAD_LINES).toBe(8)
  })

  test('TAIL_LINES is positive', () => {
    expect(TAIL_LINES).toBeGreaterThan(0)
    expect(TAIL_LINES).toBe(4)
  })

  test('MAX_CONTENT_LENGTH is reasonable', () => {
    expect(MAX_CONTENT_LENGTH).toBeGreaterThan(0)
    expect(MAX_CONTENT_LENGTH).toBe(500)
  })
})

// ============================================================================
// Harness Defaults
// ============================================================================

describe('Harness defaults', () => {
  test('DEFAULT_HARNESS_TIMEOUT is 60 seconds', () => {
    expect(DEFAULT_HARNESS_TIMEOUT).toBe(60000)
  })

  test('DEFAULT_TRIAL_COUNT is 5', () => {
    expect(DEFAULT_TRIAL_COUNT).toBe(5)
  })

  test('DEFAULT_CALIBRATION_SAMPLE_SIZE is 10', () => {
    expect(DEFAULT_CALIBRATION_SAMPLE_SIZE).toBe(10)
  })
})
