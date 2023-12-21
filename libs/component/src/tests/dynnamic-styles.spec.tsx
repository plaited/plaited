import { test } from '@plaited/rite'
import { css } from '@plaited/jsx'
import { stylesheets } from '@plaited/jsx/utils'
import { Component } from '../index.js'

test('dynamic styles', async (t) => {
  const body = document.querySelector('body')
  const { $stylesheet, ...cls } = css`
    .noRepeat {
      color: blue;
    }
    .repeat {
      color: red;
    }
  `
  const Fixture = Component({
    tag: 'dynamic-only',
    template: <div data-target='target'></div>,
    bp({ $ }) {
      const [target] = $<HTMLDivElement>('target')
      target.insert(
        'beforeend',
        <div
          stylesheet={$stylesheet}
          className={cls.noRepeat}
        >
          construable stylesheet applied once
        </div>,
      )
      target.insert(
        'beforeend',
        <div
          stylesheet={$stylesheet}
          className={cls.repeat}
        >
          not applied
        </div>,
      )
    },
  })
  Fixture.define()
  body.append(document.createElement(Fixture.tag))

  const target = await t.findByAttribute('data-target', 'target')
  const root = target.getRootNode() as ShadowRoot
  t({
    given: 'dynamic render of the same stylesheet twice',
    should: 'have adoptedStyleSheets of length 1',
    actual: root.adoptedStyleSheets.length,
    expected: 1,
  })
})

test('with default and dynamic styles', async (t) => {
  const body = document.querySelector('body')
  const { $stylesheet, ...cls } = css`
    .root {
      color: blue;
    }
  `
  const { $stylesheet: stylesheet2, ...cls2 } = css`
    .override {
      color: red;
    }
  `
  const Fixture = Component({
    tag: 'with-default-styles',
    template: (
      <div
        data-target='target-2'
        className={cls.root}
        stylesheet={$stylesheet}
      ></div>
    ),
    bp({ $ }) {
      const [target] = $<HTMLDivElement>('target-2')
      target.insert(
        'beforeend',
        <div
          stylesheet={stylesheets($stylesheet, stylesheet2)}
          className={cls2.override}
        >
          construable stylesheet applied only for second sheet
        </div>,
      )
    },
  })
  Fixture.define()
  body.append(document.createElement(Fixture.tag))
  const target = await t.findByAttribute('data-target', 'target-2')
  const root = target.getRootNode() as ShadowRoot
  t({
    given: 'dynamic render with default styles from template',
    should: 'have adoptedStyleSheets of length 2',
    actual: root.adoptedStyleSheets.length,
    expected: 2,
  })
})
