import { isBPEvent } from '../behavioral/b-thread.js'
import { TEST_PASSED, TEST_EXCEPTION } from './assert.constants.js'
import type { FailedTestEvent, PassedTestEvent } from './assert.types.js'

export const isAnExceptionEvent = (data: unknown): data is FailedTestEvent =>
  isBPEvent(data) && TEST_EXCEPTION === data.type

export const isAPassedTestEvent = (data: unknown): data is PassedTestEvent =>
  isBPEvent(data) && TEST_PASSED === data.type
