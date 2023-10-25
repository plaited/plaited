import { test } from '@plaited/rite'
import { isle, PlaitProps, css } from '../index.js'

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
  const [ cls2, stylesheet2 ] = css`
   .noRepeat {
     color: green;
   }
 `
  const fixture = isle({ tag:'base-element' }, base => class extends base {
    static template = <div data-target='target'></div>
    plait({ $ }: PlaitProps){
      const target = $<HTMLDivElement>('target')
      target.render(
        <div {...stylesheet}
          className={cls.noRepeat}
        >style tag appended only once</div>,
        'beforeend'
      )
      target.render(
        <div {...stylesheet}
          className={cls.noRepeat}
        >style tag appended only once</div>,
        'beforeend'
      )
      target.render(
        <div {...stylesheet2}
          className={cls2.noRepeat}
        >style tag appended only once</div>,
        'beforeend'
      )
      target.render(
        <div {...stylesheet2}
          className={cls2.noRepeat}
        >style tag appended only once</div>,
        'beforeend'
      )
    }
  })
  fixture()
  body.append(document.createElement(fixture.tag))

  const target = await t.findByAttribute('data-target', 'target')
  const root  = target.getRootNode() as ShadowRoot
  const shadowStyles = root.querySelectorAll('style').length
  t({
    given: 'dynamic render repeat in shadow DOM',
    should: 'only append styles once',
    actual: shadowStyles,
    expected: 1,
  })
})
