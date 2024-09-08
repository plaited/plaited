import { test, expect } from 'bun:test'
import { getTokenElement } from '../get-token-element.js'
import beautify from 'beautify'

test('getTokenElement', () => {
  let DesignTokens = getTokenElement(`:host{--blue: blue}`)
  expect(beautify((<DesignTokens />).server.join(''), { format: 'html' })).toMatchSnapshot()
  DesignTokens = getTokenElement(`:host{--blue: blue}`, 'plaited-tokens')
  expect(
    beautify(
      (
        <DesignTokens>
          <div>hello world!</div>
        </DesignTokens>
      ).server.join(''),
      { format: 'html' },
    ),
  ).toMatchSnapshot()
})
