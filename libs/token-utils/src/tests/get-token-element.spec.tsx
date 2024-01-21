import { test, expect } from 'bun:test'
import { getTokenElement } from '../get-token-element.js'
import { css } from 'plaited/css'
import { ssr } from 'plaited/ssr'
import beautify from 'beautify'

test('getTokenElement', () => {
  const { $stylesheet } = css`
    :host {
      --blue: blue;
    }
  `
  let DesignTokens = getTokenElement($stylesheet)

  expect(beautify(ssr(<DesignTokens />), { format: 'html' })).toMatchSnapshot()
  DesignTokens = getTokenElement($stylesheet, 'plaited-tokens')
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
