import { test, expect } from 'bun:test'
import { getTokenElement } from '../get-token-element.js'
import { ssr } from 'plaited/ssr'
import beautify from 'beautify'

test('getTokenElement', () => {
  let DesignTokens = getTokenElement(`:host{--blue: blue}`)

  expect(beautify(ssr(<DesignTokens />), { format: 'html' })).toMatchSnapshot()
  DesignTokens = getTokenElement(`:host{--blue: blue}`, 'plaited-tokens')
  expect(
    beautify(
      ssr(
        <DesignTokens>
          <div>hello world!</div>
        </DesignTokens>,
      ),
      { format: 'html' },
    ),
  ).toMatchSnapshot()
})
