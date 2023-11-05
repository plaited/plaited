import { test, expect } from 'bun:test'
import { getTokenElement } from '../index.js'
import { css } from '@plaited/jsx'
import { ssr } from '@plaited/jsx/ssr'
import beautify from 'beautify'

test('getTokenElement', () => {
  const [_, stylesheet] = css`
    :host {
      --blue: blue;
    }
  `
  const DesignTokens = getTokenElement(stylesheet)
  const Template = DesignTokens.template

  expect(beautify(ssr(<Template />), { format: 'html' })).toMatchSnapshot('no children')
  expect(
    beautify(
      ssr(
        <Template>
          <div>hello world!</div>
        </Template>,
      ),
      { format: 'html' },
    ),
  ).toMatchSnapshot('with children')
})
