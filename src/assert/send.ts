import { useSend } from '../client/use-handler.js'
import { PLAITED_TEST_HANDLER, } from '../shared/constants.js'
import { UNKNOWN_ERROR, TEST_EXCEPTION} from './assert.constants.js'

export type FailedTest = {
  id: string
  location: string
  type: string
  error: string
}

export type PassedTest = {
  id: string
}

export const send = useSend(PLAITED_TEST_HANDLER)

export const sendUnknownError = (id: string, error: Error) => send<FailedTest>({ type: UNKNOWN_ERROR, detail: {
  id,
  location: window?.location.href,
  type: TEST_EXCEPTION,
  error: error.toString(),
}})