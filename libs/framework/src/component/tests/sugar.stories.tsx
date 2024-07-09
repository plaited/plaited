import { assert, findByAttribute } from '@plaited/storybook-rite'
import { Meta } from '@plaited/storybook'
import { QuerySelector, Position, PlaitedElement } from '../types.js'
import { Component } from '../component.js'

const meta: Meta = {
  title: 'Tests/Sugar',
  component: () => <></>,
}

export default meta

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
  publicEvents: ['insert', 'render', 'replace', 'remove', 'removeAttributes', 'getAttribute', 'multiSetAttributes'],
  bp({ $, clone }) {
    const cb = clone(row, forEachRow)
    return {
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
    }
  },
})

export const beforebegin = {
  render: () => <Fixture />,
  play: async () => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    let root = await findByAttribute<HTMLDivElement>('bp-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root child count shoudl be 100',
      actual: root?.childElementCount,
      expected: 1,
    })
    fixture.trigger({ type: 'insert', detail: 'beforebegin' })
    root = await findByAttribute<HTMLDivElement>('bp-target', 'root')
    assert({
      given: 'after calling trigger',
      should: 'root child count should be 101',
      actual: root?.childElementCount,
      expected: 101,
    })
    const table = await findByAttribute<HTMLTableElement>('bp-target', 'table')
    assert({
      given: 'after calling trigger',
      should: 'root last child should be the table',
      actual: root?.lastChild,
      expected: table,
    })
  },
}
export const afterbegin = {
  render: () => <Fixture />,
  play: async () => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const table = await findByAttribute<HTMLTableElement>('bp-target', 'table')
    assert({
      given: 'before calling trigger',
      should: 'table children should be empty',
      actual: table?.childElementCount,
      expected: 0,
    })
    fixture.trigger({ type: 'insert', detail: 'afterbegin' })
    assert({
      given: 'before calling trigger',
      should: 'table children should be 100',
      actual: table?.childElementCount,
      expected: 100,
    })
    const lastChild = table?.lastChild
    fixture.trigger({ type: 'insert', detail: 'afterbegin' })
    // @ts-expect-error: allow it to error
    const nodeList = Array.from(table.childNodes)
    assert({
      given: 'after calling trigger again',
      should: 'table children should be 200',
      actual: nodeList.length,
      expected: 200,
    })
    assert({
      given: 'after calling trigger again',
      should: 'original last child should be 200th',
      // @ts-expect-error: allow it to error
      actual: nodeList.indexOf(lastChild),
      expected: 199,
    })
  },
}
export const beforeend = {
  render: () => <Fixture />,
  play: async () => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const table = await findByAttribute<HTMLTableElement>('bp-target', 'table')
    assert({
      given: 'before calling trigger',
      should: 'table children should be empty',
      actual: table?.childElementCount,
      expected: 0,
    })
    fixture.trigger({ type: 'insert', detail: 'beforeend' })
    assert({
      given: 'before calling trigger',
      should: 'table children should be 100',
      actual: table?.childElementCount,
      expected: 100,
    })
    const lastChild = table?.lastChild
    fixture.trigger({ type: 'insert', detail: 'beforeend' })
    // @ts-expect-error: allow it to error
    const nodeList = Array.from(table.childNodes)
    assert({
      given: 'after calling trigger again',
      should: 'table children should be 200',
      actual: nodeList.length,
      expected: 200,
    })
    assert({
      given: 'after calling trigger again',
      should: 'the original last child should be the 100th child',
      // @ts-expect-error: allow it to error
      actual: nodeList.indexOf(lastChild),
      expected: 99,
    })
  },
}
export const afterend = {
  render: () => <Fixture />,
  play: async () => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    let root = await findByAttribute<HTMLDivElement>('bp-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root child count should be 1',
      actual: root?.childElementCount,
      expected: 1,
    })
    fixture.trigger({ type: 'insert', detail: 'afterend' })
    root = await findByAttribute<HTMLDivElement>('bp-target', 'root')
    assert({
      given: 'after calling trigger',
      should: 'root child count should be 101',
      actual: root?.childElementCount,
      expected: 101,
    })
    const table = await findByAttribute<HTMLTableElement>('bp-target', 'table')
    assert({
      given: 'after calling trigger',
      should: 'root first childe should be the table',
      actual: root?.firstChild,
      expected: table,
    })
  },
}
export const render = {
  render: () => <Fixture />,
  play: async () => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const table = await findByAttribute<HTMLTableElement>('bp-target', 'table')
    assert({
      given: 'before calling trigger',
      should: 'table children should be empty',
      actual: table?.childElementCount,
      expected: 0,
    })
    fixture.trigger({ type: 'render' })
    assert({
      given: 'before calling trigger',
      should: 'table children should be 100',
      actual: table?.childElementCount,
      expected: 100,
    })
  },
}
export const replace = {
  render: () => <Fixture />,
  play: async () => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const root = await findByAttribute<HTMLDivElement>('bp-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root first child should be a table',
      actual: root?.firstChild instanceof HTMLTableElement,
      expected: true,
    })
    fixture.trigger({ type: 'replace' })
    assert({
      given: 'before calling trigger',
      should: 'root first childe children should be a span',
      actual: root?.firstChild instanceof HTMLSpanElement,
      expected: true,
    })
  },
}
export const getAttribute = {
  render: () => <Fixture />,
  play: async () => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const root = await findByAttribute<HTMLDivElement>('bp-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root firstChild should be a table',
      actual: root?.firstChild instanceof HTMLTableElement,
      expected: true,
    })
    fixture.trigger({ type: 'getAttribute' })
    assert({
      given: 'after calling trigger',
      should: 'root firstChild should be text',
      actual: root?.firstChild instanceof Text,
      expected: true,
    })
  },
}
export const removeAttributes = {
  render: () => <Fixture />,
  play: async () => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    fixture.trigger({ type: 'render' })
    let label = await findByAttribute<HTMLDivElement>('bp-target', 'label')
    assert({
      given: 'before calling removeAttributes trigger',
      should: 'first found label should be an anchorElement',
      actual: label instanceof HTMLAnchorElement,
      expected: true,
    })
    fixture.trigger({ type: 'removeAttributes' })
    label = await findByAttribute<HTMLDivElement>('bp-target', 'label')
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'should not be able to find an element with bp-target label',
      actual: label,
      expected: undefined,
    })
  },
}

export const multiSetAttributes = {
  render: () => <Fixture />,
  play: async () => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    fixture.trigger({ type: 'render' })
    let el = await findByAttribute<HTMLDivElement>('bp-target', 'delete')
    const can = await findByAttribute<HTMLSpanElement>('bp-target', 'cancel')
    assert({
      given: 'before calling multiSetAttributes trigger',
      should: 'first found bp-target delete element should be an span',
      actual: el instanceof HTMLSpanElement,
      expected: true,
    })
    assert({
      given: 'before calling multiSetAttributes trigger',
      should: 'el should have class',
      actual: el?.getAttribute('class'),
      expected: 'glyphicon glyphicon-remove',
    })
    assert({
      given: 'before calling multiSetAttributes trigger',
      should: 'aria-hiden should be true',
      actual: el?.getAttribute('aria-hidden'),
      expected: 'true',
    })
    assert({
      given: 'before calling multiSetAttributes trigger',
      should: 'should not be able to find an element with bp-target cancel',
      actual: can,
      expected: undefined,
    })
    fixture.trigger({ type: 'multiSetAttributes' })
    el = await findByAttribute<HTMLDivElement>('bp-target', 'delete')
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'should not be able to find an element with bp-target delete',
      actual: el,
      expected: undefined,
    })
    el = await findByAttribute<HTMLDivElement>('bp-target', 'cancel')
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'should find an element with bp-target cancel',
      actual: el instanceof HTMLSpanElement,
      expected: true,
    })
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'aria-hiden should be false',
      actual: el?.getAttribute('aria-hidden'),
      expected: 'false',
    })
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'el should not have class attribute',
      actual: el?.getAttribute('class'),
      expected: null,
    })
  },
}
