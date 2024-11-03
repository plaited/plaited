import { test, expect } from 'bun:test'
import { getDesignTokensElement } from '../get-design-tokens-element.js'
import beautify from 'beautify'

test('getDesignTokensElement', () => {
  let DesignTokens = getDesignTokensElement(`:host{--blue: blue}`)
  expect(beautify((<DesignTokens />).html.join(''), { format: 'html' })).toMatchSnapshot()
  DesignTokens = getDesignTokensElement(`:host{--blue: blue}`, 'plaited-tokens')
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
