import { assertEquals } from '../../dev-deps.ts'
import { useTokens } from '../mod.ts'

Deno.test('tokens()', () => {
  const expected = {
    '--width': 32,
    '--height': 24,
    '--backgroundColor': 'black',
  }
  const [get, set] = useTokens(
    {
      width: 32,
      height: 24,
      backgroundColor: 'black',
    },
  )
  assertEquals(get(), expected)
  set({
    width: 32,
    height: 45,
    backgroundColor: 'black',
  })
  assertEquals(get(), { ...expected, '--height': 45 })
})

Deno.test('tokens() conditional test', () => {
  const checked = false
  const disabled = true
  const expected = {
    '--width': 32,
    '--height': 24,
    '--backgroundColor': 'grey',
  }
  const [get] = useTokens(
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
  assertEquals(get(), expected)
})
