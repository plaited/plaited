import { TEST_PASSED, TEST_EXCEPTION } from '../assert/assert.constants.js'
import { isBPEvent } from '../behavioral/b-thread.js'
import type { FailedTestEvent, PassedTestEvent } from './workshop.types.js'

export const isAnExceptionEvent = (data: unknown): data is FailedTestEvent =>
  isBPEvent(data) && TEST_EXCEPTION === data.type
export const isAPassedTestEvent = (data: unknown): data is PassedTestEvent =>
  isBPEvent(data) && TEST_PASSED === data.type
