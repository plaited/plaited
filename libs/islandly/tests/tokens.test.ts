import { assertEquals } from '../../dev-deps.ts'
import { tokens } from '../mod.ts'

Deno.test('tokens()', () => {
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
    },
  )
  assertEquals(actual, expected)
})

Deno.test('tokens() conditional test', () => {
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
    },
  )
  assertEquals(actual, expected)
})
