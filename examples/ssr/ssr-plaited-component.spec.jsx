import { Component, css } from 'plaited'
import { ssr } from 'plaited/ssr'
import { test, expect } from 'bun:test'
import beautify from 'beautify'

const [ cls, stylesheet ] = css`
  .header: {
    color: pink
  }
`

class Fixture extends Component({
  tag: 'test-element',
  template: <div className={cls.header}
    { ...stylesheet}
  >
  server side rendered shadow dom
    <slot></slot>
  </div>,
}) {}

const render = tpl => beautify(ssr(tpl), { format: 'html' })

test('Fixture.template: shadow only', () => {
  expect(render(
    <Fixture.template />
  )).toMatchSnapshot()
})


test('Fixture.template: slot and id', ()=> {
  expect(render(
    <Fixture.template id='random'>
      <div>
        <h1>header</h1>
      </div>
    </Fixture.template>
  )).toMatchSnapshot()
})

test('Fixture.template: shadow, and mode closed', () => {
  expect(render(
    <Fixture.template shadowrootmode='closed'>
      <div>
        <h1>header</h1>
      </div>
    </Fixture.template>
  )).toMatchSnapshot('should still be shadowrootmode="open"')
})

test('Fixture.template: shadow, and delgatefocus false', () => {
  expect(render(
    <Fixture.template shadowrootdelegatesfocus='false'>
      <div>
        <h1>header</h1>
      </div>
    </Fixture.template>
  )).toMatchSnapshot('should still be shadowrootdelegatesfocus="true"')
})

