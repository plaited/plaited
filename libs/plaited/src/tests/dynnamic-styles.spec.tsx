import { test } from '@plaited/rite'
import { isle, PlaitProps, useSugar, css, PlaitedElement } from '../index.js'

test('dynamic styles', async t => {
  const body = document.querySelector('body')
  const fixture  = document.createElement('div')
  body.append(fixture)
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
  const Base = isle({ tag:'base-element' }, base => class extends base {
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
  Base()
  const Template: PlaitedElement = props => (
    <Base.template { ...props}>
      <div data-target='target'></div>
    </Base.template>
  )
  useSugar(fixture).render(
    <div><Template id='one'></Template></div>,
    'beforeend'
  )
  useSugar(fixture).render(
    <div  {...stylesheet}
      className={cls.repeat}
    >style tag appends more than once</div>,
    'beforeend'
  )
  useSugar(fixture).render(
    <div  {...stylesheet}
      className={cls.repeat}
    >style tag appends more than once</div>,
    'beforeend'
  )
  const shadowOne = await t.findByAttribute('id', 'one', fixture)
  const shadowStyles = shadowOne.shadowRoot.querySelectorAll('style').length
  const lightStyles = fixture.querySelectorAll('style').length
  t({
    given: 'dynamic render repeat in shadow DOM',
    should: 'only append styles once',
    actual: shadowStyles,
    expected: 1,
  })
  t({
    given: 'dynamic render repeat in light DOM',
    should: 'only append styles twice',
    actual: lightStyles,
    expected: 2,
  })
})
