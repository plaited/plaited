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
  let Template = DesignTokens.template

  expect(beautify(ssr(<Template />), { format: 'html' })).toMatchSnapshot()
  DesignTokens = getTokenElement($stylesheet, 'plaited-tokens')
  Template = DesignTokens.template
  expect(
    beautify(
      ssr(
        <Template>
          <div>hello world!</div>
        </Template>,
      ),
      { format: 'html' },
    ),
  ).toMatchSnapshot()
})
