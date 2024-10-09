import { test, expect } from 'bun:test'
import { getTokenElement } from '../get-token-element.ts'
import beautify from 'beautify'

test('getTokenElement', () => {
  let DesignTokens = getTokenElement(`:host{--blue: blue}`)
  expect(beautify((<DesignTokens />).html.join(''), { format: 'html' })).toMatchSnapshot()
  DesignTokens = getTokenElement(`:host{--blue: blue}`, 'plaited-tokens')
  expect(
    beautify(
      (
        <DesignTokens>
          <div>hello world!</div>
        </DesignTokens>
      ).html.join(''),
      { format: 'html' },
    ),
  ).toMatchSnapshot()
})
