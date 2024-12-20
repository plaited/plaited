import { ASSERTION_ERROR, MISSING_TEST_PARAMS_ERROR, TIMEOUT_ERROR } from './assert.constants.js'

export class AssertionError extends Error implements Error {
  override name = ASSERTION_ERROR
  constructor(message: string) {
    super(message)
  }
}

export class MissingTestParamsError extends Error {
  override name = MISSING_TEST_PARAMS_ERROR
  constructor(message: string) {
    super(message)
  }
}

export class TimeoutError extends Error {
  override name = TIMEOUT_ERROR
  constructor(message: string) {
    super(message)
  }
}
