import { test } from '@plaited/rite'
import { css, stylesheets } from '@plaited/jsx'
import { createComponent, PlaitProps } from '../index.js'

test('dynamic styles', async t => {
  const body = document.querySelector('body')
  const [ cls, stylesheet ] = css`
    .noRepeat {
      color: blue;
    }
    .repeat {
      color: red;
    }
  `
  const fixture = createComponent({ tag:'dynamic-only' }, base => class extends base {
    static template = <div data-target='target'></div>
    plait({ $ }: PlaitProps){
      const target = $<HTMLDivElement>('target')
      target.render(
        <div {...stylesheet}
          className={cls.noRepeat}
        >construable stylesheet applied once</div>,
        'beforeend'
      )
      target.render(
        <div {...stylesheet}
          className={cls.repeat}
        >not applied</div>,
        'beforeend'
      )
    }
  })
  fixture()
  body.append(document.createElement(fixture.tag))

  const target = await t.findByAttribute('data-target', 'target')
  const root  = target.getRootNode() as ShadowRoot
  t({
    given: 'dynamic render of the same stylesheet twice',
    should: 'have adoptedStyleSheets of length 1',
    actual: root.adoptedStyleSheets.length,
    expected: 1,
  })
})

test('with default and dynamic styles', async t => {
  const body = document.querySelector('body')
  const [ cls, stylesheet ] = css`
    .root {
      color: blue;
    }
  `
  const [ cls2, stylesheet2 ] = css`
    .override {
      color: red;
    }
  `
  const fixture = createComponent({ tag:'with-default-styles' }, base => class extends base {
    static template = <div data-target='target-2'
      className={cls.root}
      { ...stylesheet }
    ></div>
    plait({ $ }: PlaitProps){
      const target = $<HTMLDivElement>('target-2')
      target.render(
        <div {...stylesheets(stylesheet, stylesheet2)}
          className={cls2.override}
        >construable stylesheet applied only for second sheet</div>,
        'beforeend'
      )
    }
  })
  fixture()
  body.append(document.createElement(fixture.tag))
  const target = await t.findByAttribute('data-target', 'target-2')
  const root  = target.getRootNode() as ShadowRoot
  t({
    given: 'dynamic render with default styles from template',
    should: 'have adoptedStyleSheets of length 2',
    actual: root.adoptedStyleSheets.length,
    expected: 2,
  })
})
