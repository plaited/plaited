import { Assertion } from '$assert'

export const addition = async (assert: Assertion) => {
  //@ts-ignore:
  await assert({
    given: 'zero',
    should: 'return the correct sum',
    actual: 2 + 0,
    expected: 3,
  })
}
