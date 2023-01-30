import test from 'ava'
import { tokens } from '../mod.ts'


test('tokens()', t => {
  const expected = {
    '--width': 32,
    '--height': 24,
    '--backgroundColor': 'black',
  }
  const actual = tokens(
    {
      width: 32,
      height: 24,
      backgroundColor: 'black',
    }
  )
  t.deepEqual(actual, expected)
})

test('tokens() conditional test', t => {
  const checked = false
  const disabled = true
  const expected = {
    '--width': 32,
    '--height': 24,
    '--backgroundColor': 'grey',
  }
  const actual = tokens(
    {
      width: 32,
      height: 24,
      backgroundColor: 'black',
    },
    checked && {
      backgroundColor: 'blue',
    },
    disabled && {
      backgroundColor: 'grey',
    }
  )
  t.deepEqual(actual, expected)
})
