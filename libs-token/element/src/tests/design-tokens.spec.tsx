import { test, expect } from 'bun:test'
import { getTokenElement } from '../index.js'
import { css } from '@plaited/jsx'
import { ssr } from '@plaited/jsx/ssr'
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
