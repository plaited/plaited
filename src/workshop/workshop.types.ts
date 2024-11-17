import type { Attrs, FunctionTemplate } from '../jsx/jsx.types.js'
import type { StylesObject } from '../style/css.types.js'
import type { assert } from '../assert/assert.js'
import type { findByAttribute } from '../assert/find-by-attribute.js'
import type { findByText } from '../assert/find-by-text.js'
import type { fireEvent } from '../assert/fire-event.js'
import type { match } from '../assert/match.js'
import type { throws } from '../assert/throws.js'
import type { wait } from '../utils/wait.js'
import type { TEST_EXCEPTION, UNKNOWN_ERROR, TEST_PASSED } from './workshop.constants.js'

export type Scale = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'rel'

export type Params = {
  a11y?: Record<string, string> | false
  description?: string
  headers?: (env: NodeJS.ProcessEnv) => Headers
  scale?: Scale
  styles?: StylesObject
  timeout?: number // Defaults to 5_000 ms
}

export type Args<T extends FunctionTemplate> = Parameters<T>[0]

export type Meta<T extends Attrs = Attrs> = {
  args?: Attrs
  parameters?: Params
  template?: FunctionTemplate<T>
}

export type Play = (args: {
  assert: typeof assert
  findByAttribute: typeof findByAttribute
  findByText: typeof findByText
  fireEvent: typeof fireEvent
  hostElement: Element
  match: typeof match
  throws: typeof throws
  wait: typeof wait
}) => Promise<void>

export type StoryObj<T extends Attrs = Attrs> = {
  args?: Attrs
  parameters?: Params
  play?: Play
  template?: FunctionTemplate<T>
}

export type TestParams = {
  a11y?: false | Record<string, string>
  description?: string
  scale?: Scale
  timeout: number
}

export type FailedTestEvent = {
  address: string
  type: typeof TEST_EXCEPTION | typeof UNKNOWN_ERROR
  detail: {
    route: string
    file: string
    story: string
    url: string
    type: string
  }
}

export type PassedTestEvent = {
  address: string
  type: typeof TEST_PASSED
  detail: {
    route: string
  }
}
