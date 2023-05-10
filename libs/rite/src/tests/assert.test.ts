/* eslint-disable max-len */
import { test, expect } from 'bun:test'
import sinon from 'sinon'
import { assert } from '../assert.js'

const sum = (...args: number[]) => {
  if (args.some(v => Number.isNaN(v))) throw new TypeError('NaN')
  return args.reduce((acc, n) => acc + n, 0)
}

const resolveAfter = () =>
  new Promise(resolve => {
    setTimeout(() => {
      resolve('resolved')
    }, 50)
  })

test('assert: sum()', () => {
  const should = 'return the correct sum'

  expect(() =>assert({
    given: 'no arguments',
    should: 'return 0',
    actual: sum(),
    expected: 0,
  })).not.toThrow()

  expect(() =>assert({
    given: 'zero',
    should,
    actual: sum(2, 0),
    expected: 2,
  })).not.toThrow()

  expect(() =>assert({
    given: 'negative numbers',
    should,
    actual: sum(1, -4),
    expected: -3,
  })).not.toThrow()
  expect(() =>assert({
    given: 'NaN',
    should: 'throw',
    actual: assert.throws(sum, 1, NaN),
    expected: new TypeError('NaN').toString(),
  })).not.toThrow()
})

test('assert: handles async', async () => {
  expect(async () => {
    const actual = await resolveAfter()
    assert({
      given: 'promise',
      should: 'resolve',
      actual,
      expected: 'resolved',
    })
  }).not.toThrow()
  expect(async () => {
    const error = new Error('ooops')
    const erred = (_: string) => {
      throw error
    }
    const actual = await assert.throws(erred, 'irrelevant')
    assert({
      given: 'an async function that throws',
      should: 'await and return the value of the error',
      actual,
      expected: error.toString(),
    })
  }).not.toThrow()
})

test('assert: throw returns undefined when not thrown', async () => {
  expect(async () => {
    const error = new Error('unacceptable')
    const reverence = (attitude: string, pass = false) => {
      if(!pass && attitude === 'irreverent') {
        throw error
      }
    }
    const actual = await assert.throws(reverence, 'irreverent', true)
    assert({
      given: 'reverent receives irreverent attitude but has a pass',
      should: 'not throw error',
      actual,
      expected: undefined,
    })
  }).not.toThrow()
})

test('wait()', async () => {
  await assert.wait(20)
  expect(() => assert({
    given: 'a wait call',
    should: 'should pause for 20ms',
    actual: true,
    expected: true,
  })).not.toThrow()
})

test('match()', () => {
  const given = 'some text to search and a pattern to match'
  const should = 'return the matched text'

  const textToSearch = '<h1>Dialog Title</h1>'
  const pattern = 'Dialog Title'
  const contains = assert.match(textToSearch)

  expect(() =>assert({
    given,
    should,
    actual: contains(pattern),
    expected: pattern,
  })).not.toThrow()
})

test('assert: required params', async () => {
  //@ts-ignore: testing error message
  const noParams =  async () => await assert({})
  let spy = sinon.spy(noParams)
  try {
    await spy()
  } catch (err) {
    expect(err.message).toBe("The following parameters are required by 'assert': (\n  given, should, actual, expected\n)")
  }
  expect(spy.calledOnce).toBe(true)
  //@ts-ignore: testing error message
  const partialParam =  async () => await assert({ given: 'some keys', should: 'find the missing keys' })
  spy = sinon.spy(partialParam)
  try {
    await spy()
  } catch (err) {
    expect(err.message).toBe("The following parameters are required by 'assert': (\n  actual, expected\n)")
  }
  expect(spy.calledOnce).toBe(true)
})

test('assert: throws on failure', () => {
  expect(() => assert({
    given: 'number',
    should: 'equal number',
    actual: 0,
    expected: 1,
  })).toThrow('{"message":"Given number: should equal number","actual":0,"expected":1}')


  expect(()=> assert({
    given: 'regex',
    should: 'equal regex',
    actual: /test/i,
    expected: /test/,
  })).toThrow('{"message":"Given regex: should equal regex","actual":{},"expected":{}}')
 
  expect(() => assert({
    given: 'false',
    should: 'equal false',
    actual: null,
    expected: false,
  })).toThrow('{"message":"Given false: should equal false","actual":null,"expected":false}')
   
  expect(() => assert({
    given: 'array',
    should: 'equal array',
    actual: [ 'nope' ],
    expected: [ 'array' ],
  })).toThrow('{"message":"Given array: should equal array","actual":["nope"],"expected":["array"]}')

  expect(() => assert({
    given: 'set',
    should: 'equal set',
    actual: new Set([ 'nope' ]),
    expected: new Set([ 'set' ]),
  })).toThrow('{"message":"Given set: should equal set","actual":{},"expected":{}}')

  expect(() => assert({
    given: 'map',
    should: 'equal map',
    actual: new Map([ [ 'key', 'nope' ] ]),
    expected: new Map([ [ 'key', 'value' ] ]),
  })).toThrow('{"message":"Given map: should equal map","actual":{},"expected":{}}')


  expect(() => assert({
    given: 'object',
    should: 'equal object',
    actual: {
      nope: 3,
    },
    expected: {
      key: 'value',
    },
  })).toThrow('{"message":"Given object: should equal object","actual":{"nope":3},"expected":{"key":"value"}}')
})
