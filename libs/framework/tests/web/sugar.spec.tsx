import { test } from '@plaited/rite'
import { QuerySelector, Position, PlaitedElement } from '../../src/types.js'
import { Component } from '../../src/component/component.js'

let did = 1
const adjectives = [
    'pretty',
    'large',
    'big',
    'small',
    'tall',
    'short',
    'long',
    'handsome',
    'plain',
    'quaint',
    'clean',
    'elegant',
    'easy',
    'angry',
    'crazy',
    'helpful',
    'mushy',
    'odd',
    'unsightly',
    'adorable',
    'important',
    'inexpensive',
    'cheap',
    'expensive',
    'fancy',
  ],
  colours = ['red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'brown', 'white', 'black', 'orange'],
  nouns = [
    'table',
    'chair',
    'house',
    'bbq',
    'desk',
    'car',
    'pony',
    'cookie',
    'sandwich',
    'burger',
    'pizza',
    'mouse',
    'keyboard',
  ]

const random = (max: number) => Math.round(Math.random() * 1000) % max

type DataItem = { id: number; label: string }
type Data = DataItem[]

const buildData = (count: number): Data => {
  const data = []
  for (let i = 0; i < count; i++) {
    data.push({
      id: did++,
      label: `${adjectives[random(adjectives.length)]} ${colours[random(colours.length)]} ${
        nouns[random(nouns.length)]
      }`,
    })
  }
  return data
}

const row = (
  <tr bp-target='row'>
    <td
      className='col-md-1'
      bp-target='id'
    ></td>
    <td className='col-md-4'>
      <a bp-target='label'></a>
    </td>
    <td className='col-md-1'>
      <a>
        <span
          className='glyphicon glyphicon-remove'
          aria-hidden='true'
          bp-target='delete'
        ></span>
      </a>
    </td>
    <td className='col-md-6'></td>
  </tr>
)

const forEachRow = ($: QuerySelector, data: DataItem) => {
  $('row')[0].attr('bp-target', `${data.id}`)
  $('id')[0].render(<>{data.id}</>)
  $('label')[0].render(<>{data.label}</>)
}

const Fixture = Component({
  template: (
    <div bp-target='root'>
      <table bp-target='table'></table>
    </div>
  ),
  tag: 'table-fixture',
  observedTriggers: ['insert', 'render', 'replace', 'remove', 'removeAttributes', 'getAttribute', 'multiSetAttributes'],
  bp({ $, clone, feedback }) {
    const cb = clone(row, forEachRow)
    feedback({
      replace() {
        $('table')[0].replace(<span>I'm jsut a span</span>)
      },
      render() {
        $('table')[0].render(...buildData(100).map(cb))
      },
      insert(position: Position) {
        $('table')[0].insert(position, ...buildData(100).map(cb))
      },
      remove() {
        $('table')[0].replaceChildren()
      },
      getAttribute() {
        const attr = $('root')[0].attr('bp-target')
        $('root')[0].render(<>{attr}</>)
      },
      removeAttributes() {
        const labels = $('label')
        labels.forEach((label) => label.attr('bp-target', null))
      },
      multiSetAttributes() {
        const dels = $('delete')
        dels.forEach((del) =>
          del.attr({
            'bp-target': 'cancel',
            'aria-hidden': 'false',
            class: null,
          }),
        )
      },
    })
  },
})

Fixture.define()

test('beforebegin', async (t) => {
  const fixture = document.createElement(Fixture.tag) as PlaitedElement
  const body = document.querySelector('body')
  body.append(fixture)
  let root = await t.findByAttribute<HTMLDivElement>('bp-target', 'root')
  t({
    given: 'before calling trigger',
    should: 'root child count shoudl be 100',
    actual: root.childElementCount,
    expected: 1,
  })
  fixture.trigger({ type: 'insert', detail: 'beforebegin' })
  root = await t.findByAttribute<HTMLDivElement>('bp-target', 'root')
  t({
    given: 'after calling trigger',
    should: 'root child count should be 101',
    actual: root.childElementCount,
    expected: 101,
  })
  const table = await t.findByAttribute<HTMLTableElement>('bp-target', 'table')
  t({
    given: 'after calling trigger',
    should: 'root last child should be the table',
    actual: root.lastChild,
    expected: table,
  })
  fixture.remove()
})
test('afterbegin', async (t) => {
  const fixture = document.createElement(Fixture.tag) as PlaitedElement
  const body = document.querySelector('body')
  body.append(fixture)
  const table = await t.findByAttribute<HTMLTableElement>('bp-target', 'table')
  t({
    given: 'before calling trigger',
    should: 'table children should be empty',
    actual: table.childElementCount,
    expected: 0,
  })
  fixture.trigger({ type: 'insert', detail: 'afterbegin' })
  t({
    given: 'before calling trigger',
    should: 'table children should be 100',
    actual: table.childElementCount,
    expected: 100,
  })
  const lastChild = table.lastChild
  fixture.trigger({ type: 'insert', detail: 'afterbegin' })
  const nodeList = Array.from(table.childNodes)
  t({
    given: 'after calling trigger again',
    should: 'table children should be 200',
    actual: nodeList.length,
    expected: 200,
  })
  t({
    given: 'after calling trigger again',
    should: 'original last child should be 200th',
    actual: nodeList.indexOf(lastChild),
    expected: 199,
  })
  fixture.remove()
})
test('beforeend', async (t) => {
  const fixture = document.createElement(Fixture.tag) as PlaitedElement
  const body = document.querySelector('body')
  body.append(fixture)
  const table = await t.findByAttribute<HTMLTableElement>('bp-target', 'table')
  t({
    given: 'before calling trigger',
    should: 'table children should be empty',
    actual: table.childElementCount,
    expected: 0,
  })
  fixture.trigger({ type: 'insert', detail: 'beforeend' })
  t({
    given: 'before calling trigger',
    should: 'table children should be 100',
    actual: table.childElementCount,
    expected: 100,
  })
  const lastChild = table.lastChild
  fixture.trigger({ type: 'insert', detail: 'beforeend' })
  const nodeList = Array.from(table.childNodes)
  t({
    given: 'after calling trigger again',
    should: 'table children should be 200',
    actual: nodeList.length,
    expected: 200,
  })
  t({
    given: 'after calling trigger again',
    should: 'the original last child should be the 100th child',
    actual: nodeList.indexOf(lastChild),
    expected: 99,
  })
  fixture.remove()
})
test('afterend', async (t) => {
  const fixture = document.createElement(Fixture.tag) as PlaitedElement
  const body = document.querySelector('body')
  body.append(fixture)
  let root = await t.findByAttribute<HTMLDivElement>('bp-target', 'root')
  t({
    given: 'before calling trigger',
    should: 'root child count should be 1',
    actual: root.childElementCount,
    expected: 1,
  })
  fixture.trigger({ type: 'insert', detail: 'afterend' })
  root = await t.findByAttribute<HTMLDivElement>('bp-target', 'root')
  t({
    given: 'after calling trigger',
    should: 'root child count should be 101',
    actual: root.childElementCount,
    expected: 101,
  })
  const table = await t.findByAttribute<HTMLTableElement>('bp-target', 'table')
  t({
    given: 'after calling trigger',
    should: 'root first childe should be the table',
    actual: root.firstChild,
    expected: table,
  })
  fixture.remove()
})
test('render', async (t) => {
  const fixture = document.createElement(Fixture.tag) as PlaitedElement
  const body = document.querySelector('body')
  body.append(fixture)
  const table = await t.findByAttribute<HTMLTableElement>('bp-target', 'table')
  t({
    given: 'before calling trigger',
    should: 'table children should be empty',
    actual: table.childElementCount,
    expected: 0,
  })
  fixture.trigger({ type: 'render' })
  t({
    given: 'before calling trigger',
    should: 'table children should be 100',
    actual: table.childElementCount,
    expected: 100,
  })
  fixture.remove()
})
test('replace', async (t) => {
  const fixture = document.createElement(Fixture.tag) as PlaitedElement
  const body = document.querySelector('body')
  body.append(fixture)
  const root = await t.findByAttribute<HTMLDivElement>('bp-target', 'root')
  t({
    given: 'before calling trigger',
    should: 'root first child should be a table',
    actual: root.firstChild instanceof HTMLTableElement,
    expected: true,
  })
  fixture.trigger({ type: 'replace' })
  t({
    given: 'before calling trigger',
    should: 'root first childe children should be a span',
    actual: root.firstChild instanceof HTMLSpanElement,
    expected: true,
  })
  fixture.remove()
})
test('getAttribute', async (t) => {
  const fixture = document.createElement(Fixture.tag) as PlaitedElement
  const body = document.querySelector('body')
  body.append(fixture)
  const root = await t.findByAttribute<HTMLDivElement>('bp-target', 'root')
  t({
    given: 'before calling trigger',
    should: 'root firstChild should be a table',
    actual: root.firstChild instanceof HTMLTableElement,
    expected: true,
  })
  fixture.trigger({ type: 'getAttribute' })
  t({
    given: 'after calling trigger',
    should: 'root firstChild should be text',
    actual: root.firstChild instanceof Text,
    expected: true,
  })
  fixture.remove()
})
test('removeAttributes', async (t) => {
  const fixture = document.createElement(Fixture.tag) as PlaitedElement
  const body = document.querySelector('body')
  body.append(fixture)
  fixture.trigger({ type: 'render' })
  let label = await t.findByAttribute<HTMLDivElement>('bp-target', 'label')
  t({
    given: 'before calling removeAttributes trigger',
    should: 'first found label should be an anchorElement',
    actual: label instanceof HTMLAnchorElement,
    expected: true,
  })
  fixture.trigger({ type: 'removeAttributes' })
  label = await t.findByAttribute<HTMLDivElement>('bp-target', 'label')
  t({
    given: 'after calling removeAttributes trigger',
    should: 'should not be able to find an element with bp-target label',
    actual: label,
    expected: undefined,
  })
  fixture.remove()
})

test('multiSetAttributes', async (t) => {
  const fixture = document.createElement(Fixture.tag) as PlaitedElement
  const body = document.querySelector('body')
  body.append(fixture)
  fixture.trigger({ type: 'render' })
  let el = await t.findByAttribute<HTMLDivElement>('bp-target', 'delete')
  const can = await t.findByAttribute<HTMLSpanElement>('bp-target', 'cancel')
  t({
    given: 'before calling multiSetAttributes trigger',
    should: 'first found bp-target delete element should be an span',
    actual: el instanceof HTMLSpanElement,
    expected: true,
  })
  t({
    given: 'before calling multiSetAttributes trigger',
    should: 'el should have class',
    actual: el.getAttribute('class'),
    expected: 'glyphicon glyphicon-remove',
  })
  t({
    given: 'before calling multiSetAttributes trigger',
    should: 'aria-hiden should be true',
    actual: el.getAttribute('aria-hidden'),
    expected: 'true',
  })
  t({
    given: 'before calling multiSetAttributes trigger',
    should: 'should not be able to find an element with bp-target cancel',
    actual: can,
    expected: undefined,
  })
  fixture.trigger({ type: 'multiSetAttributes' })
  el = await t.findByAttribute<HTMLDivElement>('bp-target', 'delete')
  t({
    given: 'after calling removeAttributes trigger',
    should: 'should not be able to find an element with bp-target delete',
    actual: el,
    expected: undefined,
  })
  el = await t.findByAttribute<HTMLDivElement>('bp-target', 'cancel')
  t({
    given: 'after calling removeAttributes trigger',
    should: 'should find an element with bp-target cancel',
    actual: el instanceof HTMLSpanElement,
    expected: true,
  })
  t({
    given: 'after calling removeAttributes trigger',
    should: 'aria-hiden should be false',
    actual: el.getAttribute('aria-hidden'),
    expected: 'false',
  })
  t({
    given: 'after calling removeAttributes trigger',
    should: 'el should not have class attribute',
    actual: el.getAttribute('class'),
    expected: null,
  })
  fixture.remove()
})
