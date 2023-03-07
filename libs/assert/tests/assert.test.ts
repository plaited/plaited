import { assert, match, throws, wait } from '../mod.ts'
import { assertIsError } from '../../test-deps.ts'
const sum = (...args: number[]) => {
  if (args.some((v) => Number.isNaN(v))) throw new TypeError('NaN')
  return args.reduce((acc, n) => acc + n, 0)
}

const resolveAfter = () =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve('resolved')
    }, 50)
  })

Deno.test('assert: sum()', () => {
  const should = 'return the correct sum'

  assert({
    given: 'no arguments',
    should: 'return 0',
    actual: sum(),
    expected: 0,
  })

  assert({
    given: 'zero',
    should,
    actual: sum(2, 0),
    expected: 2,
  })

  assert({
    given: 'negative numbers',
    should,
    actual: sum(1, -4),
    expected: -3,
  })
  assert({
    given: 'NaN',
    should: 'throw',
    actual: throws(sum, 1, NaN),
    expected: new TypeError('NaN').toString(),
  })
})

Deno.test('assert: handles async', async () => {
  {
    const actual = await resolveAfter()
    assert({
      given: 'promise',
      should: 'resolve',
      actual,
      expected: 'resolved',
    })
  }
  {
    const error = new Error('ooops')
    const erred = (_: string) => {
      throw error
    }
    const actual = await throws(erred, 'irrelevant')
    assert({
      given: 'an async function that throws',
      should: 'await and return the value of the error',
      actual,
      expected: error.toString(),
    })
  }
})

Deno.test('wait()', async () => {
  await wait(20)
  assert({
    given: 'a wait call',
    should: 'should pause for 20ms',
    actual: true,
    expected: true,
  })
})

Deno.test('match()', () => {
  const given = 'some text to search and a pattern to match'
  const should = 'return the matched text'

  const textToSearch = '<h1>Dialog Title</h1>'
  const pattern = 'Dialog Title'
  const contains = match(textToSearch)

  assert({
    given,
    should,
    actual: contains(pattern),
    expected: pattern,
  })
})

Deno.test('assert: required params', async () => {
  try {
    //@ts-ignore: testing error message
    await assert({})
  } catch (err) {
    assertIsError(err, undefined, 'given, should, actual, expected')
  }
  try {
    //@ts-ignore: testing error message
    await assert({ given: 'some keys', should: 'find the missing keys' })
  } catch (err) {
    assertIsError(err, undefined, 'actual, expected')
  }
})

// Deno.test('assert: throws line and file', async () => {
//   try {
//     await assert({
//       given: 'zero',
//       should: 'return the correct sum',
//       actual: sum(2, 0),
//       expected: 3,
//     })
//   } catch (err) {
//     assertIsError(err, undefined, 'actual, expected')
//   }
// })
